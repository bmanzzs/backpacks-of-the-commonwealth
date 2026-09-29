// Pip-Boy 3000 Mk IV emulator for the Backpacks of the Commonwealth catalog.
// Data: backpacks-data.js (BACKPACKS, OMODS, IMGS) and collectibles-data.js (COLLECTIBLES).
// The page never scrolls: every list scrolls inside the screen, so nothing traps the wheel.
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2 = n => String(n).padStart(2, '0');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sum = (a, f = x => x) => a.reduce((t, x) => t + f(x), 0);
  const signed = n => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 699px), (max-aspect-ratio: 4/5)');
  const hoverPointer = matchMedia('(hover: hover) and (pointer: fine)');
  const ico = (id, cls = '') => `<svg class="ico ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;

  // ── Saved state ───────────────────────────────────────────────────────
  const KEY = 'pipboy.v1';
  const S = { equip: null, mods: {}, found: [], level: null, special: null, perks: {}, tags: [], track: 'main', color: 'green', fx: true, sound: false, light: false, sort: 'num' };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY)) || {}); } catch { /* storage unavailable */ }
  if (S.level == null) { try { const l = Number(localStorage.getItem('botc-level')); if (l >= 1 && l <= 99) S.level = l; } catch { /* ignore */ } }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage unavailable */ } };
  const found = new Set(S.found);
  const isFound = key => found.has(key);
  function setFound(key, on) {
    if (on) found.add(key); else found.delete(key);
    S.found = [...found]; save();
  }

  // ── Derived data ──────────────────────────────────────────────────────
  const SPECIALS = [['STR', 'Strength'], ['PER', 'Perception'], ['END', 'Endurance'], ['CHA', 'Charisma'], ['INT', 'Intelligence'], ['AGI', 'Agility'], ['LCK', 'Luck']];
  const SP_KEY = Object.fromEntries(SPECIALS.map(([k, n]) => [n.toLowerCase(), k]));
  const SP_NAME = Object.fromEntries(SPECIALS);
  if (!S.special) S.special = Object.fromEntries(SPECIALS.map(([k]) => [k, 1]));
  const sentences = t => t.split(/(?<=\.)\s+/).map(s => s.trim().replace(/\.$/, '')).filter(Boolean);
  const values = (t, unit) => [...t.matchAll(new RegExp(`\\+(\\d+)\\s*${unit}\\b`, 'g'))].map(m => Number(m[1]));
  const roman = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
  // Base-game perk requirements, used to warn when a SPECIAL is too low.
  const PERK_INFO = {
    'Armorer': ['STR', 3, 4], 'Big Leagues': ['STR', 2, 5], 'Strong Back': ['STR', 6, 4], 'Rifleman': ['PER', 2, 5],
    'Toughness': ['END', 1, 5], 'Lead Belly': ['END', 2, 3], 'Local Leader': ['CHA', 6, 2], 'Medic': ['INT', 2, 4],
    'Gun Nut': ['INT', 3, 4], 'Science!': ['INT', 6, 4], 'Chemist': ['INT', 7, 4], 'Commando': ['AGI', 2, 5],
    'Sneak': ['AGI', 3, 5], 'Ninja': ['AGI', 7, 3]
  };
  const perkOf = text => { const m = text.trim().match(/^(.*?)\s+(I|II|III|IV|V)$/); return m ? { family: m[1], rank: roman[m[2]], label: text.trim() } : { family: text.trim(), rank: 1, label: text.trim() }; };
  function effects(desc) {
    const fx = { cc: 0, dr: 0, er: 0, rr: 0, hp: 0, ap: 0, sp: {}, notes: [] };
    for (const s of sentences(desc)) {
      let m;
      if ((m = s.match(/carry capacity by \+(\d+)/i))) fx.cc = Number(m[1]);
      else if ((m = s.match(/^([+\-−]\d+) (Strength|Perception|Endurance|Charisma|Intelligence|Agility|Luck)$/i))) fx.sp[SP_KEY[m[2].toLowerCase()]] = Number(m[1].replace('−', '-'));
      else if ((m = s.match(/^(Damage|Energy|Rad) resistance \+(\d+)$/i))) fx[{ damage: 'dr', energy: 'er', rad: 'rr' }[m[1].toLowerCase()]] += Number(m[2]);
      else if ((m = s.match(/^\+(\d+) additional damage resistance and rad resistance$/i))) { fx.dr += Number(m[1]); fx.rr += Number(m[1]); }
      else if ((m = s.match(/^\+(\d+) Rad Resist and \+(\d+) Energy Resist$/i))) { fx.rr += Number(m[1]); fx.er += Number(m[2]); }
      else if ((m = s.match(/^\+(\d+) max HP and \+(\d+) max AP$/i))) { fx.hp += Number(m[1]); fx.ap += Number(m[2]); }
      else fx.notes.push(s);
    }
    return fx;
  }
  const part = p => { const m = p.match(/^(.*?)\s*×\s*(\d+)$/); return m ? { name: m[1].trim(), qty: Number(m[2]) } : { name: p.trim(), qty: 1 }; };
  const MODS = [];
  const PACKS = BACKPACKS.map((bp, idx) => {
    const om = OMODS[bp.id] || { cc: [], dr: [] };
    const [edid, ...rest] = bp.location.split(' — ');
    const ccList = (bp.cc.match(/\d+/g) || [0]).map(Number);
    const recipe = bp.crafting.split(' · ');
    const pack = {
      num: bp.num, idx, bp, id: bp.id, name: bp.name, level: bp.level, img: IMGS[idx],
      place: rest.length ? rest.join(' — ').trim() : bp.location, edid: rest.length ? edid.trim() : '',
      weight: parseFloat(bp.weight) || 0, value: parseInt(bp.value, 10) || 0, colors: bp.colors,
      ccBase: ccList[0], fixed: { dr: values(bp.dr, 'DR')[0] || 0, er: values(bp.dr, 'ER')[0] || 0, rr: values(bp.dr, 'RR')[0] || 0 },
      basePerks: ((bp.crafting.match(/\[([^\]]+)\]/) || [, ''])[1]).split(',').map(s => s.trim()).filter(Boolean).map(perkOf),
      parts: recipe.filter(p => !p.startsWith('[')).map(part),
      flavor: sentences(bp.desc).filter(s => !/carry capacity/i.test(s) && !/^[+\-−]\d+ \w+$/.test(s))
    };
    const mk = (m, slot, i) => ({ key: `${bp.num}.${slot}${i}`, pack, slot, i, name: m.name, desc: m.desc, fx: effects(m.desc), perks: (m.perks || []).map(perkOf), parts: (m.ingredients || []).map(part) });
    pack.ccMods = (om.cc || []).map((m, i) => mk(m, 'cc', i));
    pack.drMods = (om.dr || []).map((m, i) => mk(m, 'dr', i));
    pack.mods = [...pack.ccMods, ...pack.drMods];
    MODS.push(...pack.mods);
    pack.ccMax = Math.max(pack.ccBase, ...ccList, ...pack.ccMods.map(m => m.fx.cc));
    pack.drMax = Math.max(pack.fixed.dr, ...values(bp.dr, 'DR'), ...pack.drMods.map(m => m.fx.dr));
    return pack;
  });
  const byNum = new Map(PACKS.map(p => [p.num, p]));
  const modByKey = new Map(MODS.map(m => [m.key, m]));
  const CC_TOP = Math.max(...PACKS.map(p => p.ccMax));
  const DR_TOP = Math.max(...PACKS.map(p => p.drMax));

  // Collectibles: magazines first, then bobbleheads, in sheet order.
  const PLACES = { GameStart: 'Game start', ConcordMuseumExt02: 'Concord Museum exterior', CabotHouse03: 'Cabot House', CambridgePD01: 'Cambridge Police Station', BackpackRoom: 'Boston Backpacks HQ', VaultTecOffice01: 'Vault-Tec offices', Vault81: 'Vault 81', DLC03Vault118: 'Vault 118 (Far Harbor)' };
  const FX_LABEL = { '+1 CHR': '+1 Charisma', '+10% Energy': '+10% energy damage', '+10% Guns': '+10% gun damage', '+10% Sneak': '+10% sneak', '+5RR': '+5 Rad Resistance', '+5DR': '+5 Damage Resistance', '+BP': 'Aesthetic issue · no stat bonus', '+20PACC': '+20 Power Armor carry capacity', '+PACC': 'Power Armor carry capacity bonus', '+SpawnRate': 'Backpacks turn up a little more often' };
  const ITEMS = COLLECTIBLES.map(c => {
    const mag = c.type === 'magazines';
    const fx = [...new Set(c.effects)].filter((e, _, all) => !(e === '+PACC' && all.includes('+20PACC'))).map(e => FX_LABEL[e] || e);
    return { key: `${mag ? 'mag' : 'bob'}-${c.sourceRow}`, mag, c, name: c.name, img: c.thumbnail, photo: c.locationImage, hint: c.locationHint, place: PLACES[c.locationId] || c.locationId, edid: c.locationId, fx, raw: c.effects };
  }).sort((a, b) => (a.mag === b.mag ? a.c.sourceRow - b.c.sourceRow : a.mag ? -1 : 1));
  const itemByKey = new Map(ITEMS.map(i => [i.key, i]));

  // Ingredients across base recipes and mods.
  const AID = /^(Nuka-|Purified Water|Psycho|Jet|Med-X|Mentats|Stimpak|RadAway|Rad-X|Buffout)/;
  const AMMO = /^Fusion (Cell|Core)$/;
  const PARTS = new Map();
  const usePart = (pt, source) => {
    if (/Bobblehead$/.test(pt.name)) return;
    const e = PARTS.get(pt.name) || { name: pt.name, qty: 0, uses: [], kind: AMMO.test(pt.name) ? 'ammo' : AID.test(pt.name) ? 'aid' : 'junk' };
    e.qty += pt.qty; e.uses.push({ ...source, qty: pt.qty });
    PARTS.set(pt.name, e);
  };
  PACKS.forEach(p => p.parts.forEach(pt => usePart(pt, { pack: p, mod: null })));
  MODS.forEach(m => m.parts.forEach(pt => usePart(pt, { pack: m.pack, mod: m })));
  const partsOf = kind => [...PARTS.values()].filter(e => e.kind === kind).sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));

  // Perk families referenced by mods and base recipes.
  const PERKS = new Map();
  const notePerk = (pk, mod) => {
    const e = PERKS.get(pk.family) || { name: pk.family, ranks: {}, mods: [], packs: new Set() };
    e.ranks[pk.rank] = (e.ranks[pk.rank] || 0) + (mod ? 1 : 0);
    if (mod) e.mods.push({ mod, rank: pk.rank });
    PERKS.set(pk.family, e);
  };
  MODS.forEach(m => m.perks.forEach(pk => notePerk(pk, m)));
  PACKS.forEach(p => p.basePerks.forEach(pk => { notePerk(pk, null); PERKS.get(pk.family).packs.add(p); }));
  const PERK_LIST = [...PERKS.values()].map(e => ({ ...e, special: PERK_INFO[e.name]?.[0] || '', req: PERK_INFO[e.name]?.[1] || 1, max: Math.max(PERK_INFO[e.name]?.[2] || 1, ...Object.keys(e.ranks).map(Number)) }))
    .sort((a, b) => SPECIALS.findIndex(s => s[0] === a.special) - SPECIALS.findIndex(s => s[0] === b.special) || a.req - b.req || a.name.localeCompare(b.name));
  const perkByName = new Map(PERK_LIST.map(p => [p.name, p]));
  const rankOf = family => Number(S.perks[family] || 0);
  const hasPerks = list => list.every(pk => rankOf(pk.family) >= pk.rank);
  const craftable = m => hasPerks(m.perks);
  const missing = list => list.filter(pk => rankOf(pk.family) < pk.rank).map(pk => pk.label);

  // ── Equipment and player stats ────────────────────────────────────────
  const cfgOf = p => ({ cc: clamp(Number(S.mods[p.num]?.cc) || 0, 0, Math.max(0, p.ccMods.length - 1)), dr: clamp(Number(S.mods[p.num]?.dr) || 0, 0, Math.max(0, p.drMods.length - 1)) });
  function packStats(p) {
    const cfg = cfgOf(p), cm = p.ccMods[cfg.cc], dm = p.drMods[cfg.dr];
    const st = { cc: cm ? cm.fx.cc : p.ccBase, dr: 0, er: 0, rr: 0, hp: 0, ap: 0, sp: {}, notes: [], weight: p.weight, value: p.value, cm, dm };
    const base = dm ? dm.fx : p.fixed;
    st.dr = base.dr; st.er = base.er; st.rr = base.rr;
    if (cm) { st.dr += cm.fx.dr; st.er += cm.fx.er; st.rr += cm.fx.rr; st.hp += cm.fx.hp; st.ap += cm.fx.ap; Object.assign(st.sp, cm.fx.sp); st.notes.push(...cm.fx.notes); }
    if (dm) st.notes.push(...dm.fx.notes);
    return st;
  }
  const equipped = () => byNum.get(S.equip) || null;
  function player() {
    const p = equipped(), st = p ? packStats(p) : { cc: 0, dr: 0, er: 0, rr: 0, hp: 0, ap: 0, sp: {}, notes: [], weight: 0, value: 0 };
    const mags = ITEMS.filter(i => i.mag && isFound(i.key));
    const extra = { dr: mags.filter(i => i.raw.includes('+5DR')).length * 5, rr: mags.filter(i => i.raw.includes('+5RR')).length * 5, pa: mags.filter(i => i.raw.includes('+20PACC')).length * 20 };
    const sp = Object.fromEntries(SPECIALS.map(([k]) => [k, clamp(Number(S.special[k]) || 1, 1, 10) + (st.sp[k] || 0)]));
    return { p, st, dr: st.dr + extra.dr, er: st.er, rr: st.rr + extra.rr, pa: extra.pa, sp, carry: 200 + 10 * sp.STR + st.cc };
  }
  const LEVELS = [...new Set(PACKS.map(p => p.level))].sort((a, b) => a - b);
  const locked = p => S.level != null && p.level > S.level;

  // ── Sound (synthesised, off until asked for) ──────────────────────────
  let ac = null;
  function audio() {
    if (!S.sound) return null;
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch { return null; }
    return ac;
  }
  function tone(freq, dur = 0.05, type = 'square', gain = 0.04, when = 0, slide = 0) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur = 0.06, gain = 0.05, when = 0, freq = 1800) {
    const a = audio(); if (!a) return;
    const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = gain;
    s.buffer = buf; s.connect(f).connect(g).connect(a.destination); s.start(a.currentTime + when);
  }
  const sfx = {
    tab() { noise(0.07, 0.09, 0, 900); tone(90, 0.09, 'triangle', 0.08); },
    sub() { noise(0.03, 0.05, 0, 2600); },
    tick() { tone(2400, 0.015, 'square', 0.015); },
    ok() { tone(880, 0.06, 'square', 0.03); tone(1320, 0.08, 'square', 0.03, 0.06); },
    off() { tone(660, 0.06, 'square', 0.03); tone(440, 0.09, 'square', 0.03, 0.06); },
    bad() { tone(110, 0.14, 'sawtooth', 0.04); },
    quest() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.05, i * 0.11)); }
  };

  // ── Tabs, sub-tabs and routing ────────────────────────────────────────
  const TABS = ['stat', 'inv', 'data', 'map', 'radio'];
  const SUBS = { stat: ['status', 'special', 'perks'], inv: ['weapons', 'apparel', 'aid', 'misc', 'junk', 'mods', 'ammo'], data: ['quests', 'workshops', 'stats'], map: ['world', 'local'], radio: [''] };
  const SUB_LABEL = { world: 'WORLD MAP', local: 'LOCAL MAP' };
  const DEFAULT_SUB = { stat: 'status', inv: 'apparel', data: 'quests', map: 'world', radio: '' };
  const lastSub = { ...DEFAULT_SUB };
  const selected = {};           // view id → selected item key
  const route = { tab: 'stat', sub: 'status' };
  const viewId = () => `${route.tab}/${route.sub}`;
  const ui = $('#ui'), view = $('#view'), mapSection = $('#view-map'), tabsEl = $('#tabs'), strip = $('#subtabs-strip');
  const barEl = $('#bar'), hintsEl = $('#hints'), toastsEl = $('#toasts'), modal = $('#modal');
  let modFilter = null;          // { label, test(mod) } for INV › MODS
  let sheetOpen = false;

  function go(tab, sub, key, opts = {}) {
    if (!TABS.includes(tab)) tab = 'stat';
    if (!SUBS[tab].includes(sub)) sub = lastSub[tab];
    const changedTab = tab !== route.tab, changedSub = changedTab || sub !== route.sub;
    if (route.tab === 'map' && route.sub === 'world' && !(tab === 'map' && sub === 'world')) window.catalogMap?.hide();
    route.tab = tab; route.sub = sub; lastSub[tab] = sub;
    if (key != null) selected[viewId()] = String(key);
    closeSheet(false);
    if (!opts.silent) (changedTab ? sfx.tab : changedSub ? sfx.sub : () => {})();
    if (changedTab && !opts.silent && navigator.vibrate && narrow.matches) navigator.vibrate(8);
    render(changedTab ? 'tab' : changedSub ? 'sub' : 'item');
    if (key != null && opts.open && narrow.matches) openSheet();
  }
  function syncHash() {
    const key = selected[viewId()];
    const hash = `#${route.tab}${route.sub ? `/${route.sub}` : ''}${key != null && route.sub !== 'status' ? `/${encodeURIComponent(key)}` : ''}`;
    if (location.hash !== hash) { try { history.replaceState(history.state, '', hash); } catch { /* sandboxed */ } }
  }
  function readHash() {
    const parts = location.hash.slice(1).split('/').map(s => { try { return decodeURIComponent(s || ''); } catch { return ''; } });
    const tab = parts[0];
    if (!TABS.includes(tab)) return false;
    const [sub, key] = tab === 'radio' ? ['', parts[1]] : [parts[1], parts[2]];
    route.tab = tab; route.sub = SUBS[tab].includes(sub) ? sub : DEFAULT_SUB[tab]; lastSub[tab] = route.sub;
    if (key) selected[viewId()] = key;
    return true;
  }

  function renderTabs() {
    $$('.tab', tabsEl).forEach(b => { const on = b.dataset.tab === route.tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    placeNotch();
    const subs = SUBS[route.tab].filter(Boolean);
    strip.innerHTML = subs.map(s => `<button type="button" class="subtab" role="tab" data-sub="${s}" aria-selected="${s === route.sub}" tabindex="${s === route.sub ? 0 : -1}">${SUB_LABEL[s] || s.toUpperCase()}</button>`).join('');
    placeStrip(false);
  }
  function placeNotch() {
    const active = $('.tab[aria-selected="true"]', tabsEl);
    if (!active) return;
    const pad = parseFloat(getComputedStyle(active).fontSize) * 0.55;
    tabsEl.style.setProperty('--nl', `${active.offsetLeft - pad}px`);
    tabsEl.style.setProperty('--nr', `${active.offsetLeft + active.offsetWidth + pad}px`);
    tabsEl.style.setProperty('--nc', `${active.offsetLeft + active.offsetWidth / 2}px`);
  }
  // The strip slides so the selected sub-tab sits under the active tab; neighbours fade by distance.
  function placeStrip(animate = true) {
    const buttons = $$('.subtab', strip), i = buttons.findIndex(b => b.dataset.sub === route.sub);
    if (i < 0) { strip.style.transform = ''; return; }
    const sel = buttons[i], box = strip.parentElement.getBoundingClientRect(), tabs = tabsEl.getBoundingClientRect();
    const anchor = tabs.left - box.left + (parseFloat(tabsEl.style.getPropertyValue('--nc')) || box.width / 2);
    let x = anchor - (sel.offsetLeft + sel.offsetWidth / 2);
    // Keep the whole strip on screen when it fits; otherwise keep the selected sub-tab clear of the edge fade.
    const lo = box.width * 0.03, hi = box.width * 0.97;
    if (strip.scrollWidth <= hi - lo) x = clamp(x, lo, hi - strip.scrollWidth);
    else x = clamp(x, lo - sel.offsetLeft, hi - sel.offsetLeft - sel.offsetWidth);
    strip.classList.toggle('no-anim', !animate || motion.matches);
    strip.style.transform = `translateX(${Math.round(x)}px)`;
    buttons.forEach((b, j) => { b.style.setProperty('--fade', [1, 0.5, 0.3][Math.abs(j - i)] ?? 0.15); });
  }

  // ── Generic list + detail view ────────────────────────────────────────
  let current = null;            // the view config being shown
  let items = [];
  function render(kind = 'item') {
    if (route.tab !== 'radio') leaveRadio();
    renderTabs();
    const id = viewId();
    const cfg = VIEWS[id];
    current = cfg;
    ui.dataset.tab = route.tab; ui.dataset.view = id.replace('/', '-');
    const isMap = id === 'map/world';
    mapSection.hidden = !isMap; view.hidden = isMap;
    if (kind !== 'item') blink();
    if (isMap) { view.innerHTML = ''; items = []; cfg.enter?.(); }
    else if (cfg.custom) { items = []; view.innerHTML = cfg.custom(); cfg.mounted?.(); }
    else {
      items = cfg.items();
      const sel = selected[id];
      const valid = key => key != null && items.some(it => !it.group && it.key === key);
      if (!valid(sel)) { const first = cfg.initial?.(items); selected[id] = valid(first) ? first : items.find(it => !it.group)?.key ?? null; }
      view.innerHTML = `<div class="split${cfg.wide ? ' is-wide' : ''}">
        <div class="list-col">
          ${cfg.head ? `<div class="list-head">${cfg.head()}</div>` : ''}
          <div class="list-scroll"><ul class="list" id="list" role="listbox" tabindex="0" aria-label="${esc(cfg.label || route.sub)}">${items.map(rowHTML).join('')}</ul>${items.length ? '' : `<p class="list-empty">${esc(cfg.empty || 'Nothing here.')}</p>`}</div>
          <span class="more more-up" aria-hidden="true">▲</span><span class="more more-down" aria-hidden="true">▼</span>
        </div>
        <div class="detail" id="detail" aria-live="polite"></div>
      </div>`;
      bindList();
      renderDetail(false);
    }
    renderBar(); renderHints();
    syncHash();
  }
  function rowHTML(it) {
    if (it.group) return `<li class="row-group" role="presentation">${esc(it.group)}</li>`;
    const mark = it.mark === 'on' ? '<span class="mark is-on"></span>' : it.mark === 'off' ? '<span class="mark is-off"></span>' : it.mark === 'diamond' ? '<span class="mark is-diamond"></span>' : '<span class="mark"></span>';
    return `<li class="row${it.dim ? ' is-dim' : ''}" role="option" id="row-${cssId(it.key)}" data-key="${esc(it.key)}" aria-selected="false">${mark}<span class="row-label">${esc(it.label)}${it.count > 1 ? ` <span class="row-count">(${it.count})</span>` : ''}${it.tag ? ` <span class="row-tag">${it.tag}</span>` : ''}</span>${it.right != null ? `<span class="row-right">${esc(it.right)}</span>` : ''}</li>`;
  }
  const cssId = key => String(key).replace(/[^a-zA-Z0-9_-]/g, '_');
  function bindList() {
    const list = $('#list'), scroller = $('.list-scroll');
    // Hovering selects, as in the game, after a short dwell so a mouse sweeping across
    // the list towards the action buttons doesn't change the selection on the way.
    let dwell = 0, dwellKey = null;
    list.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || !hoverPointer.matches) return;
      const key = e.target.closest('.row')?.dataset.key;
      if (key === dwellKey) return;
      clearTimeout(dwell); dwellKey = key;
      if (key != null && key !== selected[viewId()]) dwell = setTimeout(() => { if (list.isConnected && dwellKey === key) choose(key, { scroll: false }); }, 110);
    });
    list.addEventListener('pointerleave', () => { clearTimeout(dwell); dwellKey = null; });
    list.addEventListener('click', e => {
      const row = e.target.closest('.row'); if (!row) return;
      choose(row.dataset.key, { scroll: false });
      if (narrow.matches) openSheet();
    });
    list.addEventListener('dblclick', e => { if (e.target.closest('.row') && !narrow.matches) primary(); });
    scroller.addEventListener('scroll', updateMore, { passive: true });
    updateMore();
  }
  function updateMore() {
    const s = $('.list-scroll'); if (!s) return;
    const col = s.parentElement;
    col.classList.toggle('can-up', s.scrollTop > 2);
    col.classList.toggle('can-down', s.scrollTop + s.clientHeight < s.scrollHeight - 2);
  }
  function choose(key, { scroll = true } = {}) {
    if (key == null) return;
    selected[viewId()] = String(key);
    sfx.tick();
    renderDetail(scroll);
    renderHints(); renderBar(); syncHash();
  }
  function markRows(scroll) {
    const key = selected[viewId()], list = $('#list');
    if (!list) return;
    $$('.row', list).forEach(r => r.setAttribute('aria-selected', String(r.dataset.key === key)));
    const row = key != null && $(`#row-${cssId(key)}`, list);
    if (row) list.setAttribute('aria-activedescendant', row.id); else list.removeAttribute('aria-activedescendant');
    if (row && scroll) {
      // Keep the selection two rows from either edge, like the Pip-Boy.
      const s = $('.list-scroll'), pitch = row.offsetHeight, top = row.offsetTop - s.offsetTop;
      if (top < s.scrollTop + pitch * 2) s.scrollTop = top - pitch * 2;
      else if (top + pitch > s.scrollTop + s.clientHeight - pitch * 2) s.scrollTop = top + pitch * 3 - s.clientHeight;
    }
  }
  function renderDetail(scroll = true) {
    markRows(scroll);
    const detail = $('#detail'); if (!detail) return;
    const it = currentItem();
    detail.innerHTML = `${narrow.matches ? '<button type="button" class="sheet-back" data-act="back">◂ BACK</button>' : ''}${it ? current.detail(it) : `<p class="empty-detail">${esc(current.empty || '')}</p>`}`;
    current.afterDetail?.(it, detail);
  }
  const currentItem = () => items.find(i => !i.group && i.key === selected[viewId()]) || null;
  function step(d) {
    const rows = items.filter(i => !i.group);
    if (!rows.length) return;
    const i = rows.findIndex(r => r.key === selected[viewId()]);
    const next = d === 'home' ? 0 : d === 'end' ? rows.length - 1 : clamp((i < 0 ? 0 : i) + d, 0, rows.length - 1);
    choose(rows[next].key);
  }
  function refresh() {
    // Re-render the current view in place (after equip, found, etc.), keeping list scroll.
    const s = $('.list-scroll'), top = s?.scrollTop || 0, detailTop = $('#detail')?.scrollTop || 0;
    const wasOpen = sheetOpen;
    render('item');
    if ($('.list-scroll')) $('.list-scroll').scrollTop = top;
    if ($('#detail')) $('#detail').scrollTop = detailTop;
    if (wasOpen && narrow.matches) openSheet(false);
  }
  function openSheet(push = true) {
    const d = $('#detail'); if (!d || !narrow.matches) return;
    d.classList.add('is-open'); sheetOpen = true; ui.classList.add('has-sheet');
    if (push) { try { history.pushState({ sheet: true }, '', location.href); } catch { /* ignore */ } }
    $('.sheet-back', d)?.focus({ preventScroll: true });
  }
  function closeSheet(viaBack = true) {
    if (!sheetOpen) return;
    $('#detail')?.classList.remove('is-open'); sheetOpen = false; ui.classList.remove('has-sheet');
    if (viaBack && history.state?.sheet) history.back();
  }
  addEventListener('popstate', () => { if (sheetOpen) { $('#detail')?.classList.remove('is-open'); sheetOpen = false; ui.classList.remove('has-sheet'); $('#list')?.focus({ preventScroll: true }); } });

  function blink() {
    if (motion.matches) return;
    ui.classList.remove('is-blink'); void ui.offsetWidth; ui.classList.add('is-blink');
  }

  // ── Hints and the status bar ──────────────────────────────────────────
  let hintList = [];
  function renderHints() {
    const it = currentItem();
    hintList = (current?.hints?.(it) || []).filter(Boolean);
    hintsEl.innerHTML = hintList.map((h, i) => `<button type="button" class="hint" data-i="${i}"${h.disabled ? ' aria-disabled="true"' : ''}><span class="hint-key">${esc(h.k)})</span> ${esc(h.label)}</button>`).join('');
  }
  hintsEl.addEventListener('click', e => { const b = e.target.closest('.hint'); if (b) runHint(hintList[Number(b.dataset.i)]); });
  function runHint(h) { if (!h) return; if (h.disabled) { sfx.bad(); if (h.why) toast(h.why); return; } h.run(); }
  function primary() { runHint(hintList[0]); }

  function now2287() {
    const d = new Date();
    const date = `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}.2287`;
    let h = d.getHours() % 12; if (!h) h = 12;
    return { date, time: `${h}:${pad2(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}` };
  }
  const box = (html, cls = '') => `<div class="bar-box ${cls}">${html}</div>`;
  function levelBox() {
    const lv = S.level, next = lv == null ? LEVELS[0] : LEVELS.find(l => l > lv);
    const prev = lv == null ? 0 : [...LEVELS].reverse().find(l => l <= lv) || 0;
    const pct = lv == null ? 0 : next == null ? 100 : clamp((lv - prev) / (next - prev) * 100, 0, 100);
    const count = next == null ? 0 : PACKS.filter(p => p.level === next).length;
    return `<button type="button" class="bar-box bar-level" data-act="level" aria-label="Your level: ${lv ?? 'not set'}. Set level">
      <span>LEVEL ${lv ?? '--'}</span><span class="xp"><span class="xp-fill" style="width:${pct}%"></span></span>
      <span class="xp-next">${lv == null ? 'SET' : next == null ? 'ALL UNLOCKED' : `NEXT L${next} · ${count}`}</span></button>`;
  }
  function renderBar() {
    const pl = player(), t = now2287();
    const foundCount = PACKS.filter(p => isFound(`bp-${p.num}`)).length + ITEMS.filter(i => isFound(i.key)).length;
    let html;
    if (route.tab === 'stat') {
      html = box(`CC ${pl.st.cc}/${CC_TOP}`) + levelBox() + box(`FOUND ${foundCount}/${PACKS.length + ITEMS.length}`);
    } else if (route.tab === 'inv') {
      const value = sum(PACKS.filter(p => isFound(`bp-${p.num}`)), p => p.value);
      html = box(`${ico('weight')} ${pl.st.weight}/${pl.carry}`, 'is-wide') + box(`${ico('cap')} ${value.toLocaleString('en-US')}`) + box(`${ico('shield')} ${pl.dr} ${ico('bolt')} ${pl.er} ${ico('rad')} ${pl.rr}`, 'is-wide');
    } else {
      let where = '';
      if (route.tab === 'map') where = mapPlace || 'The Commonwealth';
      else if (route.tab === 'radio') where = playing ? STATIONS.find(s => s.id === playing)?.name || '' : 'No station playing';
      else { const q = QUESTS.find(q => q.id === S.track); const o = q?.objectives().find(o => !o.done()); where = o?.place || q?.name || ''; }
      html = box(t.date) + box(t.time) + box(esc(where), 'is-grow');
    }
    barEl.innerHTML = html;
  }
  barEl.addEventListener('click', e => { if (e.target.closest('[data-act="level"]')) levelDialog(); });
  setInterval(() => { if (route.tab !== 'stat' && route.tab !== 'inv') renderBar(); }, 30000);

  // ── Toasts and dialogs ────────────────────────────────────────────────
  function toast(text, kind = '') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`; el.textContent = text;
    toastsEl.append(el);
    while (toastsEl.children.length > 3) toastsEl.firstElementChild.remove();
    setTimeout(() => el.classList.add('is-out'), 2600);
    setTimeout(() => el.remove(), 3100);
  }
  function banner(title, sub) {
    const el = document.createElement('div');
    el.className = 'banner'; el.innerHTML = `<strong>${esc(title)}</strong>${sub ? `<span>${esc(sub)}</span>` : ''}`;
    ui.append(el); sfx.quest();
    setTimeout(() => el.remove(), 3200);
  }
  let modalReturn = null, modalClose = null;
  function openModal(html, { onClose, label = 'Dialog' } = {}) {
    modalReturn = document.activeElement;
    modal.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;
    modal.hidden = false; modalClose = onClose || null;
    ($('[autofocus]', modal) || $('button, input, a', modal))?.focus();
  }
  function closeModal() {
    if (modal.hidden) return;
    modal.hidden = true; modal.innerHTML = ''; modalClose?.(); modalClose = null;
    modalReturn?.focus?.({ preventScroll: true });
  }
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-act="close"]')) closeModal(); });
  function levelDialog() {
    openModal(`<h2>SET LEVEL</h2>
      <p>Backpacks above your level are dimmed. The XP bar counts up to the next unlock.</p>
      <form class="level-form"><button type="button" data-d="-1" aria-label="Lower">−</button><input id="level-input" type="number" inputmode="numeric" min="1" max="99" value="${S.level ?? ''}" placeholder="--" aria-label="Your level" autofocus><button type="button" data-d="1" aria-label="Raise">+</button></form>
      <div class="modal-actions"><button type="button" data-act="clear">Clear</button><button type="button" data-act="close">Cancel</button><button type="button" data-act="ok" class="is-primary">Accept</button></div>`, { label: 'Set level' });
    const input = $('#level-input', modal);
    const accept = () => { const v = Number(input.value); S.level = input.value === '' ? null : clamp(Math.round(v) || 1, 1, 99); try { S.level == null ? localStorage.removeItem('botc-level') : localStorage.setItem('botc-level', S.level); } catch { /* ignore */ } save(); closeModal(); sfx.ok(); refresh(); refreshMapPins(); };
    $('.level-form', modal).addEventListener('submit', e => { e.preventDefault(); accept(); });
    $('.level-form', modal).addEventListener('click', e => { const d = Number(e.target.closest('[data-d]')?.dataset.d); if (d) { input.value = clamp((Number(input.value) || S.level || 1) + d, 1, 99); sfx.tick(); } });
    $('[data-act="ok"]', modal).addEventListener('click', accept);
    $('[data-act="clear"]', modal).addEventListener('click', () => { input.value = ''; accept(); });
  }
  function photoDialog(src, title, caption) {
    openModal(`<h2>${esc(title)}</h2><figure class="photo"><img src="${esc(src)}" alt="${esc(caption || title)}"></figure>${caption ? `<p>${esc(caption)}</p>` : ''}<div class="modal-actions"><a href="${esc(src)}" target="_blank" rel="noopener">Open full size</a><button type="button" data-act="close" class="is-primary" autofocus>Close</button></div>`, { label: title });
  }
  function helpDialog() {
    openModal(`<h2>CONTROLS</h2>
      <dl class="keys">
        <dt>1–5 · Shift+←/→</dt><dd>STAT, INV, DATA, MAP, RADIO</dd>
        <dt>←/→ · A/D</dt><dd>Sub-sections</dd>
        <dt>↑/↓ · W/S · Home/End</dt><dd>Move through a list (the mouse wheel scrolls it)</dd>
        <dt>Enter · E</dt><dd>The first action at the bottom of the screen</dd>
        <dt>Letters</dt><dd>Every other action shows its key, like <b>M) Show on Map</b></dd>
        <dt>Esc</dt><dd>Close a dialog, a filter, or the detail sheet</dd>
        <dt>\`</dt><dd>CRT effects on or off</dd>
        <dt>Map</dt><dd>Drag to pan, scroll or pinch to zoom, T for the threat scan</dd>
      </dl>
      <p>Progress, level, perks and your equipped pack are saved in this browser only.</p>
      <div class="modal-actions"><a href="./">Exit to catalog</a><button type="button" data-act="close" class="is-primary" autofocus>Close</button></div>`, { label: 'Controls' });
  }

  // ── Shared detail pieces ──────────────────────────────────────────────
  const statRow = (label, value, extra = '') => `<div class="srow"><span class="srow-l">${label}</span><span class="srow-v">${value}${extra}</span></div>`;
  const split = (...cells) => `<div class="srow-split">${cells.map(([l, v]) => `<div class="srow"><span class="srow-l">${l}</span><span class="srow-v">${v}</span></div>`).join('')}</div>`;
  const delta = (a, b, invert = false) => {
    if (a === b || b == null) return '';
    const up = a > b; return ` <span class="delta ${up !== invert ? 'is-up' : 'is-down'}">${up ? '▲' : '▼'}${Math.abs(a - b)}</span>`;
  };
  const figure = (src, alt, cls = '') => `<figure class="render ${cls}"><img class="tint" src="${esc(src)}" alt="${esc(alt)}" decoding="async"></figure>`;
  const para = t => `<p class="desc">${esc(t)}</p>`;
  const perkChips = list => list.map(pk => `<span class="chip${rankOf(pk.family) >= pk.rank ? ' is-have' : ''}">${esc(pk.label)}</span>`).join(' ');
  const partsLine = list => list.map(pt => `${esc(pt.name)}${pt.qty > 1 ? ` ×${pt.qty}` : ''}`).join(' · ');
  const spLine = sp => Object.entries(sp).filter(([, v]) => v).map(([k, v]) => `${signed(v)} ${k}`).join('  ');

  // ── STAT › STATUS ─────────────────────────────────────────────────────
  const stimpak = MODS.filter(m => m.parts.some(pt => pt.name === 'Stimpak'));
  const radaway = MODS.filter(m => m.parts.some(pt => pt.name === 'RadAway'));
  function statusView() {
    const pl = player(), p = pl.p, st = pl.st;
    const bar = (label, v, max, cls) => `<div class="cond ${cls}"><span class="cond-label">${label}</span><span class="cond-bar"><span style="width:${clamp(v / max * 100, 0, 100)}%"></span></span></div>`;
    const agi = st.sp.AGI || 0;
    return `<div class="status">
      <div class="status-fig">
        ${bar(`CARRY ${signed(st.cc)}`, st.cc, CC_TOP, 'c-head')}
        ${bar(`DMG RES ${pl.dr}`, pl.dr, DR_TOP + 5, 'c-larm')}
        ${bar(`ENERGY RES ${pl.er}`, pl.er, 20, 'c-rarm')}
        ${bar(`RAD RES ${pl.rr}`, pl.rr, 35, 'c-torso')}
        ${bar(`AGILITY ${signed(agi)}`, agi + 2, 4, 'c-lleg')}
        ${bar(`WEIGHT ${st.weight} LB`, st.weight, 9, 'c-rleg')}
        <button type="button" class="bobble bobble-status" data-act="bobble" aria-label="Bobble the head"><img class="bobble-body tint" src="assets/pipboy/bobble-body.webp" alt=""><img class="bobble-head tint" src="assets/pipboy/bobble-head.webp" alt=""></button>
        <button type="button" class="aid-btn aid-l" data-act="stimpak">Stimpak (${stimpak.length})</button>
        <button type="button" class="aid-btn aid-r" data-act="radaway">RadAway (${radaway.length})</button>
      </div>
      <div class="status-name">${p ? `<span class="mark is-on"></span>${esc(p.name)}` : 'NO BACKPACK EQUIPPED'}</div>
      <div class="status-icons">
        <span class="sbox">${ico('weight')} ${signed(st.cc)}</span>
        <span class="sbox">${ico('shield')} ${pl.dr}</span><span class="sbox">${ico('bolt')} ${pl.er}</span><span class="sbox">${ico('rad')} ${pl.rr}</span>
        ${pl.pa ? `<span class="sbox">${ico('pa')} +${pl.pa}</span>` : ''}
        ${st.hp ? `<span class="sbox">HP +${st.hp} · AP +${st.ap}</span>` : ''}
      </div>
    </div>`;
  }
  function statusMounted() {
    $('.status')?.addEventListener('click', e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'bobble') bobble(e.target.closest('.bobble'));
      else if (act === 'stimpak') filterMods('USES STIMPAK', m => stimpak.includes(m));
      else if (act === 'radaway') filterMods('USES RADAWAY', m => radaway.includes(m));
    });
  }
  function bobble(el) {
    if (!el || motion.matches) return;
    el.classList.remove('is-wild'); void el.offsetWidth; el.classList.add('is-wild');
    tone(520, 0.08, 'triangle', 0.05); tone(780, 0.1, 'triangle', 0.04, 0.09);
  }
  function filterMods(label, test) { modFilter = { label, test }; go('inv', 'mods'); }

  // ── STAT › SPECIAL ────────────────────────────────────────────────────
  const SP_TEXT = {
    STR: 'Raw strength. Carry weight is 200 + 10 × Strength before any backpack, so each point is worth a small pack. Armorer, Big Leagues and Strong Back all start here.',
    PER: 'Awareness of the world around you. Only one backpack mod touches it, but Rifleman needs it.',
    END: 'Stamina and toughness. The most common bonus in the catalog: Endurance mods show up on ten different backpacks.',
    CHA: 'Charm and wits. Local Leader, which gates the lucky-souvenir and settlement-built packs, needs Charisma 6.',
    INT: 'Knowledge and reasoning. Chemist, Science!, Gun Nut and Medic, which gate the high-tech and Nuka mods, all live here.',
    AGI: 'Finesse and sneaking. Heavy frames cost Agility; most packs have a lighter mod that brings it back to +0.',
    LCK: 'Fate. A few charms and one Nuka flavour add Luck; no perk needed for these mods depends on it.'
  };
  const spMods = k => MODS.filter(m => m.fx.sp[k]);
  function specialItems() {
    const pl = player();
    return SPECIALS.map(([k, n]) => ({ key: k, label: n, right: String(pl.sp[k]) }));
  }
  function specialDetail(it) {
    const k = it.key, pl = player(), base = clamp(Number(S.special[k]) || 1, 1, 10), bonus = pl.sp[k] - base;
    const mods = spMods(k), up = mods.filter(m => m.fx.sp[k] > 0), down = mods.filter(m => m.fx.sp[k] < 0);
    const gated = PERK_LIST.filter(p => p.special === k);
    const packsDown = new Set(down.map(m => m.pack.num));
    return `<div class="special-hero"><div class="bobble bobble-special act-${k}" aria-hidden="true"><img class="bobble-body tint" src="assets/pipboy/bobble-body.webp" alt=""><img class="bobble-head tint" src="assets/pipboy/bobble-head.webp" alt=""></div>
      <div class="special-big"><span class="special-letter">${k[0]}</span><span class="special-val">${pl.sp[k]}</span></div></div>
      ${para(SP_TEXT[k])}
      <div class="stat-rows">
        ${statRow('Base', `${base}`, ` <span class="dim">of 10</span>`)}
        ${statRow('Equipped backpack', signed(bonus))}
        ${k === 'STR' ? statRow(`${ico('weight')} Carry weight`, `${pl.carry} lb`) : ''}
        ${statRow('Mods that raise it', up.length ? up.map(m => `${esc(m.name)} ${signed(m.fx.sp[k])}`).join(', ') : 'None')}
        ${down.length ? statRow('Mods that lower it', `${down.length} mods on ${packsDown.size} packs`) : ''}
        ${statRow('Perks it gates', gated.length ? gated.map(p => `${esc(p.name)} (${p.req})`).join(', ') : 'None in this catalog')}
      </div>`;
  }
  const specialPoints = () => sum(SPECIALS, ([k]) => clamp(Number(S.special[k]) || 1, 1, 10));
  function adjustSpecial(k, d) {
    const v = clamp(Number(S.special[k]) || 1, 1, 10);
    if ((d > 0 && (v >= 10 || specialPoints() >= 28)) || (d < 0 && v <= 1)) { sfx.bad(); if (d > 0 && specialPoints() >= 28) toast('No S.P.E.C.I.A.L. points left (28 at character creation)'); return; }
    S.special[k] = v + d; save(); sfx.tick(); refresh();
  }

  // ── STAT › PERKS ──────────────────────────────────────────────────────
  const pips = (have, max) => Array.from({ length: max }, (_, i) => `<span class="rank-pip${i < have ? ' is-on' : ''}"></span>`).join('');
  function perkItems() {
    return PERK_LIST.map(p => ({ key: p.name, label: p.name, right: '', tag: `<span class="pips" aria-label="Rank ${rankOf(p.name)} of ${p.max}">${pips(rankOf(p.name), p.max)}</span>`, dim: rankOf(p.name) === 0 }));
  }
  function perkDetail(it) {
    const p = perkByName.get(it.key), have = rankOf(p.name), sp = clamp(Number(S.special[p.special]) || 1, 1, 10);
    const ranks = Object.keys(p.ranks).map(Number).sort((a, b) => a - b);
    const total = MODS.filter(craftable).length;
    return `<h2 class="detail-title">${esc(p.name)}</h2>
      <div class="perk-pips" role="group" aria-label="Set rank">${Array.from({ length: p.max }, (_, i) => `<button type="button" class="pip-btn${i < have ? ' is-on' : ''}" data-rank="${i + 1}" aria-label="Rank ${i + 1}" aria-pressed="${i < have}"></button>`).join('')}<span class="perk-rank">RANK ${have}/${p.max}</span></div>
      ${p.special ? para(`Requires ${SP_NAME[p.special]} ${p.req}.${sp < p.req ? ` Your ${SP_NAME[p.special]} is ${sp}.` : ''}`) : ''}
      <div class="stat-rows">
        ${ranks.map(r => statRow(`Rank ${ROMAN[r]}`, `${p.ranks[r]} mod${p.ranks[r] === 1 ? '' : 's'}`, have >= r ? ' <span class="dim">✓</span>' : '')).join('')}
        ${p.packs.size ? statRow('Base recipes', [...p.packs].map(q => esc(q.name)).join(', ')) : ''}
        ${statRow('Craftable with your perks', `${total}/${MODS.length}`)}
      </div>`;
  }
  function setRank(name, r) {
    const p = perkByName.get(name);
    S.perks[name] = clamp(r, 0, p.max); save();
    (r > 0 ? sfx.ok : sfx.off)(); refresh();
  }

  // ── INV › APPAREL ─────────────────────────────────────────────────────
  const SORTS = [['num', 'CATALOG', 1], ['level', 'LEVEL', 1], ['cc', 'CARRY', -1], ['dr', 'DMG RES', -1], ['weight', 'WEIGHT', 1], ['value', 'VALUE', -1], ['ccw', 'CC/LB', -1], ['name', 'NAME', 1]];
  const sortVal = (p, k) => k === 'cc' ? p.ccMax : k === 'dr' ? p.drMax : k === 'ccw' ? p.ccMax / (p.weight || 1) : k === 'name' ? p.name : p[k];
  function apparelItems() {
    const [k, , d] = SORTS.find(s => s[0] === S.sort) || SORTS[0];
    const list = PACKS.slice().sort((a, b) => (k === 'name' ? a.name.localeCompare(b.name) : (sortVal(a, k) - sortVal(b, k))) * d || a.num - b.num);
    const right = p => k === 'cc' ? `+${p.ccMax}` : k === 'dr' ? String(p.drMax) : k === 'weight' ? `${p.weight}` : k === 'value' ? String(p.value) : k === 'ccw' ? (p.ccMax / (p.weight || 1)).toFixed(1) : locked(p) ? `LVL ${p.level}` : '';
    return list.map(p => ({ key: String(p.num), label: p.name, mark: S.equip === p.num ? 'on' : null, dim: locked(p), right: right(p), tag: isFound(`bp-${p.num}`) ? '<span class="found-tag">FOUND</span>' : '' }));
  }
  function apparelDetail(it) {
    const p = byNum.get(Number(it.key)), st = packStats(p), eq = equipped(), es = eq && eq !== p ? packStats(eq) : null;
    return `${figure(p.img, p.name, 'is-pack')}
      <div class="stat-rows">
        ${statRow(`${ico('weight')} Carry capacity`, signed(st.cc), (es ? delta(st.cc, es.cc) : '') + (p.ccMax > st.cc ? ` <span class="dim">max +${p.ccMax}</span>` : ''))}
        <div class="srow srow-icons">${ico('shield')}<span>${st.dr}${es ? delta(st.dr, es.dr) : ''}</span>${ico('bolt')}<span>${st.er}${es ? delta(st.er, es.er) : ''}</span>${ico('rad')}<span>${st.rr}${es ? delta(st.rr, es.rr) : ''}</span></div>
        ${split(['Weight', `${p.weight}${es ? delta(p.weight, eq.weight, true) : ''}`], ['Value', `${p.value}`])}
        ${split(['Level', `${p.level}${locked(p) ? ` ${ico('lock', 'is-inline')}` : ''}`], ['Mods', `${p.mods.length}`])}
        ${spLine(st.sp) ? statRow('S.P.E.C.I.A.L.', spLine(st.sp)) : ''}
        ${st.cm ? statRow('Carry mod', esc(st.cm.name)) : ''}
        ${st.dm ? statRow('Armor mod', esc(st.dm.name)) : ''}
        ${st.notes.length ? `<div class="srow srow-full">${esc(st.notes.join('. '))}</div>` : ''}
      </div>
      ${p.flavor.length ? para(p.flavor.join('. ') + '.') : ''}
      <p class="desc dim">${esc(p.place)}${p.edid ? ` · ${esc(p.edid)}` : ''}</p>
      ${p.colors.length > 1 ? `<p class="desc dim">Paints: ${esc(p.colors.join(', '))}</p>` : ''}`;
  }
  function equip(p) {
    if (S.equip === p.num) { S.equip = null; save(); sfx.off(); toast(`${p.name} unequipped`); }
    else { S.equip = p.num; save(); sfx.ok(); toast(`${p.name} equipped`); }
    refresh();
  }
  function markFound(key, name) {
    const on = !isFound(key);
    setFound(key, on);
    (on ? sfx.ok : sfx.off)();
    toast(on ? `${name} found` : `${name} marked not found`);
    if (on) checkQuests(key);
    refresh(); refreshMapPins();
  }
  function showOnMap(num) {
    go('map', 'world');
    requestAnimationFrame(() => window.catalogMap?.focus(num));
  }

  // ── INV › MODS and WEAPONS ────────────────────────────────────────────
  const COMBAT = /damage|reload|VATS|sneak attack|detect|accuracy/i;
  const modRight = m => m.slot === 'cc' ? `+${m.fx.cc}` : `DR ${m.fx.dr}`;
  function modItems(filter) {
    const out = [];
    let last = null;
    for (const m of MODS) {
      if (filter && !filter(m)) continue;
      if (m.pack !== last) { out.push({ group: m.pack.name }); last = m.pack; }
      const cfg = cfgOf(m.pack), installed = cfg[m.slot] === m.i;
      const tagged = m.parts.some(pt => S.tags.includes(pt.name));
      out.push({ key: m.key, label: m.name, mark: installed ? 'on' : null, dim: !craftable(m), right: modRight(m), tag: tagged ? '<span class="tag-mark" title="Uses a tagged component">⌕</span>' : '' });
    }
    return out;
  }
  function modDetail(it) {
    const m = modByKey.get(it.key), cfg = cfgOf(m.pack), installed = cfg[m.slot] === m.i;
    const f = m.fx, lack = missing(m.perks);
    return `<p class="kicker">${esc(m.pack.name)} · ${m.slot === 'cc' ? 'CARRY SLOT' : 'ARMOR SLOT'}${installed ? ' · INSTALLED' : ''}</p>
      <h2 class="detail-title">${esc(m.name)}</h2>
      <div class="stat-rows">
        ${f.cc ? statRow(`${ico('weight')} Carry capacity`, `+${f.cc}`) : ''}
        ${f.dr || f.er || f.rr ? `<div class="srow srow-icons">${ico('shield')}<span>${f.dr}</span>${ico('bolt')}<span>${f.er}</span>${ico('rad')}<span>${f.rr}</span></div>` : ''}
        ${f.hp ? statRow('Max HP / AP', `+${f.hp} / +${f.ap}`) : ''}
        ${spLine(f.sp) ? statRow('S.P.E.C.I.A.L.', spLine(f.sp)) : ''}
        ${f.notes.length ? `<div class="srow srow-full">${esc(f.notes.join('. '))}</div>` : ''}
        ${statRow('Perks', m.perks.length ? perkChips(m.perks) : 'None')}
        ${m.parts.length ? `<div class="srow srow-full"><span class="srow-l">Components</span> ${partsLine(m.parts)}</div>` : ''}
      </div>
      ${lack.length ? `<p class="desc warn">${ico('lock', 'is-inline')} Needs ${esc(lack.join(', '))}. Set perk ranks in STAT › PERKS.</p>` : ''}`;
  }
  function install(m) {
    S.mods[m.pack.num] = { ...cfgOf(m.pack), [m.slot]: m.i }; save();
    sfx.ok(); toast(`${m.name} installed on ${m.pack.name}`);
    refresh();
  }
  const modHints = m => m && [
    { k: 'Enter', label: cfgOf(m.pack)[m.slot] === m.i ? 'Installed' : 'Install', run: () => install(m), disabled: cfgOf(m.pack)[m.slot] === m.i },
    { k: 'O', label: 'Open Backpack', run: () => go('inv', 'apparel', m.pack.num, { open: true }) },
    { k: 'M', label: 'Show on Map', run: () => showOnMap(m.pack.num) },
    modFilter && route.sub === 'mods' ? { k: 'Esc', label: 'Clear Filter', run: clearModFilter } : null
  ];
  function clearModFilter() { modFilter = null; sfx.sub(); refresh(); }

  // ── INV › AID, JUNK, AMMO ─────────────────────────────────────────────
  function partItems(kind) { return partsOf(kind).map(e => ({ key: e.name, label: e.name, count: e.qty, tag: S.tags.includes(e.name) ? '<span class="tag-mark" title="Tagged for search">⌕</span>' : '' })); }
  function partDetail(it) {
    const e = PARTS.get(it.key);
    const mods = e.uses.filter(u => u.mod), bases = e.uses.filter(u => !u.mod);
    const rows = e.uses.slice().sort((a, b) => b.qty - a.qty).slice(0, 14);
    return `<p class="kicker">${e.kind === 'aid' ? 'AID' : e.kind === 'ammo' ? 'AMMO' : 'COMPONENT'}${S.tags.includes(e.name) ? ' · TAGGED FOR SEARCH' : ''}</p>
      <h2 class="detail-title">${esc(e.name)}</h2>
      <div class="stat-rows">
        ${statRow('To craft everything once', `×${e.qty}`)}
        ${split(['Mods', mods.length], ['Base recipes', bases.length])}
        ${rows.map(u => statRow(esc(u.mod ? u.mod.name : `${u.pack.name} (base)`), `×${u.qty}`, ` <span class="dim">${u.mod ? esc(u.pack.name) : ''}</span>`)).join('')}
        ${e.uses.length > rows.length ? `<div class="srow srow-full dim">+ ${e.uses.length - rows.length} more</div>` : ''}
      </div>`;
  }
  const partHints = it => it && [
    { k: 'Enter', label: 'Show Mods', run: () => filterMods(`USES ${it.key.toUpperCase()}`, m => m.parts.some(pt => pt.name === it.key)) },
    { k: 'T', label: S.tags.includes(it.key) ? 'Untag' : 'Tag for Search', run: () => { S.tags = S.tags.includes(it.key) ? S.tags.filter(t => t !== it.key) : [...S.tags, it.key]; save(); sfx.tick(); refresh(); } }
  ];

  // ── INV › MISC ────────────────────────────────────────────────────────
  function miscItems() {
    const out = [{ group: 'MAGAZINES' }];
    ITEMS.forEach((i, n) => {
      if (!i.mag && ITEMS[n - 1]?.mag) out.push({ group: 'BOBBLEHEADS' });
      out.push({ key: i.key, label: i.name, mark: isFound(i.key) ? 'on' : null });
    });
    return out;
  }
  function miscDetail(it) {
    const i = itemByKey.get(it.key);
    return `${figure(i.img, i.name, i.mag ? 'is-cover' : 'is-bobble')}
      <div class="stat-rows">
        ${statRow(i.mag ? 'Magazine' : 'Vault-Tec upgrade', esc(i.fx.join(' · ')))}
        ${statRow('Location', esc(i.place))}
        ${i.hint ? statRow('Where', esc(i.hint)) : ''}
        ${statRow('Status', isFound(i.key) ? 'Found' : 'Not found')}
      </div>
      ${i.mag ? '' : para('One of four upgrade bobbleheads for the Vault-Tec Utility Backpack.')}
      <p class="desc dim">${esc(i.edid)}</p>`;
  }
  const miscHints = it => { const i = it && itemByKey.get(it.key); return i && [
    { k: 'Enter', label: isFound(i.key) ? 'Mark Not Found' : 'Mark Found', run: () => markFound(i.key, i.name) },
    i.photo ? { k: 'V', label: 'View Photo', run: () => photoDialog(i.photo, i.name, i.hint ? `${i.place}: ${i.hint}` : i.place) } : null,
    i.photo ? { k: 'L', label: 'Local Map', run: () => go('map', 'local', i.key, { open: true }) } : null
  ]; };

  // ── DATA › QUESTS ─────────────────────────────────────────────────────
  const packObjective = p => ({ key: `bp-${p.num}`, text: `Find the ${p.name}`, place: p.place, sub: `${p.place} · LVL ${p.level}`, done: () => isFound(`bp-${p.num}`), num: p.num });
  const QUESTS = [
    { id: 'main', name: 'Backpacks of the Commonwealth', about: 'Track down every backpack in the Commonwealth, from Sanctuary to Nuka-World.', objectives: () => PACKS.slice().sort((a, b) => a.level - b.level || a.num - b.num).map(packObjective) },
    { id: 'bobbleheads', name: 'Vault-Tec Bobblehead Program', about: 'Four upgrade bobbleheads unlock the Vault-Tec Utility Backpack editions.', objectives: () => ITEMS.filter(i => !i.mag).map(i => ({ key: i.key, text: `Recover the ${i.name.replace('Vault-Tec Backpack ', '')}`, place: i.place, sub: `${i.place}${i.hint ? ` · ${i.hint}` : ''}`, done: () => isFound(i.key) })) },
    { id: 'reading', name: 'The Reading List', about: 'Five issues of the backpack magazine. Four of them add Power Armor carry capacity.', objectives: () => ITEMS.filter(i => i.mag).map(i => ({ key: i.key, text: `Read ${i.name}`, place: i.place, sub: `${i.place}${i.hint ? ` · ${i.hint}` : ''}`, done: () => isFound(i.key) })) },
    { id: 'signal', name: 'Incoming Transmission', about: 'An unidentified signal on the Pip-Boy radio. Source: unknown.', objectives: () => [{ key: 'signal', text: 'Tune in to the ARC-Tesla transmission', place: 'RADIO', sub: 'RADIO › ARC-Tesla Transmission', done: () => isFound('signal') }, { key: 'signal-2', text: '████████ ███ ██████', place: '', sub: 'SEALED UNTIL UPDATE', done: () => false, locked: true }] }
  ];
  const questDone = q => q.objectives().every(o => o.done());
  function questItems() {
    const sorted = QUESTS.slice().sort((a, b) => Number(questDone(a)) - Number(questDone(b)));
    return sorted.map(q => ({ key: q.id, label: q.name, mark: S.track === q.id ? 'diamond' : null, dim: questDone(q), right: `${q.objectives().filter(o => o.done()).length}/${q.objectives().length}` }));
  }
  function questDetail(it) {
    const q = QUESTS.find(x => x.id === it.key);
    const obs = q.objectives();
    return `<h2 class="detail-title">${esc(q.name)}${questDone(q) ? ' <span class="dim">(COMPLETED)</span>' : ''}</h2>${para(q.about)}
      <ul class="objectives">${obs.map(o => `<li><button type="button" class="obj${o.done() ? ' is-done' : ''}" data-obj="${esc(o.key)}"${o.locked ? ' disabled' : ''} aria-pressed="${o.done()}"><span class="box"></span><span class="obj-text">${esc(o.text)}<span class="obj-sub">${esc(o.sub)}</span></span></button></li>`).join('')}</ul>`;
  }
  function questAfter(it, el) {
    el.querySelector('.objectives')?.addEventListener('click', e => {
      const b = e.target.closest('[data-obj]'); if (!b || b.disabled) return;
      const key = b.dataset.obj;
      if (key === 'signal') { go('radio', '', 'arc', { open: true }); return; }
      const name = key.startsWith('bp-') ? byNum.get(Number(key.slice(3)))?.name : itemByKey.get(key)?.name;
      markFound(key, name || key);
    });
  }
  function checkQuests(key) {
    for (const q of QUESTS) {
      const obs = q.objectives();
      if (!obs.some(o => o.key === key)) continue;
      if (questDone(q)) setTimeout(() => banner('QUEST COMPLETED', q.name), 250);
      else toast(`QUEST UPDATED · ${q.name}`, 'is-quest');
    }
  }

  // ── DATA › WORKSHOPS ──────────────────────────────────────────────────
  function workshopItems() { return PACKS.map(p => ({ key: String(p.num), label: p.name, mark: isFound(`bp-${p.num}`) ? 'on' : null, right: `${p.mods.filter(craftable).length}/${p.mods.length}` })); }
  function workshopDetail(it) {
    const p = byNum.get(Number(it.key)), can = p.mods.filter(craftable).length;
    const baseOk = hasPerks(p.basePerks);
    return `<p class="kicker">ARMOR WORKBENCH</p><h2 class="detail-title">${esc(p.name)}</h2>
      <div class="stat-rows">
        ${statRow('Craft', baseOk ? 'Ready' : `Needs ${esc(missing(p.basePerks).join(', '))}`)}
        <div class="srow srow-full"><span class="srow-l">Recipe</span> ${partsLine(p.parts)}</div>
        ${p.basePerks.length ? statRow('Perks', perkChips(p.basePerks)) : ''}
        ${split(['Carry mods', p.ccMods.length], ['Armor mods', p.drMods.length])}
        ${statRow('Mods you can craft', `${can}/${p.mods.length}`)}
        <div class="srow srow-meter"><span class="srow-l">Progress</span><span class="meter"><span style="width:${p.mods.length ? can / p.mods.length * 100 : 0}%"></span></span></div>
        ${statRow('Paints', esc(p.colors.join(', ')))}
      </div>`;
  }

  // ── DATA › STATS ──────────────────────────────────────────────────────
  const STAT_CATS = [['general', 'General'], ['collection', 'Collection'], ['crafting', 'Crafting'], ['records', 'Records'], ['progression', 'Carry Capacity']];
  function statsDetail(it) {
    const rows = [];
    const heaviest = PACKS.reduce((a, b) => (b.weight > a.weight ? b : a)), lightest = PACKS.reduce((a, b) => (b.weight < a.weight ? b : a));
    const priciest = PACKS.reduce((a, b) => (b.value > a.value ? b : a)), best = PACKS.reduce((a, b) => (b.ccMax / b.weight > a.ccMax / a.weight ? b : a));
    if (it.key === 'general') rows.push(['Backpacks', PACKS.length], ['Workbench mods', MODS.length], ['Carry slot mods', MODS.filter(m => m.slot === 'cc').length], ['Armor slot mods', MODS.filter(m => m.slot === 'dr').length], ['Components and items', PARTS.size], ['Perks referenced', PERK_LIST.length], ['Bobbleheads', ITEMS.filter(i => !i.mag).length], ['Magazines', ITEMS.filter(i => i.mag).length], ['Level range', `${LEVELS[0]}–${LEVELS[LEVELS.length - 1]}`]);
    if (it.key === 'collection') {
      const fp = PACKS.filter(p => isFound(`bp-${p.num}`)).length, fb = ITEMS.filter(i => !i.mag && isFound(i.key)).length, fm = ITEMS.filter(i => i.mag && isFound(i.key)).length;
      rows.push(['Backpacks found', `${fp}/${PACKS.length}`], ['Bobbleheads found', `${fb}/4`], ['Magazines read', `${fm}/5`], ['Caps value found', sum(PACKS.filter(p => isFound(`bp-${p.num}`)), p => p.value).toLocaleString('en-US')], ['Available at your level', S.level == null ? 'Set your level' : `${PACKS.filter(p => !locked(p)).length}/${PACKS.length}`]);
    }
    if (it.key === 'crafting') rows.push(['Craftable with your perks', `${MODS.filter(craftable).length}/${MODS.length}`], ['Mods with no perk', MODS.filter(m => !m.perks.length).length], ['Mods needing two perks', MODS.filter(m => m.perks.length >= 2).length], ['Units to craft everything once', sum([...PARTS.values()], e => e.qty).toLocaleString('en-US')], ['Most used component', `${partsOf('junk')[0].name} ×${partsOf('junk')[0].qty}`], ['Nuka-Cola needed', `×${PARTS.get('Nuka-Cola')?.qty || 0}`]);
    if (it.key === 'records') rows.push(['Most carry capacity', `+${CC_TOP}`], ['Most damage resistance', `${DR_TOP}`], ['Heaviest', `${heaviest.name} · ${heaviest.weight} lb`], ['Lightest', `${lightest.name} · ${lightest.weight} lb`], ['Most valuable', `${priciest.name} · ${priciest.value}`], ['Best carry per pound', `${best.name} · ${(best.ccMax / best.weight).toFixed(1)}`], ['Total catalog weight', `${sum(PACKS, p => p.weight)} lb`], ['Total catalog value', sum(PACKS, p => p.value).toLocaleString('en-US')]);
    if (it.key === 'progression') return `<h2 class="detail-title">Carry capacity by level</h2>${chart()}<p class="desc dim">Each line runs from a backpack's base carry capacity (hollow) to its best carry mod (solid).${S.level != null ? ' Backpacks above your level are dimmed.' : ''}</p>`;
    return `<h2 class="detail-title">${esc(STAT_CATS.find(c => c[0] === it.key)[1])}</h2><div class="stat-rows">${rows.map(([l, v]) => statRow(esc(l), esc(v))).join('')}</div>`;
  }
  function chart() {
    const W = 520, H = 300, L = 42, R = 12, T = 12, B = 34;
    const x = lv => L + (lv - 1) / 59 * (W - L - R), y = cc => T + (1 - cc / 120) * (H - T - B);
    const ticksY = [0, 30, 60, 90, 120], ticksX = [1, 10, 20, 30, 40, 50, 60];
    const seen = {};
    const marks = PACKS.map(p => {
      const n = (seen[p.level] = (seen[p.level] || 0) + 1) - 1, off = (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 5;
      const X = x(p.level) + off;
      return `<g class="dumbbell${locked(p) ? ' is-dim' : ''}${S.equip === p.num ? ' is-eq' : ''}"><title>${esc(p.name)} · level ${p.level} · carry +${p.ccBase} to +${p.ccMax}</title><line x1="${X}" x2="${X}" y1="${y(p.ccBase)}" y2="${y(p.ccMax)}"/><circle class="base" cx="${X}" cy="${y(p.ccBase)}" r="3.5"/><circle class="max" cx="${X}" cy="${y(p.ccMax)}" r="4"/></g>`;
    }).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Carry capacity by level for all ${PACKS.length} backpacks, from +${Math.min(...PACKS.map(p => p.ccBase))} at level 1 up to +${CC_TOP}.">
      ${ticksY.map(t => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('')}
      ${ticksX.map(t => `<text class="tick" x="${x(t)}" y="${H - B + 18}" text-anchor="middle">${t}</text>`).join('')}
      <line class="axis" x1="${L}" x2="${L}" y1="${T}" y2="${H - B}"/><line class="axis" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>
      <text class="tick" x="${W - R}" y="${H - 2}" text-anchor="end">LEVEL</text>
      ${S.level != null ? `<line class="you" x1="${x(clamp(S.level, 1, 60))}" x2="${x(clamp(S.level, 1, 60))}" y1="${T}" y2="${H - B}"/>` : ''}
      ${marks}</svg>`;
  }

  // ── MAP › WORLD and LOCAL ─────────────────────────────────────────────
  let mapPlace = '', threat = false, mapFilter = 0;
  const MAP_FILTERS = [['ALL', null], ['NOT FOUND', bp => !isFound(`bp-${bp.num}`)], ['AT MY LEVEL', bp => S.level == null || bp.level <= S.level], ['FOUND', bp => isFound(`bp-${bp.num}`)]];
  function refreshMapPins() {
    $$('.map-pin').forEach(el => el.classList.toggle('is-found', isFound(`bp-${el.dataset.num}`)));
    if (mapFilter) window.catalogMap?.filter(MAP_FILTERS[mapFilter][1]);
  }
  function worldEnter() {
    window.catalogMap?.show();
    const key = selected['map/world'];
    requestAnimationFrame(() => { refreshMapPins(); if (key) { window.catalogMap?.focus(Number(key)); selected['map/world'] = null; } });
  }
  const worldHints = () => [
    { k: 'T', label: threat ? 'Pip-Boy Colors' : 'Threat Scan', run: () => { threat = !threat; ui.classList.toggle('is-threat', threat); sfx.sub(); renderHints(); } },
    { k: 'F', label: `Filter: ${MAP_FILTERS[mapFilter][0]}`, run: () => { mapFilter = (mapFilter + 1) % MAP_FILTERS.length; window.catalogMap?.filter(MAP_FILTERS[mapFilter][1]); sfx.sub(); renderHints(); } },
    { k: '+/−', label: 'Zoom', run: () => $('[data-map="zoom-in"]')?.click() },
    { k: '0', label: 'Fit', run: () => $('[data-map="fit"]')?.click() }
  ];
  new MutationObserver(() => {
    const c = $('#map-callout');
    mapPlace = c && !c.hidden ? $('.map-callout-name', c).textContent : '';
    if (route.tab === 'map') renderBar();
  }).observe($('#map-callout'), { attributes: true, attributeFilter: ['hidden'], subtree: true, characterData: true, childList: true });
  window.openBackpack = num => go('inv', 'apparel', num, { open: true });

  function localItems() {
    return [{ group: 'BACKPACKS' }, ...PACKS.map(p => ({ key: String(p.num), label: p.name, mark: isFound(`bp-${p.num}`) ? 'on' : null })), { group: 'COLLECTIBLES' }, ...ITEMS.filter(i => i.photo).map(i => ({ key: i.key, label: i.name, mark: isFound(i.key) ? 'on' : null }))];
  }
  function localDetail(it) {
    const i = itemByKey.get(it.key);
    if (i) return `<figure class="local is-photo"><img class="tint" src="${esc(i.photo)}" alt="${esc(`${i.place}: ${i.hint || ''}`)}"><span class="local-arrow" aria-hidden="true"></span></figure>
      <div class="stat-rows">${statRow('Location', esc(i.place))}${i.hint ? statRow('Where', esc(i.hint)) : ''}${statRow('Cell', esc(i.edid))}</div>`;
    const p = byNum.get(Number(it.key)), pin = window.catalogMap?.pins?.[p.num];
    if (!pin) return `<p class="desc">No map position for this backpack.</p>`;
    return `<figure class="local" style="--px:${pin[0]};--py:${pin[1]}"><div class="local-map tint-map" role="img" aria-label="Local map around ${esc(p.place)}"></div><span class="local-arrow" aria-hidden="true"></span><figcaption>${esc(p.place)}</figcaption></figure>
      <div class="stat-rows">${statRow('Backpack', esc(p.name))}${statRow('Cell', esc(p.edid || '—'))}${statRow('Level', p.level)}</div>`;
  }
  const localHints = it => { if (!it) return []; const i = itemByKey.get(it.key); return i ? [
    { k: 'V', label: 'View Photo', run: () => photoDialog(i.photo, i.name, `${i.place}${i.hint ? `: ${i.hint}` : ''}`) },
    { k: 'Enter', label: isFound(i.key) ? 'Mark Not Found' : 'Mark Found', run: () => markFound(i.key, i.name) }
  ] : [
    { k: 'Enter', label: 'World Map', run: () => showOnMap(Number(it.key)) },
    { k: 'O', label: 'Open Backpack', run: () => go('inv', 'apparel', Number(it.key), { open: true }) }
  ]; };

  // ── RADIO ─────────────────────────────────────────────────────────────
  const STATIONS = [
    { id: 'arc', name: 'ARC-Tesla Transmission', tag: 'NEW', kind: 'arc' },
    { id: 'src', name: 'SRC-3000 Field Net', kind: 'src' },
    { id: 'beacon', name: 'Boston Backpacks HQ Beacon', kind: 'morse', morse: 'BBHQ' },
    { id: 'bulletin', name: 'Vault-Tec Bobblehead Bulletin', kind: 'bulletin' },
    { id: 'mule', name: 'Distress Signal: Overencumbered', kind: 'morse', morse: 'SOS' }
  ];
  const MORSE = { A: '.-', B: '-...', C: '-.-.', H: '....', Q: '--.-', O: '---', S: '...' };
  let playing = null, scopeRaf = 0, radioTimer = 0, arc = null;
  const SRC = MODS.filter(m => /VATS/i.test(m.desc));
  function stationText(s) {
    if (s.id === 'arc') return `<p class="desc">A burst of structured noise on an unused band. It repeats every 2.7 seconds, in step with a coil discharge.</p>
      <div class="stat-rows">${statRow('Designation', 'ARC-Tesla P.C.D. Mk IV')}${statRow(`${ico('weight')} Carry capacity`, '<span class="redact">████</span>')}${statRow('Location', '<span class="redact">██████████</span>')}${statRow('Status', 'SEALED UNTIL UPDATE')}</div>
      <div id="arc-slot"></div>
      <p class="desc dim" id="arc-status" role="status"></p>`;
    if (s.id === 'src') return `<p class="desc">Four channels from the Manpack radio transceiver. Each one sharpens V.A.T.S. a little more.</p><div class="stat-rows">${SRC.map(m => statRow(esc(m.name), esc(m.fx.notes.join(' ')))).join('')}</div>`;
    if (s.id === 'beacon') { const here = [byNum.get(26), ...ITEMS.filter(i => i.edid === 'BackpackRoom')].filter(Boolean); return `<p class="desc">Morse, looping: B · B · H · Q. The beacon sits over the Backpack Room.</p><div class="stat-rows">${here.map(x => statRow(esc(x.name), esc(x.place))).join('')}</div>`; }
    if (s.id === 'bulletin') return `<p class="desc bulletin" id="bulletin">${esc(bulletinLine())}</p>`;
    return '<p class="desc">"...too much weight... can\'t fast travel... send a Strong Back... or a bigger backpack..."</p><p class="desc dim">Recommended: equip something from INV › APPAREL.</p>';
  }
  let bulletinIdx = 0;
  const bulletinLine = () => { const b = ITEMS.filter(i => !i.mag); const i = b[bulletinIdx % b.length]; return `This is Vault-Tec with your bobblehead bulletin. ${i.name.replace('Vault-Tec Backpack ', 'The ')} was last seen at ${i.place}, ${i.hint}.`; };
  function radioItems() { return STATIONS.map(s => ({ key: s.id, label: s.name, mark: playing === s.id ? 'on' : null, tag: s.tag ? `<span class="found-tag">${s.tag}</span>` : '' })); }
  function radioDetail(it) {
    const s = STATIONS.find(x => x.id === it.key);
    return `<div class="scope-wrap"><canvas class="scope" id="scope" aria-hidden="true"></canvas></div>${stationText(s)}${S.sound ? '' : '<p class="desc dim">Sound is off. Turn it on with the SOUND button.</p>'}`;
  }
  // One stage element for the whole session: the viewer's resize observer is bound to it.
  let arcStage = null;
  function arcStageEl() {
    if (!arcStage) {
      arcStage = document.createElement('div');
      arcStage.className = 'arc-stage'; arcStage.id = 'arc-stage'; arcStage.hidden = true;
      arcStage.innerHTML = '<img class="arc-poster" src="assets/previews/arc-tesla/poster.webp" alt="ARC-Tesla P.C.D. Mk IV prototype"><video muted loop playsinline preload="none" hidden></video>';
    }
    return arcStage;
  }
  function radioAfter(it) {
    startScope();
    if (it?.key !== 'arc') { arc?.viewer?.setActive(false); return; }
    $('#arc-slot')?.replaceWith(arcStageEl());
    if (arc?.viewer) mountArc();
    else if (arc?.video) arcVideo(arc.video);
    else if (arc?.loading) { arcStage.hidden = false; $('.scope-wrap')?.classList.add('is-hidden'); $('#arc-status').textContent = 'Decoding transmission…'; }
    else $('#arc-status').textContent = 'P) Power on the 3D preview (about 5 MB).';
  }
  function toggleStation(id) {
    playing = playing === id ? null : id;
    clearInterval(radioTimer);
    if (playing) {
      noise(0.25, 0.05, 0, 1200); sfx.ok();
      if (id === 'arc' && !isFound('signal')) { setFound('signal', true); checkQuests('signal'); }
      radioTimer = setInterval(radioSound, 400);
      if (playing === 'bulletin') bulletinIdx++;
    } else sfx.off();
    refresh();
  }
  // Morse and signal audio, driven by the same clock the scope draws from.
  let morseQueue = [];
  function radioSound() {
    const s = STATIONS.find(x => x.id === playing); if (!s || !S.sound || document.hidden) return;
    if (s.kind === 'morse') {
      if (!morseQueue.length) morseQueue = [...s.morse].flatMap(ch => [...MORSE[ch]].map(sym => (sym === '.' ? 1 : 3)).concat(-3));
      const u = morseQueue.shift();
      if (u > 0) tone(700, 0.09 * u, 'sine', 0.04);
    } else if (s.kind === 'arc') { if (Math.random() < 0.35) noise(0.08, 0.04, 0, 3000 + Math.random() * 2000); }
    else if (s.kind === 'src') tone(1200 + 200 * Math.floor(Math.random() * 4), 0.04, 'square', 0.015);
    else if (s.kind === 'bulletin' && Math.random() < 0.3) tone([523, 587, 659, 784][Math.floor(Math.random() * 4)], 0.18, 'triangle', 0.03);
  }
  function startScope() {
    cancelAnimationFrame(scopeRaf);
    const c = $('#scope'); if (!c) return;
    const ctx = c.getContext('2d');
    const draw = t => {
      if (!c.isConnected) return;
      const dpr = Math.min(devicePixelRatio || 1, 2), w = c.clientWidth, h = c.clientHeight;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const col = getComputedStyle(document.body).getPropertyValue('--pip-rgb').trim().split(/\s+/).join(',');
      const pad = 12, x0 = pad, y0 = h - pad, x1 = w - 4, y1 = 4;
      ctx.strokeStyle = `rgba(${col},0.18)`; ctx.lineWidth = 1;
      for (let i = 1; i < 10; i++) { const gx = x0 + (x1 - x0) * i / 10, gy = y0 - (y0 - y1) * i / 10; ctx.beginPath(); ctx.moveTo(gx, y1); ctx.lineTo(gx, y0); ctx.moveTo(x0, gy); ctx.lineTo(x1, gy); ctx.stroke(); }
      ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= 50; i++) { const len = i % 5 ? 4 : 9; const gx = x0 + (x1 - x0) * i / 50, gy = y0 - (y0 - y1) * i / 50; ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(gx, y0 - len); ctx.moveTo(x0, gy); ctx.lineTo(x0 + len, gy); ctx.stroke(); }
      const s = STATIONS.find(x => x.id === playing && x.id === selected['radio/']);
      const mid = (y0 + y1) / 2, amp = (y0 - y1) * 0.36, sec = motion.matches ? 0 : t / 1000;
      ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = 2; ctx.shadowColor = `rgba(${col},0.8)`; ctx.shadowBlur = 8; ctx.beginPath();
      for (let px = 0; px <= x1 - x0; px += 2) {
        const u = px / (x1 - x0);
        let v = 0;
        if (s) {
          if (s.kind === 'arc') { const ph = (sec % (8 / 3)) / (8 / 3); const spike = Math.exp(-Math.pow((u - ph) * 18, 2)) * (Math.sin(u * 180 + sec * 40) * 0.9); v = Math.sin(u * 14 + sec * 6) * 0.25 + Math.sin(u * 47 - sec * 9) * 0.12 + spike; }
          else if (s.kind === 'morse') { const on = Math.sin(sec * 7) > 0.2 ? 1 : 0.08; v = Math.sin(u * 60 + sec * 20) * 0.7 * on; }
          else if (s.kind === 'src') v = Math.sign(Math.sin(u * 22 + sec * 5)) * 0.45 + Math.sin(u * 90 + sec * 12) * 0.08;
          else v = Math.sin(u * 9 + sec * 3) * 0.55 + Math.sin(u * 23 + sec * 5) * 0.2 + Math.sin(u * 3 - sec) * 0.15;
        }
        const yy = mid - v * amp;
        px ? ctx.lineTo(x0 + px, yy) : ctx.moveTo(x0 + px, yy);
      }
      ctx.stroke(); ctx.shadowBlur = 0;
      if (s && !motion.matches) scopeRaf = requestAnimationFrame(draw);
      else scopeRaf = 0;
    };
    scopeRaf = requestAnimationFrame(draw);
  }
  // The ARC-Tesla preview: the 3D viewer and video fallback reused from the catalog.
  function powerArc() {
    const stage = $('#arc-stage'), status = $('#arc-status');
    if (!stage) return;
    stage.hidden = false; $('.scope-wrap')?.classList.add('is-hidden');
    if (arc?.viewer) { mountArc(); return; }
    if (arc?.loading) return;
    status.textContent = 'Decoding transmission…';
    arc = { loading: import('./arc-viewer.js').then(mod => mod.createArcViewer(stage, {
      onInteract() {},
      onFailure() { arc.viewer?.dispose(); arc.viewer = null; arcVideo('3D is unavailable on this device. Showing the rendered preview.'); },
      onProgress(pct) { const st = $('#arc-status'); if (st) st.textContent = `Decoding transmission… ${pct}%`; }
    })).then(v => {
      arc.viewer = v; arc.loading = null;
      if (stage.isConnected) mountArc(); else v.setActive(false);
      renderHints();
    }).catch(() => { arc.loading = null; arcVideo('The 3D preview could not load. Showing the rendered preview.'); }) };
  }
  function mountArc() {
    const stage = $('#arc-stage'); if (!stage || !arc?.viewer) return;
    stage.hidden = false; $('.scope-wrap')?.classList.add('is-hidden');
    $('.arc-poster', stage).hidden = true;
    stage.classList.toggle('is-true', !!arc.trueColor);
    arc.viewer.setVisible(true); arc.viewer.setMotion(!motion.matches, !motion.matches); arc.viewer.setActive(true);
    const st = $('#arc-status'); if (st) st.textContent = 'Drag to orbit · scroll or pinch to zoom · arrow keys rotate when focused.';
  }
  function arcVideo(message) {
    arc = { ...(arc || {}), video: message };
    const stage = $('#arc-stage'); if (!stage) return;
    stage.hidden = false; $('.scope-wrap')?.classList.add('is-hidden');
    const video = $('video', stage);
    if (!video.querySelector('source')) {
      for (const [file, type] of [['turntable.webm', 'video/webm'], ['turntable.mp4', 'video/mp4']]) { const s = document.createElement('source'); s.src = `assets/previews/arc-tesla/${file}`; s.type = type; video.append(s); }
    }
    video.hidden = false; $('.arc-poster', stage).hidden = true; video.play().catch(() => {});
    const st = $('#arc-status'); if (st) st.textContent = message;
  }
  function leaveRadio() {
    cancelAnimationFrame(scopeRaf); scopeRaf = 0;
    if (arc?.viewer) { arc.viewer.setActive(false); }
  }
  const radioHints = it => { if (!it) return []; const on = playing === it.key; return [
    { k: 'Enter', label: on ? 'Stop' : 'Tune In', run: () => toggleStation(it.key) },
    it.key === 'arc' ? { k: 'P', label: arc?.viewer ? 'Reset View' : 'Power On 3D', run: () => (arc?.viewer && !$('#arc-stage')?.hidden ? arc.viewer.reset() : powerArc()) } : null,
    it.key === 'arc' && arc?.viewer ? { k: 'V', label: arc.trueColor ? 'Pip-Boy Tint' : 'True Color', run: () => { arc.trueColor = !arc.trueColor; $('#arc-stage')?.classList.toggle('is-true', arc.trueColor); renderHints(); } } : null,
    it.key === 'beacon' ? { k: 'M', label: 'Show on Map', run: () => showOnMap(26) } : null
  ]; };

  // ── View registry ─────────────────────────────────────────────────────
  const apparelHints = it => { const p = it && byNum.get(Number(it.key)); return p && [
    { k: 'Enter', label: S.equip === p.num ? 'Unequip' : 'Equip', run: () => equip(p) },
    { k: 'X', label: isFound(`bp-${p.num}`) ? 'Not Found' : 'Mark Found', run: () => markFound(`bp-${p.num}`, p.name) },
    { k: 'M', label: 'Show on Map', run: () => showOnMap(p.num) },
    { k: 'I', label: 'Mods', run: () => filterMods(p.name.toUpperCase(), m => m.pack === p) },
    { k: 'C', label: `Sort: ${(SORTS.find(s => s[0] === S.sort) || SORTS[0])[1]}`, run: () => { const i = SORTS.findIndex(s => s[0] === S.sort); S.sort = SORTS[(i + 1) % SORTS.length][0]; save(); sfx.sub(); refresh(); } }
  ]; };
  const VIEWS = {
    'stat/status': { custom: statusView, mounted: statusMounted, hints: () => [
      { k: 'L', label: 'Set Level', run: levelDialog },
      { k: 'E', label: equipped() ? 'Change Pack' : 'Equip a Pack', run: () => go('inv', 'apparel', S.equip ?? undefined) },
      { k: 'B', label: 'Bobble', run: () => bobble($('.bobble-status')) }
    ] },
    'stat/special': { label: 'S.P.E.C.I.A.L.', items: specialItems, detail: specialDetail, head: () => `POINTS ${specialPoints()}/28`, hints: it => it && [
      { k: '+', label: 'Raise', run: () => adjustSpecial(it.key, 1) },
      { k: '−', label: 'Lower', run: () => adjustSpecial(it.key, -1) },
      { k: 'M', label: 'Show Mods', run: () => filterMods(SP_NAME[it.key].toUpperCase(), m => m.fx.sp[it.key]) }
    ] },
    'stat/perks': { label: 'Perks', items: perkItems, detail: perkDetail, head: () => `CRAFTABLE ${MODS.filter(craftable).length}/${MODS.length}`, afterDetail: (it, el) => {
      el.querySelector('.perk-pips')?.addEventListener('click', e => { const b = e.target.closest('[data-rank]'); if (!b) return; const r = Number(b.dataset.rank); setRank(it.key, rankOf(it.key) === r ? r - 1 : r); });
    }, hints: it => it && [
      { k: 'Enter', label: 'Rank Up', run: () => setRank(it.key, rankOf(it.key) + 1), disabled: rankOf(it.key) >= perkByName.get(it.key).max, why: 'Already at max rank' },
      { k: 'Bksp', label: 'Rank Down', run: () => setRank(it.key, rankOf(it.key) - 1), disabled: rankOf(it.key) <= 0 },
      { k: 'M', label: 'Show Mods', run: () => filterMods(it.key.toUpperCase(), m => m.perks.some(pk => pk.family === it.key)) }
    ] },
    'inv/weapons': { label: 'Combat mods', items: () => modItems(m => m.fx.notes.some(n => COMBAT.test(n))), detail: modDetail, hints: it => modHints(it && modByKey.get(it.key)), head: () => 'COMBAT MODS', empty: 'No combat mods.' },
    'inv/apparel': { label: 'Backpacks', items: apparelItems, detail: apparelDetail, hints: apparelHints, head: () => `SORT: ${(SORTS.find(s => s[0] === S.sort) || SORTS[0])[1]}` },
    'inv/aid': { label: 'Aid', items: () => partItems('aid'), detail: partDetail, hints: partHints, head: () => 'USED IN RECIPES' },
    'inv/misc': { label: 'Collectibles', items: miscItems, detail: miscDetail, hints: miscHints },
    'inv/junk': { label: 'Junk', items: () => partItems('junk'), detail: partDetail, hints: partHints, head: () => 'TOTAL TO CRAFT EVERYTHING' },
    'inv/mods': { label: 'Mods', items: () => modItems(modFilter?.test), detail: modDetail, hints: it => modHints(it && modByKey.get(it.key)) || (modFilter ? [{ k: 'Esc', label: 'Clear Filter', run: clearModFilter }] : []), head: () => (modFilter ? `FILTER: ${esc(modFilter.label)} <button type="button" class="head-x" data-act="clear-filter" aria-label="Clear filter">×</button>` : `${MODS.length} MODS · ${MODS.filter(craftable).length} CRAFTABLE`), empty: 'No mods match this filter.' },
    'inv/ammo': { label: 'Ammo', items: () => partItems('ammo'), detail: partDetail, hints: partHints },
    'data/quests': { label: 'Quests', items: questItems, detail: questDetail, afterDetail: questAfter, initial: its => S.track, hints: it => it && [
      { k: 'Enter', label: S.track === it.key ? 'Tracking' : 'Track', run: () => { S.track = it.key; save(); sfx.ok(); refresh(); }, disabled: S.track === it.key },
      it.key === 'main' ? { k: 'M', label: 'Show on Map', run: () => { const o = QUESTS[0].objectives().find(x => !x.done()); showOnMap(o ? o.num : 1); } } : null,
      it.key === 'signal' ? { k: 'R', label: 'Open Radio', run: () => go('radio', '', 'arc', { open: true }) } : null
    ] },
    'data/workshops': { label: 'Workshops', items: workshopItems, detail: workshopDetail, head: () => 'MODS YOU CAN CRAFT', hints: it => it && [
      { k: 'Enter', label: 'Open Backpack', run: () => go('inv', 'apparel', it.key, { open: true }) },
      { k: 'I', label: 'Mods', run: () => { const p = byNum.get(Number(it.key)); filterMods(p.name.toUpperCase(), m => m.pack === p); } }
    ] },
    'data/stats': { label: 'Stats', items: () => STAT_CATS.map(([k, l]) => ({ key: k, label: l })), detail: statsDetail, wide: true },
    'map/world': { enter: worldEnter, hints: worldHints },
    'map/local': { label: 'Local map', items: localItems, detail: localDetail, hints: localHints },
    'radio/': { label: 'Stations', items: radioItems, detail: radioDetail, afterDetail: radioAfter, hints: radioHints }
  };

  // ── Input ─────────────────────────────────────────────────────────────
  tabsEl.addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) go(b.dataset.tab, lastSub[b.dataset.tab]); });
  strip.addEventListener('click', e => { const b = e.target.closest('.subtab'); if (b) go(route.tab, b.dataset.sub); });
  view.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'back') closeSheet();
    else if (act === 'clear-filter') clearModFilter();
  });
  function cycleTab(d) { const i = TABS.indexOf(route.tab); const t = TABS[(i + d + TABS.length) % TABS.length]; go(t, lastSub[t]); }
  function cycleSub(d) { const subs = SUBS[route.tab]; if (subs.length < 2) return; const i = subs.indexOf(route.sub); go(route.tab, subs[(i + d + subs.length) % subs.length]); }
  const KEYMAP = { '+': ['+', '=', '+/−'], '−': ['-', '−', '_'], Bksp: ['Backspace', 'Delete'] };
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (bootState !== 'done') { finishBoot(); e.preventDefault(); return; }
    if (!modal.hidden) { if (e.key === 'Escape') { e.preventDefault(); closeModal(); } return; }
    const t = e.target;
    if (t.closest?.('input, textarea, select, [contenteditable]')) return;
    if (t.closest?.('#map-stage, #arc-stage canvas') && /^(Arrow|Home|End|PageUp|PageDown|\+|-|=|0| )/.test(e.key)) return;
    const k = e.key;
    if (/^[1-5]$/.test(k)) { e.preventDefault(); const tab = TABS[Number(k) - 1]; go(tab, lastSub[tab]); return; }
    if (e.shiftKey && (k === 'ArrowLeft' || k === 'ArrowRight')) { e.preventDefault(); cycleTab(k === 'ArrowLeft' ? -1 : 1); return; }
    if (k === 'Escape') {
      if (sheetOpen) { e.preventDefault(); closeSheet(); return; }
      if (modFilter && route.sub === 'mods') { e.preventDefault(); clearModFilter(); return; }
      return;
    }
    if (k === '?') { e.preventDefault(); helpDialog(); return; }
    if (k === '`') { e.preventDefault(); setFx(!S.fx); return; }
    // Contextual hint keys first: E) Equip, M) Map, and so on.
    const up = k.length === 1 ? k.toUpperCase() : k;
    const onControl = !!t.closest?.('button, a, canvas');   // Enter and Space belong to a focused control
    let hint = null;
    if (k === 'Enter' || up === 'E') hint = (k === 'Enter' && onControl) ? null : hintList.find(h => h.k === 'Enter') || hintList.find(h => h.k === up);
    else if (k !== ' ') hint = hintList.find(h => h.k === up || (KEYMAP[h.k] || []).includes(k));
    if (hint) { e.preventDefault(); runHint(hint); return; }
    if (route.tab === 'map' && route.sub === 'world') {
      if (k === '+' || k === '=' ) { $('[data-map="zoom-in"]')?.click(); e.preventDefault(); return; }
      if (k === '-' || k === '_') { $('[data-map="zoom-out"]')?.click(); e.preventDefault(); return; }
    }
    if (k === 'ArrowLeft' || up === 'A') { e.preventDefault(); cycleSub(-1); return; }
    if (k === 'ArrowRight' || up === 'D') { e.preventDefault(); cycleSub(1); return; }
    if (!items.length) return;
    if (k === 'ArrowUp' || up === 'W') { e.preventDefault(); step(-1); }
    else if (k === 'ArrowDown' || up === 'S') { e.preventDefault(); step(1); }
    else if (k === 'Home') { e.preventDefault(); step('home'); }
    else if (k === 'End') { e.preventDefault(); step('end'); }
    else if (k === 'PageUp') { e.preventDefault(); step(-8); }
    else if (k === 'PageDown') { e.preventDefault(); step(8); }
  });
  // Swipe sideways on the list to change sub-section (phones).
  let swipe = null;
  view.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && !sheetOpen) swipe = { x: e.clientX, y: e.clientY, t: e.timeStamp }; }, { passive: true });
  view.addEventListener('pointerup', e => {
    if (!swipe || e.pointerType !== 'touch') return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y, fast = e.timeStamp - swipe.t < 600;
    swipe = null;
    if (fast && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) cycleSub(dx < 0 ? 1 : -1);
  });
  view.addEventListener('pointercancel', () => { swipe = null; });

  // ── Device controls ───────────────────────────────────────────────────
  const COLORS = { green: [20, 255, 23], amber: [255, 182, 66], blue: [46, 207, 255], white: [212, 255, 238] };
  function setColor(name) {
    if (!COLORS[name]) name = 'green';
    S.color = name; save();
    const [r, g, b] = COLORS[name];
    document.body.style.setProperty('--pip-rgb', `${r} ${g} ${b}`);
    const k = 1.18, row = c => [0.2126, 0.7152, 0.0722].map(w => (w * c / 255 * k).toFixed(4)).join(' ');
    $('#pip-tint-matrix').setAttribute('values', `${row(r)} 0 0  ${row(g)} 0 0  ${row(b)} 0 0  0 0 0 1 0`);
    const meta = $('meta[name="theme-color"]'); if (meta) meta.content = `rgb(${Math.round(r * 0.03)},${Math.round(g * 0.03)},${Math.round(b * 0.03)})`;
    if (scopeRaf === 0 && $('#scope')) startScope();
  }
  function setFx(on) { S.fx = on; save(); document.body.classList.toggle('fx-off', !on); $('[data-ctl="fx"]').setAttribute('aria-pressed', String(on)); toast(on ? 'CRT effects on' : 'CRT effects off'); }
  function setSound(on) { S.sound = on; save(); $('[data-ctl="sound"]').setAttribute('aria-pressed', String(on)); if (on) { audio(); sfx.ok(); } if (route.tab === 'radio') refresh(); }
  function setLight(on) { S.light = on; save(); document.body.classList.toggle('is-light', on); $('[data-ctl="light"]').setAttribute('aria-pressed', String(on)); }
  $('#controls').addEventListener('click', e => {
    const b = e.target.closest('[data-ctl]'); if (!b) return;
    const c = b.dataset.ctl, names = Object.keys(COLORS);
    if (c === 'color') { setColor(names[(names.indexOf(S.color) + 1) % names.length]); sfx.tick(); toast(`Pip-Boy color: ${S.color.toUpperCase()}`); }
    else if (c === 'light') { setLight(!S.light); sfx.tick(); }
    else if (c === 'sound') setSound(!S.sound);
    else if (c === 'fx') setFx(!S.fx);
    else if (c === 'help') helpDialog();
  });
  $('#knob').addEventListener('click', () => { const k = $('#knob'); k.style.setProperty('--turn', `${(TABS.indexOf(route.tab) + 1) % TABS.length * 30 - 60}deg`); cycleTab(1); });

  // ── CRT noise texture ─────────────────────────────────────────────────
  (function grain() {
    const c = document.createElement('canvas'); c.width = c.height = 160;
    const x = c.getContext('2d'), img = x.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0);
    $('#crt-noise').style.backgroundImage = `url(${c.toDataURL()})`;
  })();

  // ── Boot ──────────────────────────────────────────────────────────────
  let bootState = 'running', bootTimers = [];
  const bootEl = $('#boot');
  function finishBoot() {
    if (bootState === 'done') return;
    bootState = 'done'; bootTimers.forEach(clearTimeout); bootTimers = [];
    try { sessionStorage.setItem('pip-booted', '1'); } catch { /* ignore */ }
    document.body.classList.remove('is-booting'); document.body.classList.add('is-on');
    bootEl.hidden = true;
    requestAnimationFrame(() => { placeNotch(); placeStrip(false); });
    blink();
  }
  function boot() {
    let seen = false;
    try { seen = sessionStorage.getItem('pip-booted') === '1'; } catch { /* ignore */ }
    if (seen || motion.matches) { finishBoot(); return; }
    const later = (fn, ms) => bootTimers.push(setTimeout(fn, ms));
    const dump = $('#boot-dump'), text = $('#boot-text'), splash = $('#boot-splash');
    const hex = n => `0x${Math.floor(Math.random() * 16 ** n).toString(16).toUpperCase().padStart(n, '0')}`;
    const phrases = ['start memory discovery', 'CPU0 starting cell relocation', 'CPU0 launch EFI', 'CPU0 starting EFI', 'mount holotape bus', 'scan apparel index', 'verify carry tables', 'load omod records'];
    let lines = [];
    for (let i = 0; i < 70; i++) lines.push(`${hex(6)} ${hex(16)} ${i % 4 ? hex(4) : phrases[i % phrases.length]} ${hex(2)} ${hex(8)}`);
    later(() => { bootEl.classList.add('is-dump'); }, 380);
    lines.forEach((l, i) => later(() => { dump.textContent += `${l}\n`; dump.scrollTop = dump.scrollHeight; }, 400 + i * 16));
    const BOOT = ['*************** PIP-OS(R) V7.1.0.8 ***************', '', 'COPYRIGHT 2075 ROBCO(R)', 'LOADER V1.1', 'EXEC VERSION 41.10', '64K RAM SYSTEM', '38911 BYTES FREE', 'NO HOLOTAPE FOUND', 'LOAD ROM(1): DEITRIX 303', 'LOAD ROM(2): BACKPACKS OF THE COMMONWEALTH',
      `  ${PACKS.length} APPAREL · ${MODS.length} MODS · ${PARTS.size} COMPONENTS · ${ITEMS.length} COLLECTIBLES`, '  1 SIGNAL DETECTED'];
    const t0 = 400 + lines.length * 16 + 120;
    later(() => { bootEl.classList.remove('is-dump'); bootEl.classList.add('is-text'); }, t0);
    BOOT.forEach((l, i) => later(() => { text.textContent += `${l}\n`; }, t0 + 80 + i * 75));
    const t1 = t0 + 80 + BOOT.length * 75 + 450;
    later(() => { bootEl.classList.remove('is-text'); bootEl.classList.add('is-splash'); }, t1);
    later(finishBoot, t1 + 1300);
  }
  bootEl.addEventListener('pointerdown', finishBoot);

  // ── Start ─────────────────────────────────────────────────────────────
  setColor(S.color);
  document.body.classList.toggle('fx-off', !S.fx);
  $('[data-ctl="fx"]').setAttribute('aria-pressed', String(!!S.fx));
  $('[data-ctl="sound"]').setAttribute('aria-pressed', String(!!S.sound));
  setLight(!!S.light);
  const hadHash = readHash();
  if (!hadHash) { route.tab = 'stat'; route.sub = 'status'; }
  render('tab');
  boot();
  addEventListener('hashchange', () => { if (readHash()) render('tab'); });
  addEventListener('resize', () => { placeNotch(); placeStrip(false); updateMore(); if (sheetOpen && !narrow.matches) closeSheet(false); });
  document.fonts?.ready.then(() => { placeNotch(); placeStrip(false); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) leaveRadio(); else if (route.tab === 'radio') refresh(); });
})();
