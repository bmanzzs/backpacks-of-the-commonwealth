(() => {
  'use strict';
  const config = window.CATALOG_ANALYTICS || {};
  const button = document.getElementById('help-btn');
  const panel = document.getElementById('help-popup');
  const chart = document.getElementById('traffic-chart');
  const status = document.getElementById('traffic-status');
  const total = document.getElementById('traffic-total');
  const dataTable = document.getElementById('traffic-data');
  const retry = document.getElementById('traffic-retry');
  const cache = new Map();
  const pending = new Map();
  const ttl = 4 * 60 * 60 * 1000;
  let range = '1m';
  let generation = 0;
  let site = '';
  try {
    const url = new URL(config.site);
    if (url.protocol === 'https:' && /^[a-z0-9-]+\.goatcounter\.com$/.test(url.hostname) && !url.username && !url.password && !url.port) site = url.origin;
  } catch (_) { /* An unconfigured site never contacts an analytics service. */ }
  const iso = date => date.toISOString().slice(0,10);
  const parseDate = text => new Date(text + 'T00:00:00Z');
  const shiftDays = (date, days) => new Date(date.getTime() + days * 86400000);
  const month = (date, offset = 0) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
  const started = parseDate(config.started || '');
  const configured = Boolean(site && Number.isFinite(started.getTime()) && iso(started) === config.started && typeof config.path === 'string' && config.path.startsWith('/'));
  const shortDate = date => date.toLocaleDateString('en-US', { month:'short', day:'numeric', timeZone:'UTC' });
  const fullDate = date => date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', timeZone:'UTC' });

  // Track only the published catalog. Preview visits and tab/detail clicks are excluded.
  if (configured && location.hostname === config.productionHost && (location.pathname === config.path || location.pathname === config.path + 'index.html')) {
    window.goatcounter = { path: config.path, no_events: true };
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://gc.zgo.at/count.js';
    script.dataset.goatcounter = site + '/count';
    document.head.appendChild(script);
  }

  function openPanel(open) {
    panel.hidden = !open;
    panel.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    if (open) loadTraffic();
  }
  button.addEventListener('click', () => openPanel(panel.hidden));
  document.getElementById('help-close').addEventListener('click', () => {openPanel(false);button.focus();});
  document.addEventListener('click', event => {
    if (!panel.hidden && !panel.contains(event.target) && !button.contains(event.target)) openPanel(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { openPanel(false); button.focus(); }
  });
  document.querySelectorAll('[data-traffic-range]').forEach(control => {
    control.disabled = !configured;
    control.addEventListener('click', () => {
      range = control.dataset.trafficRange;
      document.querySelectorAll('[data-traffic-range]').forEach(other => other.setAttribute('aria-pressed', String(other === control)));
      loadTraffic();
    });
  });
  retry.addEventListener('click', () => loadTraffic());

  function bucketsForRange() {
    const today = parseDate(iso(new Date()));
    const tomorrow = shiftDays(today,1);
    let first = range === '1m' ? shiftDays(today,-29) : range === '1y' ? month(today,-11) : started;
    if (first < started) first = started;
    if (first > today) return [];
    let monthsPerBucket = 1;
    if (range === 'all') {
      const months = (today.getUTCFullYear()-first.getUTCFullYear())*12 + today.getUTCMonth()-first.getUTCMonth()+1;
      monthsPerBucket = Math.max(1,Math.ceil(months/12));
    }
    const buckets = [];
    for (let start = first; start < tomorrow;) {
      const next = range === '1m' ? shiftDays(start,5) : month(start,monthsPerBucket);
      const end = next > tomorrow ? tomorrow : next;
      buckets.push({ start, end, label: fullDate(start) + ' – ' + fullDate(shiftDays(end,-1)) });
      start = end;
    }
    return buckets;
  }

  async function getCount(start) {
    const url = `${site}/counter/${encodeURIComponent(config.path)}.json?start=${iso(start)}`;
    const saved = cache.get(url);
    if (saved && Date.now()-saved.at < ttl) return saved.count;
    if (pending.has(url)) return pending.get(url);
    const task = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(),12000);
      try {
        const response = await fetch(url, { credentials:'omit', signal:controller.signal });
        // GoatCounter returns a JSON zero with 404 when a path has no hits yet.
        if (!response.ok && response.status !== 404) throw new Error('Counter unavailable');
        const body = await response.json();
        const raw = String(body.count ?? '');
        if (!/^[0-9][0-9,.\s\u00a0\u202f]*$/.test(raw)) throw new Error('Invalid count');
        const count = Number(raw.replace(/[^0-9]/g,''));
        if (!Number.isSafeInteger(count) || count < 0 || (response.status === 404 && count !== 0)) throw new Error('Invalid count');
        cache.set(url,{ at:Date.now(), count });
        return count;
      } finally {clearTimeout(timeout);}
    })();
    pending.set(url,task);
    try { return await task; } finally { pending.delete(url); }
  }

  async function loadTraffic() {
    const current = ++generation;
    chart.hidden = true;
    dataTable.hidden = true;
    total.hidden = true;
    retry.hidden = true;
    status.hidden = false;
    if (!configured) {status.textContent = 'Traffic tracking is not connected yet.';return;}
    document.getElementById('traffic-since').textContent = `Tracking since ${fullDate(started)}. Dates are UTC.`;
    const buckets = bucketsForRange();
    if (!buckets.length) {status.textContent = 'Traffic tracking has not started yet.';return;}
    status.textContent = 'Loading visits…';
    try {
      // Counts since successive boundaries avoid the counter API's inclusive midnight
      // end-date semantics. Differences form non-overlapping UTC time buckets.
      const cumulative = Array(buckets.length);
      let next = 0;
      await Promise.all(Array.from({length:Math.min(3,buckets.length)},async () => {
        while (next < buckets.length) {
          const i = next++;
          cumulative[i] = await getCount(buckets[i].start);
        }
      }));
      if (current !== generation) return;
      const counts = cumulative.map((value,i) => value - (cumulative[i+1] || 0));
      // Differently aged upstream caches can briefly disagree. Never graph negative visits.
      if (counts.some(value => value < 0)) throw new Error('Counts are refreshing');
      renderChart(buckets,counts);
      document.getElementById('traffic-count').textContent = cumulative[0].toLocaleString('en-US');
      document.getElementById('traffic-period').textContent = range === '1m' ? 'Past 30 days · up to 5 days per bar' : range === '1y' ? 'Past 12 calendar months · monthly totals' : 'All recorded history';
      total.hidden = false;
      chart.hidden = false;
      dataTable.hidden = false;
      status.hidden = cumulative[0] !== 0;
      status.textContent = 'No visits recorded in this period yet.';
    } catch (_) {
      if (current !== generation) return;
      status.textContent = 'Traffic data is temporarily unavailable. Please try again later.';
      retry.hidden = false;
    }
  }

  function renderChart(buckets,counts) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 336 150');
    svg.setAttribute('role','img');
    svg.setAttribute('aria-label', `Catalog visits from ${fullDate(buckets[0].start)} to ${fullDate(shiftDays(buckets.at(-1).end,-1))}. Exact counts are in the date table below.`);
    function add(tag,attrs,text) {
      const el = document.createElementNS(ns,tag);
      Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));
      if (text !== undefined) el.textContent = text;
      svg.appendChild(el); return el;
    }
    const max = Math.max(1,...counts);
    add('line',{x1:36,y1:116,x2:334,y2:116,stroke:'#36582c'});
    add('line',{x1:36,y1:16,x2:334,y2:16,stroke:'#1e3a1e','stroke-dasharray':'3 3'});
    const textAttrs = {fill:'#9bb88d','font-size':11,'font-family':'monospace'};
    add('text',{...textAttrs,x:30,y:20,'text-anchor':'end'},max.toLocaleString('en-US',{notation:'compact',maximumFractionDigits:1}));
    add('text',{...textAttrs,x:30,y:120,'text-anchor':'end'},'0');
    const step = 296/counts.length;
    counts.forEach((count,i)=>{
      const height = count/max*100;
      const rect = add('rect',{x:38+i*step,y:116-height,width:Math.max(2,step-6),height,class:'traffic-bar'});
      const title = document.createElementNS(ns,'title');
      title.textContent = `${buckets[i].label}: ${count.toLocaleString('en-US')} visits`;
      rect.appendChild(title);
    });
    add('text',{...textAttrs,x:36,y:142},shortDate(buckets[0].start));
    add('text',{...textAttrs,x:334,y:142,'text-anchor':'end'},shortDate(shiftDays(buckets.at(-1).end,-1)));
    chart.replaceChildren(svg);
    const tbody = document.getElementById('traffic-data-body');
    tbody.replaceChildren();
    buckets.forEach((bucket,i)=>{
      const row = document.createElement('tr');
      [bucket.label,counts[i].toLocaleString('en-US')].forEach(value=>{
        const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell);
      });
      tbody.appendChild(row);
    });
  }
})();
