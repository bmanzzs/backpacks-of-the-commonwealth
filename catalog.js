// Catalog page: progression chart, inventory (inspect and compare), collectibles, navigation.
// Data comes from backpacks-data.js (BACKPACKS, OMODS, IMGS) and collectibles-data.js (COLLECTIBLES).
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const pad2 = n => String(n).padStart(2, '0');
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 1079px)');
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* storage unavailable */ } }
  };

  // ── Derived data ─────────────────────────────────────────────────────
  const COLOR_MAP = {
    'default': '#888888', 'brown leather': '#7a4020', 'black leather': '#2a2a2a', 'black': '#2a2a2a', 'green': '#4a7a3a',
    'tan': '#c8a87a', 'blue': '#3a6aaa', 'rose': '#cc7788', 'army green canvas': '#4b5320', 'u.s. army green': '#4b5320',
    'dark blood ruby': '#8b0000', 'shadow black': '#222222', 'rebel canvas': '#6b6b5a', 'khaki': '#c3a882', 'brown': '#7a4020',
    'orange rust': '#c8601a', 'yellow': '#d4b800', 'red': '#cc3333', 'purple': '#8833cc', 'orange': '#d46a1a',
    'many nuka variants': '#ff6699', 'many': '#ff6699'
  };
  const sentences = text => text.split(/(?<=\.)\s+/).map(s => s.trim().replace(/\.$/, '')).filter(Boolean);
  const tone = text => /^[-−]/.test(text) ? 'neg' : /^\+0\b/.test(text) ? '' : 'pos';
  const statSentence = s => /^[-+]\d+ (Agility|Strength|Perception|Endurance|Charisma|Intelligence|Luck)$/.test(s);
  const ccMod = m => ({ ...m, v: Number((m.desc.match(/carry capacity by \+(\d+)/i) || [])[1] || 0), fx: sentences(m.desc.replace(/^.*?carry capacity by \+\d+\.?\s*/i, '')) });
  const resist = (text, kind) => Number((text.match(new RegExp(`${kind} resistance \\+(\\d+)`, 'i')) || [])[1] || 0);
  const drMod = m => ({ ...m, dr: resist(m.desc, 'Damage'), er: resist(m.desc, 'Energy'), rr: resist(m.desc, 'Rad') });
  const values = (text, unit) => [...text.matchAll(new RegExp(`\\+(\\d+)\\s*${unit}\\b`, 'g'))].map(m => Number(m[1]));

  const PACKS = BACKPACKS.map((bp, idx) => {
    const cc = (bp.cc.match(/\d+/g) || [0]).map(Number);
    const dr = values(bp.dr, 'DR'), er = values(bp.dr, 'ER'), rr = values(bp.dr, 'RR');
    const [edid, ...rest] = bp.location.split(' — ');
    const om = OMODS[bp.id] || { cc: [], dr: [] };
    const ccMods = (om.cc || []).map(ccMod), drMods = (om.dr || []).map(drMod);
    const recipe = bp.crafting.split(' · ');
    const perks = (bp.crafting.match(/\[([^\]]+)\]/) || [, ''])[1].split(',').map(s => s.trim()).filter(Boolean);
    const parts = recipe.filter(p => !p.startsWith('[')).map(p => { const m = p.match(/^(.*?)\s*×\s*(\d+)$/); return m ? { name: m[1], qty: Number(m[2]) } : { name: p, qty: null }; });
    const flavor = sentences(bp.desc).filter(s => !/carry capacity/i.test(s) && !statSentence(s));
    const pack = {
      bp, idx, num: bp.num, name: bp.name, level: bp.level, img: IMGS[idx],
      ccBase: cc[0], ccMax: Math.max(...cc), drBase: dr[0] || 0, drMax: Math.max(0, ...dr), erMax: Math.max(0, ...er), rrMax: Math.max(0, ...rr),
      agi: Number((bp.desc.match(/([-−]\d+) Agility/) || [])[1] || 0), weight: parseFloat(bp.weight), value: parseInt(bp.value, 10),
      place: rest.length ? rest.join(' — ').trim() : bp.location, edid: rest.length ? edid.trim() : '',
      ccMods, drMods, mods: ccMods.length + drMods.length, perks, parts, flavor
    };
    pack.search = [bp.name, bp.id, bp.location, bp.special.join(' '), bp.colors.join(' '), perks.join(' '), ...ccMods.map(m => `${m.name} ${m.desc} ${m.perks.join(' ')}`), ...drMods.map(m => `${m.name} ${m.perks.join(' ')}`)].join(' ').toLowerCase();
    return pack;
  });
  const byNum = new Map(PACKS.map(p => [p.num, p]));
  const CC_TOP = Math.max(...PACKS.map(p => p.ccMax));
  const DR_TOP = Math.max(...PACKS.map(p => p.drMax));
  const MOD_TOTAL = PACKS.reduce((sum, p) => sum + p.mods, 0);
  $$('[data-mod-total]').forEach(el => { el.textContent = MOD_TOTAL; });
  const statMods = $('#stat-mods');
  if (statMods) { statMods.textContent = MOD_TOTAL; statMods.dataset.count = MOD_TOTAL; }
  const pct = v => `${(v / CC_TOP * 100).toFixed(2)}%`;
  const band = level => level <= 15 ? 'Early game · levels 1–15' : level <= 35 ? 'Mid game · levels 20–35' : 'Late game · levels 40–60';
  const lockIcon = '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="5.5" width="8" height="5.5"/><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5"/></svg>';

  // ── State ────────────────────────────────────────────────────────────
  const SORT_DIR = { num: 1, level: 1, ccMax: -1, ccBase: -1, drMax: -1, weight: 1, value: -1, mods: -1, name: 1, agi: -1 };
  const state = { sort: 'num', dir: 1, query: '', level: null, view: 'inspect', selected: 1 };
  const savedLevel = Number(store.get('botc-level'));
  if (savedLevel >= 1 && savedLevel <= 99) state.level = savedLevel;
  const locked = p => state.level != null && p.level > state.level;
  function visiblePacks() {
    const q = state.query;
    const list = q ? PACKS.filter(p => q.split(/\s+/).every(word => p.search.includes(word))) : PACKS.slice();
    const k = state.sort, d = state.dir;
    return list.sort((a, b) => (k === 'name' ? a.name.localeCompare(b.name) : a[k] - b[k]) * d || a.num - b.num);
  }

  // ── Toast and clipboard ──────────────────────────────────────────────
  const toastEl = $('#toast');
  let toastTimer = 0;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 1800);
  }
  function copy(text, done) {
    const fallback = () => {
      const area = document.createElement('textarea');
      area.value = text; area.setAttribute('readonly', ''); area.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.append(area); area.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      area.remove();
      toast(ok ? done : `Copy this: ${text}`);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => toast(done), fallback);
    else fallback();
  }
  const linkFor = num => `${location.origin}${location.pathname}#bp-${pad2(num)}`;

  // ── Inventory list ───────────────────────────────────────────────────
  const inv = $('#inv'), list = $('#inv-list'), detail = $('#inv-detail'), sheet = $('#inv-sheet');
  const compareWrap = $('#inv-compare'), compareBody = $('#compare-body'), countEl = $('#inv-count');
  function rowHTML(p) {
    const up = p.ccMax > p.ccBase;
    return `<li class="inv-row${locked(p) ? ' is-locked' : ''}" role="option" id="opt-${p.num}" data-num="${p.num}" aria-selected="${p.num === state.selected}">
      <span class="inv-num">${pad2(p.num)}</span>
      <img class="inv-thumb" src="${esc(p.img)}" alt="" width="44" height="52" loading="lazy" decoding="async">
      <span class="inv-main"><span class="inv-name">${esc(p.name)}</span>
        <span class="inv-cc" title="Carry capacity: base +${p.ccBase}, best mod +${p.ccMax}"><span class="cc-track"><span class="cc-base" style="width:${pct(p.ccBase)}"></span>${up ? `<span class="cc-up" style="left:${pct(p.ccBase)};width:${pct(p.ccMax - p.ccBase)}"></span>` : ''}</span><span class="inv-ccv">+${p.ccBase}${up ? `–${p.ccMax}` : ''}</span></span></span>
      <span class="inv-lvl">${locked(p) ? `${lockIcon}<span class="sr-only">Above your level. </span>` : ''}LVL ${p.level}</span>
    </li>`;
  }
  function renderList() {
    const packs = visiblePacks();
    const bands = state.sort === 'num' || state.sort === 'level';
    let html = '', current = '';
    for (const p of packs) {
      if (bands && band(p.level) !== current) { current = band(p.level); html += `<li class="inv-band" aria-hidden="true">${current}</li>`; }
      html += rowHTML(p);
    }
    list.innerHTML = html;
    $('#inv-empty').hidden = packs.length > 0;
    const within = state.level == null ? null : PACKS.filter(p => !locked(p)).length;
    countEl.textContent = `${packs.length === PACKS.length ? `${packs.length} backpacks` : `${packs.length} of ${PACKS.length} backpacks`}${within == null ? '' : ` · ${within} at or below level ${state.level}`}`;
    if (packs.length && !packs.some(p => p.num === state.selected)) select(packs[0].num, { scroll: false, announce: false });
    else markSelected(false);
    renderCompare(packs);
  }
  function markSelected(scroll) {
    $$('.inv-row', list).forEach(row => row.setAttribute('aria-selected', String(Number(row.dataset.num) === state.selected)));
    list.setAttribute('aria-activedescendant', `opt-${state.selected}`);
    $$('tr[data-num]', compareBody).forEach(tr => tr.classList.toggle('is-current', Number(tr.dataset.num) === state.selected));
    if (scroll) {
      // The list flows with the page: keep the selected row on screen below the top bar.
      const row = $(`#opt-${state.selected}`), r = row?.getBoundingClientRect();
      const top = $('#topbar').offsetHeight + 8;
      if (r && (r.top < top || r.bottom > innerHeight - 8)) row.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
  }
  function select(num, { scroll = true, announce = true } = {}) {
    const p = byNum.get(num);
    if (!p) return;
    state.selected = num;
    markSelected(scroll);
    renderDetail(p);
    if (announce && sheet.classList.contains('is-open')) setHash(num, false);
  }

  // ── Spec sheet ───────────────────────────────────────────────────────
  const readout = (cls, label, from, to, unit = '') => `<div class="ro ${cls}"><dt>${label}</dt><dd><b>${from}</b>${to != null ? `<span class="ro-to">→ ${to}</span>` : ''}${unit ? `<span class="ro-unit">${unit}</span>` : ''}</dd></div>`;
  function modHTML(m) {
    return `<li class="mod">
      <span class="mod-name">${esc(m.name)}</span>
      <span class="mod-v">+${m.v}<small>carry</small></span>
      <span class="bar" aria-hidden="true"><span style="width:${(m.v / CC_TOP * 100).toFixed(1)}%"></span></span>
      ${m.fx.length ? `<span class="mod-fx">${m.fx.map(t => `<span class="${tone(t)}">${esc(t)}</span>`).join('')}</span>` : ''}
      <span class="mod-req">${m.perks.map(pk => `<span class="perk">${esc(pk)}</span>`).join('')}<span>${esc(m.ingredients.join(' · ') || 'No components')}</span></span>
    </li>`;
  }
  function drModHTML(m) {
    const extra = [m.er && `Energy +${m.er}`, m.rr && `Rad +${m.rr}`].filter(Boolean);
    return `<li class="mod">
      <span class="mod-name">${esc(m.name)}</span>
      <span class="mod-v">+${m.dr}<small>damage res.</small></span>
      <span class="bar" aria-hidden="true"><span style="width:${(m.dr / DR_TOP * 100).toFixed(1)}%"></span></span>
      ${extra.length ? `<span class="mod-fx">${extra.map(t => `<span class="pos">${t} resistance</span>`).join('')}</span>` : ''}
      <span class="mod-req">${m.perks.map(pk => `<span class="perk">${esc(pk)}</span>`).join('')}<span>${esc(m.ingredients.join(' · ') || 'No components')}</span></span>
    </li>`;
  }
  function renderDetail(p) {
    const bp = p.bp, visible = visiblePacks(), pos = visible.findIndex(q => q.num === p.num);
    $('#sheet-pos').textContent = pos >= 0 ? `${pad2(pos + 1)} / ${pad2(visible.length)}` : '';
    const special = bp.special.filter(s => !/^→/.test(s));
    detail.innerHTML = `<article class="spec" aria-labelledby="spec-title">
      <header>
        <p class="spec-kicker"><span class="spec-no">No. ${pad2(p.num)}</span><span>Level ${p.level}</span>${locked(p) ? `<span class="spec-lock">Above your level ${state.level}</span>` : ''}</p>
        <h3 class="spec-title" id="spec-title">${esc(p.name)}</h3>
        ${p.flavor.length ? `<p class="spec-desc">${esc(p.flavor.join('. '))}.</p>` : ''}
        <div class="spec-actions">
          <button type="button" class="chip-btn" data-act="copy-id" title="Copy editor ID">${esc(bp.id)} <span aria-hidden="true">⧉</span></button>
          <button type="button" class="chip-btn" data-act="link">Copy link</button>
          <button type="button" class="chip-btn" data-act="map">Show on field map</button>
        </div>
      </header>
      <div class="spec-top">
        <figure class="scanner"><img src="${esc(p.img)}" alt="${esc(p.name)}" width="208" height="247"></figure>
        <div>
          <dl class="readouts">
            ${readout('ro-cc', 'Carry capacity', `+${p.ccBase}`, p.ccMax > p.ccBase ? `+${p.ccMax}` : null)}
            ${readout('ro-dr', 'Damage resistance', `+${p.drBase}`, p.drMax > p.drBase ? `+${p.drMax}` : null)}
            ${p.erMax ? readout('ro-er', 'Energy resistance', `+${p.erMax}`) : ''}
            ${p.rrMax ? readout('ro-rr', 'Rad resistance', `+${p.rrMax}`) : ''}
            ${p.agi ? readout('ro-agi', 'Agility', `${p.agi}`, null, 'base') : ''}
            ${readout('', 'Weight', p.weight, null, 'lbs')}
            ${readout('', 'Value', p.value, null, 'caps')}
          </dl>
          ${special.length ? `<p class="effects"><span class="effects-label">Mod effects</span>${special.map(s => `<span class="tag ${tone(s)}">${esc(s)}</span>`).join('')}</p>` : ''}
        </div>
      </div>
      <section class="spec-block"><h4>Carry capacity mods <span class="count">${p.ccMods.length}</span><span class="hint">Bars share one scale across all backpacks</span></h4><ol class="mods">${p.ccMods.map(modHTML).join('')}</ol></section>
      ${p.drMods.length ? `<section class="spec-block"><h4>Resistance mods <span class="count">${p.drMods.length}</span></h4><ol class="mods mods-dr">${p.drMods.map(drModHTML).join('')}</ol></section>` : ''}
      <div class="spec-cols">
        <section class="spec-block"><h4>Base recipe</h4>
          <ul class="parts">${p.parts.map(part => `<li><span>${esc(part.name)}</span>${part.qty != null ? `<span class="q">×${part.qty}</span>` : ''}</li>`).join('')}</ul>
          ${p.perks.length ? `<p class="recipe-perks">Requires ${p.perks.map(pk => `<span class="perk">${esc(pk)}</span>`).join('')}</p>` : ''}
        </section>
        <section class="spec-block"><h4>Where to find it</h4>
          <div class="minimap" role="button" tabindex="0" data-act="map" aria-label="Show ${esc(p.place)} on the field map"><span class="minimap-pin"></span></div>
          <p class="place">${esc(p.place)}</p>
          ${p.edid ? `<p class="place-actions"><button type="button" class="chip-btn" data-act="copy-loc" title="Copy location editor ID">${esc(p.edid)} <span aria-hidden="true">⧉</span></button></p>` : ''}
        </section>
      </div>
      <section class="spec-block"><h4>Colors <span class="count">${bp.colors.length}</span></h4>
        <ul class="swatches">${bp.colors.map(c => `<li><span class="sw" style="--c:${COLOR_MAP[c.toLowerCase()] || '#888888'}"></span>${esc(c)}</li>`).join('')}</ul>
      </section>
    </article>`;
    detail.scrollTop = 0;
    placeMinimap();
  }
  // The minimap is a window onto the half-size field map, centred on the pin where the edge allows.
  const MAP_THUMB = 'assets/map/commonwealth-2k.webp';
  let minimapReady = false;
  function placeMinimap() {
    const box = $('.minimap', detail), pin = box && $('.minimap-pin', box), spot = window.catalogMap?.pins?.[state.selected];
    if (!box || !spot) return;
    if (!minimapReady) return;
    const w = box.clientWidth, h = box.clientHeight;
    if (!w) return;
    const size = Math.max(w * 4, h * 4), px = spot[0] / 100 * size, py = spot[1] / 100 * size;
    const x = Math.min(0, Math.max(w - size, w / 2 - px)), y = Math.min(0, Math.max(h - size, h / 2 - py));
    box.style.backgroundImage = `url("${MAP_THUMB}")`;
    box.style.backgroundSize = `${size}px ${size}px`;
    box.style.backgroundPosition = `${Math.round(x)}px ${Math.round(y)}px`;
    pin.style.translate = `${Math.round(px + x)}px ${Math.round(py + y)}px`;
  }
  new IntersectionObserver((entries, observer) => {
    if (entries.some(e => e.isIntersecting)) { minimapReady = true; placeMinimap(); observer.disconnect(); }
  }, { rootMargin: '300px 0px' }).observe(inv);
  new ResizeObserver(() => placeMinimap()).observe(detail);

  // ── Compare table ────────────────────────────────────────────────────
  function renderCompare(packs) {
    compareBody.innerHTML = packs.map(p => `<tr data-num="${p.num}" class="${locked(p) ? 'is-locked' : ''}${p.num === state.selected ? ' is-current' : ''}">
      <td class="c-no">${pad2(p.num)}</td>
      <th scope="row" class="c-name"><button type="button" class="row-open" data-num="${p.num}"><img src="${esc(p.img)}" alt="" width="30" height="36" loading="lazy">${esc(p.name)}</button></th>
      <td>${locked(p) ? `${lockIcon} ` : ''}${p.level}</td>
      <td><span class="rng"><span class="cc-track"><span class="cc-base" style="width:${pct(p.ccBase)}"></span>${p.ccMax > p.ccBase ? `<span class="cc-up" style="left:${pct(p.ccBase)};width:${pct(p.ccMax - p.ccBase)}"></span>` : ''}</span><span class="rng-v">+${p.ccBase}${p.ccMax > p.ccBase ? ` → +${p.ccMax}` : ''}</span></span></td>
      <td class="c-dr">+${p.drBase}${p.drMax > p.drBase ? ` → +${p.drMax}` : ''}</td>
      <td class="${p.agi ? 'c-neg' : 'c-dim'}">${p.agi ? p.agi : '0'}</td>
      <td>${p.weight} lbs</td>
      <td>${p.value}</td>
      <td>${p.mods}</td>
      <td class="c-loc">${esc(p.place)}</td>
    </tr>`).join('');
    $$('.compare thead th').forEach(th => {
      const key = $('button', th)?.dataset.sort;
      if (key === state.sort) th.setAttribute('aria-sort', state.dir > 0 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
  }
  function setView(view) {
    state.view = view;
    inv.dataset.view = view;
    compareWrap.hidden = view !== 'compare';
    $$('.seg [data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    if (view === 'inspect') placeMinimap();
  }

  // ── Narrow screens: the spec sheet slides over the list ──────────────
  let sheetReturn = null;
  function openSheet(fromRow = true) {
    if (!narrow.matches) return;
    sheetReturn = fromRow ? $(`#opt-${state.selected}`) || list : null;
    sheet.classList.add('is-open');
    document.body.classList.add('sheet-open');
    if (!history.state?.sheet) { try { history.pushState({ sheet: true }, '', `#bp-${pad2(state.selected)}`); } catch { /* sandboxed frame */ } }
    requestAnimationFrame(() => { placeMinimap(); $('.sheet-back', sheet).focus({ preventScroll: true }); });
  }
  function closeSheet({ viaHistory = false } = {}) {
    if (!sheet.classList.contains('is-open')) return;
    sheet.classList.remove('is-open');
    document.body.classList.remove('sheet-open');
    if (!viaHistory && history.state?.sheet) history.back();
    sheetReturn?.focus?.({ preventScroll: true });
  }
  window.addEventListener('popstate', () => { if (!history.state?.sheet) closeSheet({ viaHistory: true }); });
  narrow.addEventListener('change', () => { if (!narrow.matches) closeSheet(); placeMinimap(); });
  function step(direction) {
    const packs = visiblePacks(), i = packs.findIndex(p => p.num === state.selected);
    if (!packs.length) return;
    select(packs[(i + direction + packs.length) % packs.length].num);
  }
  function setHash(num, push) {
    const hash = `#bp-${pad2(num)}`;
    if (location.hash === hash) return;
    try { history[push ? 'pushState' : 'replaceState'](history.state, '', hash); } catch { /* sandboxed frame: links still work without the hash */ }
  }

  // Open a backpack from anywhere on the page (chart, map, collectibles, links).
  function openBackpack(num, { focusList = false } = {}) {
    if (!byNum.has(num)) return;
    if (state.query && !visiblePacks().some(p => p.num === num)) { state.query = ''; $('#inv-search').value = ''; renderList(); }
    if (state.view !== 'inspect') setView('inspect');
    select(num);
    if (narrow.matches) {
      $('#inventory').scrollIntoView({ block: 'start', behavior: motion.matches ? 'auto' : 'smooth' });
      openSheet(false);
    } else {
      setHash(num, false);
      $('#inventory').scrollIntoView({ block: 'start', behavior: motion.matches ? 'auto' : 'smooth' });
      if (focusList) list.focus({ preventScroll: true });
    }
  }
  window.openBackpack = openBackpack;
  function showOnMap(num) {
    closeSheet();
    $('#map-shell').scrollIntoView({ block: 'start', behavior: motion.matches ? 'auto' : 'smooth' });
    window.catalogMap?.show();
    setTimeout(() => window.catalogMap?.focus?.(num), motion.matches ? 0 : 520);
  }

  // ── Wiring: inventory ────────────────────────────────────────────────
  list.addEventListener('click', e => {
    const row = e.target.closest('.inv-row');
    if (!row) return;
    select(Number(row.dataset.num));
    if (narrow.matches) openSheet();
    else { setHash(state.selected, false); list.focus({ preventScroll: true }); }
  });
  list.addEventListener('keydown', e => {
    const rows = $$('.inv-row', list), i = rows.findIndex(r => Number(r.dataset.num) === state.selected);
    let j = i;
    if (e.key === 'ArrowDown') j = Math.min(rows.length - 1, i + 1);
    else if (e.key === 'ArrowUp') j = Math.max(0, i - 1);
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = rows.length - 1;
    else if ((e.key === 'Enter' || e.key === ' ') && narrow.matches) { e.preventDefault(); openSheet(); return; }
    else return;
    e.preventDefault();
    if (j >= 0 && rows[j]) { select(Number(rows[j].dataset.num)); if (!narrow.matches) setHash(state.selected, false); }
  });
  sheet.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    const p = byNum.get(state.selected);
    if (!act || !p) return;
    if (act === 'close') closeSheet();
    else if (act === 'prev') step(-1);
    else if (act === 'next') step(1);
    else if (act === 'copy-id') copy(p.bp.id, `Copied ${p.bp.id}`);
    else if (act === 'copy-loc') copy(p.edid, `Copied ${p.edid}`);
    else if (act === 'link') copy(linkFor(p.num), 'Link copied');
    else if (act === 'map') showOnMap(p.num);
  });
  sheet.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.minimap')) { e.preventDefault(); showOnMap(state.selected); }
    if (e.key === 'Escape' && sheet.classList.contains('is-open')) { e.stopPropagation(); closeSheet(); }
  });
  $('#inv-search').addEventListener('input', e => { state.query = e.target.value.trim().toLowerCase(); renderList(); });
  $('#inv-sort').addEventListener('change', e => { state.sort = e.target.value; state.dir = SORT_DIR[state.sort]; renderList(); });
  $$('.compare thead button[data-sort]').forEach(b => b.addEventListener('click', () => {
    const key = b.dataset.sort;
    state.dir = state.sort === key ? -state.dir : SORT_DIR[key];
    state.sort = key;
    const option = $(`#inv-sort option[value="${key}"]`);
    $('#inv-sort').value = option ? key : 'num';
    renderList();
  }));
  compareBody.addEventListener('click', e => {
    const tr = e.target.closest('tr[data-num]');
    if (tr) openBackpack(Number(tr.dataset.num), { focusList: true });
  });
  $$('.seg [data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $$('[data-view-link]').forEach(a => a.addEventListener('click', () => setView(a.dataset.viewLink)));
  const levelInput = $('#my-level');
  function setLevel(value) {
    const n = Math.round(Number(value));
    state.level = value === '' || value == null || !Number.isFinite(n) || n < 1 ? null : Math.min(99, n);
    levelInput.value = state.level ?? '';
    store.set('botc-level', state.level);
    renderList();
    renderDetail(byNum.get(state.selected));
    chart.draw();
  }
  levelInput.value = state.level ?? '';
  levelInput.addEventListener('change', () => setLevel(levelInput.value));
  $$('[data-level-step]').forEach(b => b.addEventListener('click', () => {
    const delta = Number(b.dataset.levelStep);
    setLevel(state.level == null ? (delta > 0 ? 1 : '') : state.level + delta);
  }));

  // ── Progression chart ────────────────────────────────────────────────
  const chart = (() => {
    const host = $('#progression'), tip = $('#chart-tip'), live = $('#chart-live');
    const order = PACKS.slice().sort((a, b) => a.level - b.level || a.num - b.num);
    let marks = [], hot = null, drawn = false, width = 0;
    function draw() {
      const W = host.clientWidth;
      if (!W) return;
      width = W;
      const H = W < 520 ? 270 : 330, m = { l: 36, r: 14, t: 16, b: 38 };
      const x = level => m.l + level / 62 * (W - m.l - m.r);
      const y = v => m.t + (1 - v / 120) * (H - m.t - m.b);
      const groups = new Map();
      PACKS.forEach(p => { if (!groups.has(p.level)) groups.set(p.level, []); groups.get(p.level).push(p); });
      const gap = W < 520 ? 6 : 9;
      marks = PACKS.map(p => {
        const g = groups.get(p.level), k = g.indexOf(p);
        return { p, cx: x(p.level) + (k - (g.length - 1) / 2) * gap, y0: y(p.ccBase), y1: y(p.ccMax) };
      });
      const gridY = [0, 25, 50, 75, 100].map(v => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`).join('');
      const ticksY = [0, 25, 50, 75, 100].map(v => `<text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('');
      const ticksX = [1, 10, 20, 30, 40, 50, 60].map(l => `<text x="${x(l)}" y="${H - m.b + 18}" text-anchor="middle">${l}</text>`).join('');
      const you = state.level != null ? (() => {
        const lx = x(Math.min(state.level, 62)), label = `YOU · ${state.level}`, lw = label.length * 7 + 12;
        const bx = Math.min(W - m.r - lw, Math.max(m.l, lx - lw / 2));
        return `<g class="pc-you"><line x1="${lx}" x2="${lx}" y1="${m.t}" y2="${H - m.b}"/><rect x="${bx}" y="${m.t - 2}" width="${lw}" height="17"/><text x="${bx + lw / 2}" y="${m.t + 10}" text-anchor="middle">${label}</text></g>`;
      })() : '';
      const peak = marks.reduce((a, b) => (b.p.ccMax > a.p.ccMax ? b : a));
      const peakName = peak.p.name.replace(/^Limited Edition /, '');
      const markSVG = marks.map((mk, i) => {
        const d = motion.matches ? 0 : 0.25 + order.indexOf(mk.p) * 0.035;
        return `<g class="pc-mark${locked(mk.p) ? ' is-locked' : ''}" data-num="${mk.p.num}" style="--d:${d.toFixed(2)}s">
          <line class="pc-stem" x1="${mk.cx}" x2="${mk.cx}" y1="${mk.y0}" y2="${mk.y1}" pathLength="1"/>
          <circle class="pc-base" cx="${mk.cx}" cy="${mk.y0}" r="4.5"/>
          <circle class="pc-max" cx="${mk.cx}" cy="${mk.y1}" r="5"/>
        </g>`;
      }).join('');
      host.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
        <g class="pc-grid">${gridY}</g>
        <g class="pc-axis">${ticksY}${ticksX}</g>
        <text class="pc-axis-title" x="${W - m.r}" y="${H - 4}" text-anchor="end">LEVEL →</text>
        ${you}
        ${markSVG}
        <text class="pc-label" x="${peak.cx - 10}" y="${peak.y1 + 4}" text-anchor="end">${esc(peakName)} · ${peak.p.ccMax}</text>
        <g class="pc-hot"></g>
      </svg>`;
      host.setAttribute('aria-label', `Carry capacity by level for all ${PACKS.length} backpacks, from +${Math.min(...PACKS.map(p => p.ccBase))} at level 1 to +${peak.p.ccMax} for the ${peak.p.name}.`);
      if (!drawn && !motion.matches) {
        host.classList.add('is-drawing');
        setTimeout(() => host.classList.remove('is-drawing'), 2600);
      }
      drawn = true;
      if (hot) setHot(hot.p.num, false);
    }
    function setHot(num, show = true) {
      const mk = marks.find(k => k.p.num === num) || null;
      hot = mk;
      $$('.pc-mark', host).forEach(g => g.classList.toggle('is-hot', Number(g.dataset.num) === num));
      const ring = $('.pc-hot', host);
      if (ring) ring.innerHTML = mk ? `<circle class="pc-hot-ring" cx="${mk.cx}" cy="${mk.y1}" r="10"/>` : '';
      host.classList.toggle('is-pointing', !!mk);
      if (!mk || !show) { tip.hidden = true; return; }
      const p = mk.p;
      tip.innerHTML = `<img src="${esc(p.img)}" alt=""><span class="chart-tip-val">+${p.ccBase}${p.ccMax > p.ccBase ? ` → +${p.ccMax}` : ''}</span><span class="chart-tip-name">${esc(p.name)}</span><span class="chart-tip-meta">No. ${pad2(p.num)} · LVL ${p.level}${locked(p) ? ' · above your level' : ''}</span>`;
      tip.hidden = false;
      const hostBox = host.getBoundingClientRect(), panelBox = tip.offsetParent.getBoundingClientRect();
      const ox = hostBox.left - panelBox.left, oy = hostBox.top - panelBox.top;
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      let left = ox + mk.cx - tw / 2, top = oy + mk.y1 - th - 16;
      if (top < 4) top = oy + mk.y0 + 16;
      left = Math.max(6, Math.min(panelBox.width - tw - 6, left));
      tip.style.translate = `${Math.round(left)}px ${Math.round(top)}px`;
    }
    function nearest(px, py) {
      let best = null, bestD = 24;
      for (const mk of marks) {
        const dy = py < mk.y1 ? mk.y1 - py : py > mk.y0 ? py - mk.y0 : 0;
        const d = Math.hypot(px - mk.cx, dy);
        if (d < bestD) { bestD = d; best = mk; }
      }
      return best;
    }
    host.addEventListener('pointermove', e => {
      const r = host.getBoundingClientRect(), mk = nearest(e.clientX - r.left, e.clientY - r.top);
      if ((mk && mk.p.num) !== (hot && hot.p.num)) setHot(mk ? mk.p.num : null);
    });
    host.addEventListener('pointerleave', () => { if (document.activeElement !== host) setHot(null); });
    host.addEventListener('click', e => {
      const r = host.getBoundingClientRect(), mk = nearest(e.clientX - r.left, e.clientY - r.top);
      if (mk) openBackpack(mk.p.num, { focusList: true });
    });
    host.addEventListener('keydown', e => {
      const i = hot ? order.indexOf(hot.p) : -1;
      let j = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = Math.min(order.length - 1, i + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = Math.max(0, i - 1);
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = order.length - 1;
      else if ((e.key === 'Enter' || e.key === ' ') && hot) { e.preventDefault(); openBackpack(hot.p.num, { focusList: true }); return; }
      else if (e.key === 'Escape') { setHot(null); return; }
      if (j == null) return;
      e.preventDefault();
      const p = order[Math.max(0, j)];
      setHot(p.num);
      live.textContent = `${p.name}, level ${p.level}, carry capacity plus ${p.ccBase}${p.ccMax > p.ccBase ? ` to plus ${p.ccMax}` : ''}.`;
    });
    host.addEventListener('blur', () => setHot(null));
    new ResizeObserver(() => { if (host.clientWidth !== width) draw(); }).observe(host);
    return { draw };
  })();

  // ── Hero stats count up ──────────────────────────────────────────────
  if (!motion.matches) {
    $$('.hero-stats dd[data-count]').forEach((el, i) => {
      const target = Number(el.dataset.count), duration = 900 + i * 250, start = performance.now() + 250;
      el.textContent = '0';
      const tick = now => {
        const t = Math.min(1, Math.max(0, (now - start) / duration));
        el.textContent = String(Math.round((1 - Math.pow(1 - t, 3)) * target));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  // ── Collectibles ─────────────────────────────────────────────────────
  const COLLECTIBLE_LOCATIONS = {
    GameStart: 'Game start', ConcordMuseumExt02: 'Concord Museum exterior', CabotHouse03: 'Cabot House', CambridgePD01: 'Cambridge Police Station',
    BackpackRoom: 'Boston Backpacks HQ', VaultTecOffice01: 'Vault-Tec offices', Vault81: 'Vault 81', DLC03Vault118: 'Vault 118'
  };
  // Magazine shorthand clarified by the mod author on 2026-09-07.
  const COLLECTIBLE_EFFECT_LABELS = {
    '+1 CHR': '+1 Charisma', '+10% Energy': '+10% energy damage', '+10% Guns': '+10% gun damage', '+10% Sneak': '+10% sneak',
    '+5RR': '+5 radiation resistance', '+5DR': '+5 damage resistance', '+BP': 'Aesthetic · no stat bonus',
    '+20PACC': '+20 Power Armor carry capacity', '+PACC': 'Power Armor carry capacity bonus', '+SpawnRate': 'Small increase to backpack spawn rate'
  };
  const collectibleLocation = item => COLLECTIBLE_LOCATIONS[item.locationId] || item.locationId;
  const collectibleEffects = item => [...new Set(item.effects)]
    .filter(effect => effect !== '+PACC' || !item.effects.includes('+20PACC'))
    .map(effect => COLLECTIBLE_EFFECT_LABELS[effect] || effect);
  const shortName = item => item.type === 'bobbleheads'
    ? item.name.replace(/^Vault-Tec Backpack /, '').replace(/ Bobblehead$/, '')
    : item.name.replace(/^Backpacks of the /, '');
  function shelfHTML(type) {
    return COLLECTIBLES.filter(item => item.type === type).map(item => `<li><button type="button" class="cb" data-row="${item.sourceRow}" aria-label="${esc(item.name)}: effects and location">
      <span class="cb-img">${item.thumbnail ? `<img src="${esc(item.thumbnail)}" alt="" loading="lazy" decoding="async">` : ''}</span>
      <span class="cb-body">
        <span class="cb-kicker">${type === 'bobbleheads' ? 'Vault-Tec bobblehead' : 'Backpacks of the…'}</span>
        <span class="cb-name">${esc(shortName(item))}</span>
        <span class="cb-fx">${collectibleEffects(item).map(fx => `<span class="tag ${fx.startsWith('+') ? 'pos' : ''}">${esc(fx)}</span>`).join('')}</span>
        <span class="cb-loc">${esc(collectibleLocation(item))}</span>
      </span>
    </button></li>`).join('');
  }
  $('#shelf-bobbleheads').innerHTML = shelfHTML('bobbleheads');
  $('#shelf-magazines').innerHTML = shelfHTML('magazines');
  const dialog = $('#collectible-dialog');
  function openCollectible(row, opener) {
    const item = COLLECTIBLES.find(entry => entry.sourceRow === row);
    if (!item) return;
    const bobble = item.type === 'bobbleheads';
    const unexpanded = item.effects.some(effect => !COLLECTIBLE_EFFECT_LABELS[effect]);
    dialog.innerHTML = `<div class="cd">
      <button type="button" class="cd-close" aria-label="Close details" autofocus>×</button>
      <p class="eyebrow">${bobble ? 'Vault-Tec backpack upgrade' : 'Magazine'}</p>
      <h2 id="collectible-dialog-title">${esc(item.name)}</h2>
      ${bobble ? '<p>One of the four upgrade bobbleheads for the <a href="#bp-25" data-close>Vault-Tec Utility Backpack</a>.</p>' : item.effects.includes('+BP') ? '<p>An aesthetic introduction to the mod, showing that it is installed and backpacks will appear in the game. This magazine gives no stat bonus.</p>' : ''}
      <h3>${bobble ? 'Upgrade effect' : 'Effects'}</h3>
      <p class="cb-fx">${collectibleEffects(item).map(fx => `<span class="tag ${fx.startsWith('+') ? 'pos' : ''}">${esc(fx)}</span>`).join('')}</p>
      ${unexpanded ? '<p class="cd-id">Some effects use the source sheet’s shorthand; exact bonuses have not been expanded.</p>' : ''}
      <h3>${item.locationId === 'GameStart' ? 'Acquisition' : 'World location'}</h3>
      <p>${esc(collectibleLocation(item))}</p>
      <p class="cd-id">${item.locationId === 'GameStart' ? 'Available at game start.' : `Location ID: ${esc(item.locationId)}`}</p>
      ${item.locationImage ? `<figure><figcaption>${esc(item.locationHint)}</figcaption><a href="${esc(item.locationImage)}" target="_blank" rel="noopener" aria-label="Open the full-size location photo"><img src="${esc(item.locationImage)}" alt="${esc(`${item.name} ${item.locationHint} at ${collectibleLocation(item)}`)}" width="640" height="640"></a></figure>` : ''}
    </div>`;
    dialog.dataset.opener = opener ? String(row) : '';
    $('.cd-close', dialog).addEventListener('click', () => dialog.close());
    document.body.classList.add('dialog-open');
    dialog.showModal();
    dialog.scrollTop = 0;
  }
  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    const opener = dialog.dataset.opener && $(`.cb[data-row="${dialog.dataset.opener}"]`);
    opener?.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { dialog.close(); return; }
    const r = dialog.getBoundingClientRect();
    if (e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) dialog.close();
  });
  $$('.shelf-row').forEach(row => row.addEventListener('click', e => {
    const button = e.target.closest('.cb');
    if (button) openCollectible(Number(button.dataset.row), true);
  }));

  // ── Navigation: section tabs, deep links, lazy map ───────────────────
  const navLinks = $$('.topnav a, .tabbar a');
  const sections = ['inventory', 'field-map', 'collectibles', 'prototype'].map(id => document.getElementById(id));
  const spy = new IntersectionObserver(() => {
    const line = innerHeight * 0.35;
    let current = null;
    for (const s of sections) { const r = s.getBoundingClientRect(); if (r.top <= line && r.bottom > line) current = s.id; }
    navLinks.forEach(a => { if (a.dataset.section === current) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1], rootMargin: '-30% 0px -60% 0px' });
  sections.forEach(s => spy.observe(s));
  new IntersectionObserver((entries, observer) => {
    if (entries.some(e => e.isIntersecting)) { window.catalogMap?.show(); observer.disconnect(); }
  }, { rootMargin: '600px 0px' }).observe($('#field-map'));
  function fromHash() {
    const m = /^#bp-(\d{1,2})$/.exec(location.hash);
    if (!m || !byNum.has(Number(m[1]))) return false;
    openBackpack(Number(m[1]));
    return true;
  }
  window.addEventListener('hashchange', fromHash);
  $$('[data-open-about]').forEach(b => b.addEventListener('click', () => $('#help-btn')?.click()));

  // ── Start ────────────────────────────────────────────────────────────
  renderList();
  select(state.selected, { scroll: false, announce: false });
  chart.draw();
  if (location.hash) requestAnimationFrame(() => fromHash());
})();
