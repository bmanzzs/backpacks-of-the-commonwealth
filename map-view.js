// Interactive field map of backpack locations.
// Plain scrolling always scrolls the page. The map zooms with Ctrl/⌘ + scroll, trackpad or
// touch pinch, double-click, the toolbar, or keys; plain scroll zooms only in the expanded
// view, where there is no page behind it to scroll.
(() => {
  'use strict';
  // Pin positions: percent of the map image's width and height, hand-placed by the author.
  const MAP_PINS = {1: [29.9, 15.0], 2: [37.1, 11.3], 3: [34.8, 21.0], 4: [22.6, 33.7], 5: [40.5, 24.9], 6: [58.8, 18.8], 7: [57.7, 34.5], 8: [69.5, 8.6], 9: [68.0, 27.6], 10: [37.6, 39.9], 11: [56.0, 49.0], 12: [58.6, 27.4], 13: [55.3, 50.9], 14: [70.7, 43.5], 15: [55.6, 58.0], 16: [32.0, 61.8], 17: [46.4, 40.7], 18: [7.0, 35.7], 19: [66.3, 53.5], 20: [10.7, 92.6], 21: [64.4, 72.9], 22: [9.9, 81.2], 23: [84.5, 14.2], 24: [48.5, 70.9], 25: [34.8, 75.7], 26: [61.8, 51.7], 27: [61.0, 75.2], 28: [82.2, 48.3], 29: [31.7, 89.6]};
  const IMAGE = { base: 'assets/map/commonwealth-2k.webp', baseWidth: 2079, detail: 'assets/map/commonwealth-4k.webp' };
  const W = 4158, H = 4155;             // world units = full-resolution map pixels (.map-img size in CSS)
  const MAX_SCALE = 1.25;               // deepest zoom, relative to full resolution
  const DETAIL_WIDTH = 1400;            // on-screen map width at which pins show thumbnails
  const PIN = { small: 22, large: 46 }; // .map-pin sizes in map-view.css

  const section = document.getElementById('map-view');
  const shell = document.getElementById('map-shell');
  const stage = document.getElementById('map-stage');
  const pinLayer = document.getElementById('map-pins');
  const list = document.getElementById('map-list');
  const tip = document.getElementById('map-tip');
  const callout = document.getElementById('map-callout');
  const hint = document.getElementById('map-hint');
  const statusEl = document.getElementById('map-status');
  const zoomEl = document.getElementById('map-zoom');
  const help = document.getElementById('map-help');
  const control = name => shell.querySelector(`[data-map="${name}"]`);
  // An immersive map (the Pip-Boy) has no page behind it: plain scroll zooms and one finger pans.
  const immersive = section.hasAttribute('data-immersive');
  const zoomInButton = control('zoom-in'), zoomOutButton = control('zoom-out'), expandButton = control('expand');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)');
  const mod = /Mac|iPhone|iPad|iPod/.test(navigator.userAgentData?.platform || navigator.platform || '') ? '⌘' : 'Ctrl';

  const view = { s: 1, x: 0, y: 0 };    // screen point = world point × s + (x, y)
  const pins = [], images = [];
  let stageW = 0, stageH = 0, fit = 1, built = false, expanded = false, detailed = null, detailLoading = false;
  let match = () => true, raf = 0, last = 0, anim = null, selected = null, hot = null, tipFor = null;
  let tipSize = { w: 0, h: 0 }, calloutSize = { w: 0, h: 0 }, readout = '', hintTimer = 0;
  const free = () => expanded || immersive;

  const pad2 = n => String(n).padStart(2, '0');
  const place = bp => { const parts = bp.location.split(' — '); return parts.length > 1 ? parts.slice(1).join(' — ').trim() : bp.location; };
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const pinHalf = () => (detailed ? PIN.large : PIN.small) / 2;
  const maxScale = () => Math.max(MAX_SCALE, fit * 2);
  const clampScale = s => Math.min(maxScale(), Math.max(fit, s));
  function clamp(v) {
    const s = clampScale(v.s), w = W * s, h = H * s;
    return {
      s,
      x: w <= stageW ? (stageW - w) / 2 : Math.min(0, Math.max(stageW - w, v.x)),
      y: h <= stageH ? (stageH - h) / 2 : Math.min(0, Math.max(stageH - h, v.y))
    };
  }
  const fitView = () => clamp({ s: fit, x: 0, y: 0 });
  // Zoom `from` by `factor`, keeping the screen point (ax, ay) over the same spot on the map.
  function zoomed(from, factor, ax, ay) {
    const s = clampScale(from.s * factor), k = s / from.s;
    return clamp({ s, x: ax - (ax - from.x) * k, y: ay - (ay - from.y) * k });
  }
  function local(e) { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  // ── Motion ─────────────────────────────────────────────────────────────
  function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(50, now - last) : 16;
    last = now;
    if (anim && anim.step(now, dt) === false) anim = null;
    render();
    if (anim) schedule(); else last = 0;
  }
  function stop() { anim = null; }
  function jump(v) { Object.assign(view, clamp(v)); schedule(); }
  // Eased move; zoom is interpolated in log space around the anchor so the anchor stays put.
  function tween(target, duration = 300, ax = stageW / 2, ay = stageH / 2) {
    const from = { ...view }, to = clamp(target);
    if (motion.matches) { stop(); return jump(to); }
    const wx = (ax - from.x) / from.s, wy = (ay - from.y) / from.s;
    const ex = to.x - (ax - wx * to.s), ey = to.y - (ay - wy * to.s);
    const start = performance.now();
    anim = { target: to, step(now) {
      const t = Math.min(1, Math.max(0, (now - start) / duration)), k = easeOut(t);
      if (t >= 1) { Object.assign(view, to); return false; }
      const s = from.s * Math.pow(to.s / from.s, k);
      Object.assign(view, clamp({ s, x: ax - wx * s + ex * k, y: ay - wy * s + ey * k }));
      return true;
    } };
    schedule();
  }
  // Wheel notches ease toward an accumulating target instead of jumping.
  function chase(target) {
    if (motion.matches) { stop(); return jump(target); }
    if (anim?.chase) { anim.target = target; return schedule(); }
    anim = { chase: true, target, step(now, dt) {
      const k = 1 - Math.exp(-dt / 70), t = this.target;
      Object.assign(view, clamp({ s: view.s + (t.s - view.s) * k, x: view.x + (t.x - view.x) * k, y: view.y + (t.y - view.y) * k }));
      if (Math.abs(t.s - view.s) < t.s * 1e-3 && Math.abs(t.x - view.x) < 0.3 && Math.abs(t.y - view.y) < 0.3) { Object.assign(view, t); return false; }
      return true;
    } };
    schedule();
  }
  // Long moves zoom out a little mid-flight (van Wijk & Nuij, as in d3.interpolateZoom).
  function zoomPath([x0, y0, w0], [x1, y1, w1]) {
    const rho = Math.SQRT2, dx = x1 - x0, dy = y1 - y0, d2 = dx * dx + dy * dy;
    let path, S;
    if (d2 < 1e-12) {
      S = Math.log(w1 / w0) / rho;
      path = t => [x0 + t * dx, y0 + t * dy, w0 * Math.exp(rho * t * S)];
    } else {
      const d1 = Math.sqrt(d2);
      const b0 = (w1 * w1 - w0 * w0 + 4 * d2) / (4 * w0 * d1), b1 = (w1 * w1 - w0 * w0 - 4 * d2) / (4 * w1 * d1);
      const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0), r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
      S = (r1 - r0) / rho;
      path = t => {
        const s = t * S, u = w0 / (2 * d1) * (Math.cosh(r0) * Math.tanh(rho * s + r0) - Math.sinh(r0));
        return [x0 + u * dx, y0 + u * dy, w0 * Math.cosh(r0) / Math.cosh(rho * s + r0)];
      };
    }
    path.duration = Math.abs(S) * 1000;
    return path;
  }
  function fly(target) {
    const to = clamp(target);
    if (motion.matches) { stop(); return jump(to); }
    const size = Math.max(stageW, stageH);
    const centre = v => [(stageW / 2 - v.x) / v.s, (stageH / 2 - v.y) / v.s, size / v.s];
    const path = zoomPath(centre(view), centre(to)), duration = Math.min(1300, Math.max(450, path.duration * 0.9));
    const start = performance.now();
    anim = { target: to, step(now) {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      if (t >= 1) { Object.assign(view, to); return false; }
      const [cx, cy, w] = path(easeInOut(t)), s = size / w;
      Object.assign(view, clamp({ s, x: stageW / 2 - cx * s, y: stageH / 2 - cy * s }));
      return true;
    } };
    schedule();
  }
  function glide(trail, now) {
    if (motion.matches) return;
    const recent = trail.filter(p => now - p.t < 90);
    if (recent.length < 2) return;
    const a = recent[0], b = recent[recent.length - 1], dt = b.t - a.t;
    if (dt < 8) return;
    let vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
    const speed = Math.hypot(vx, vy);
    if (speed < 0.12) return;
    if (speed > 3) { vx *= 3 / speed; vy *= 3 / speed; }
    anim = { step(now, dt) {
      const x = view.x, y = view.y;
      Object.assign(view, clamp({ s: view.s, x: x + vx * dt, y: y + vy * dt }));
      if (view.x === x) vx = 0;
      if (view.y === y) vy = 0;
      const decay = Math.exp(-dt / 320);
      vx *= decay; vy *= decay;
      return Math.hypot(vx, vy) > 0.015;
    } };
    schedule();
  }
  const zoomBy = factor => tween(zoomed(anim?.target || view, factor, stageW / 2, stageH / 2), 280);

  // ── Drawing ────────────────────────────────────────────────────────────
  function render() {
    if (!stageW) return;
    const transform = `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.s})`;
    for (const img of images) img.style.transform = transform;
    const isDetailed = W * view.s >= DETAIL_WIDTH;
    if (isDetailed !== detailed) { detailed = isDetailed; pinLayer.classList.toggle('is-detailed', detailed); }
    const shown = pins.filter(p => p.shown);
    for (const p of shown) { p.sx = view.x + p.wx * view.s; p.sy = view.y + p.wy * view.s; p.ox = p.oy = 0; }
    declutter(shown, pinHalf() * 2 + 4);
    for (const p of shown) p.el.style.translate = `${Math.round(p.sx + p.ox)}px ${Math.round(p.sy + p.oy)}px`;
    if (tipFor) placeTip();
    if (selected) placeCallout();
    const r = (view.s / fit).toFixed(1) + '×';
    if (r !== readout) { readout = r; zoomEl.textContent = r; }
    setDisabled(zoomOutButton, view.s <= fit * 1.001);
    setDisabled(zoomInButton, view.s >= maxScale() * 0.999);
    if (W * view.s * (devicePixelRatio || 1) > IMAGE.baseWidth * 1.15) loadDetail();
  }
  function setDisabled(button, off) { if ((button.getAttribute('aria-disabled') === 'true') !== off) button.setAttribute('aria-disabled', String(off)); }
  // Nudge overlapping markers apart on screen; they settle onto their exact spots as you zoom in.
  function declutter(items, min) {
    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        const dx = b.sx + b.ox - a.sx - a.ox, dy = b.sy + b.oy - a.sy - a.oy;
        const overX = min - Math.abs(dx), overY = min - Math.abs(dy);
        if (overX <= 0 || overY <= 0) continue;
        moved = true;
        if (overX < overY) { const push = overX / 2 * (dx < 0 ? -1 : 1); a.ox -= push; b.ox += push; }
        else { const push = overY / 2 * (dy < 0 ? -1 : 1); a.oy -= push; b.oy += push; }
      }
      if (!moved) break;
    }
  }
  function placeTip() {
    const p = tipFor, half = pinHalf() + 8, x = p.sx + p.ox, y = p.sy + p.oy;
    let top = y - half - tipSize.h;
    if (top < 8) top = y + half;
    const left = Math.max(8, Math.min(stageW - tipSize.w - 8, x - tipSize.w / 2));
    tip.style.translate = `${Math.round(left)}px ${Math.round(top)}px`;
  }
  function placeCallout() {
    const p = selected, half = pinHalf() + 10, x = p.sx + p.ox, y = p.sy + p.oy;
    callout.classList.toggle('is-offscreen', x < -half || x > stageW + half || y < -half || y > stageH + half);
    let top = y - half - calloutSize.h;
    const below = top < 8;
    if (below) top = y + half;
    const left = Math.max(8, Math.min(stageW - calloutSize.w - 8, x - calloutSize.w / 2));
    callout.classList.toggle('is-below', below);
    callout.style.translate = `${Math.round(left)}px ${Math.round(top)}px`;
    callout.style.setProperty('--arrow-x', `${Math.round(Math.max(16, Math.min(calloutSize.w - 16, x - left)))}px`);
  }
  function addImage(src, alt) {
    const img = new Image();
    img.className = 'map-img'; img.alt = alt; img.draggable = false; img.decoding = 'async';
    img.src = src;
    images.push(img);
    stage.insertBefore(img, pinLayer);
    return img.decode().then(() => { img.classList.add('is-loaded'); return img; });
  }
  function loadDetail() {
    if (detailLoading || !built) return;
    detailLoading = true;
    addImage(IMAGE.detail, '').then(() => setTimeout(() => { images[0].hidden = true; }, 400), () => {});
    schedule();
  }

  // ── Hover tip, selection, list ─────────────────────────────────────────
  function setHot(p) {
    if (hot === p) return;
    hot?.el.classList.remove('is-hot'); hot?.item.classList.remove('is-hot');
    hot = p || null;
    hot?.el.classList.add('is-hot'); hot?.item.classList.add('is-hot');
  }
  function showTip(p) {
    if (p === selected) return hideTip();
    const img = tip.querySelector('img');
    img.hidden = !IMGS[p.idx];
    if (IMGS[p.idx]) img.src = IMGS[p.idx];
    tip.querySelector('.map-tip-meta').textContent = `${pad2(p.num)} · LVL ${p.bp.level}`;
    tip.querySelector('.map-tip-name').textContent = p.bp.name;
    tip.querySelector('.map-tip-loc').textContent = place(p.bp);
    tipFor = p;
    tipSize = { w: tip.offsetWidth, h: tip.offsetHeight };
    placeTip();
    tip.classList.add('is-visible');
  }
  function hideTip() { tipFor = null; tip.classList.remove('is-visible'); }
  function fillCallout(p) {
    const bp = p.bp, img = callout.querySelector('.map-callout-img');
    img.hidden = !IMGS[p.idx];
    if (IMGS[p.idx]) img.src = IMGS[p.idx];
    callout.querySelector('.map-callout-meta').textContent = `${pad2(p.num)} · LVL ${bp.level}`;
    callout.querySelector('.map-callout-name').textContent = bp.name;
    callout.querySelector('.map-callout-loc').textContent = place(bp);
    callout.querySelector('.cc').textContent = bp.cc.split('/')[0].replace(/\s*CC\s*$/i, '').trim() + ' CC';
    callout.querySelector('.dr').textContent = bp.dr.split('→')[0].split('|')[0].trim();
    callout.querySelector('.wt').textContent = bp.weight;
    callout.hidden = false;
    calloutSize = { w: callout.offsetWidth, h: callout.offsetHeight };
  }
  // Frame a pin a little below centre, leaving room for its callout above.
  function focusView(p) {
    const s = clampScale(Math.max(view.s, fit * 3, 0.34));
    return clamp({ s, x: stageW / 2 - p.wx * s, y: stageH * 0.62 - p.wy * s });
  }
  // Pan just enough to bring a pin clicked near the edge fully into view.
  function reveal(p) {
    const m = pinHalf() + 14, x = view.x + p.wx * view.s, y = view.y + p.wy * view.s;
    const dx = x < m ? m - x : x > stageW - m ? stageW - m - x : 0;
    const dy = y < m ? m - y : y > stageH - m ? stageH - m - y : 0;
    if (dx || dy) tween({ s: view.s, x: view.x + dx, y: view.y + dy }, 240);
  }
  function select(p, how) {
    if (selected) { selected.el.classList.remove('is-selected'); selected.item.classList.remove('is-selected'); selected.item.removeAttribute('aria-current'); }
    selected = p || null;
    if (!selected) { callout.hidden = true; return schedule(); }
    hideTip();
    p.el.classList.add('is-selected'); p.item.classList.add('is-selected'); p.item.setAttribute('aria-current', 'true');
    fillCallout(p);
    if (how === 'fly') fly(focusView(p)); else if (how === 'reveal') reveal(p);
    keepInList(p);
    schedule();
  }
  function step(direction) {
    const shown = pins.filter(p => p.shown);
    if (!shown.length) return;
    const i = selected ? shown.indexOf(selected) : direction > 0 ? -1 : 0;
    select(shown[(i + direction + shown.length) % shown.length], 'fly');
  }
  function keepInList(p) {
    if (list.scrollHeight <= list.clientHeight + 1) return; // the list only scrolls on its own beside the map
    const item = p.item.parentElement, top = item.offsetTop, bottom = top + item.offsetHeight;
    const behavior = motion.matches ? 'auto' : 'smooth';
    if (top < list.scrollTop + 4) list.scrollTo({ top: top - 4, behavior });
    else if (bottom > list.scrollTop + list.clientHeight - 4) list.scrollTo({ top: bottom - list.clientHeight + 4, behavior });
  }
  const pinFrom = target => pins.find(p => p.el === target.closest?.('.map-pin'));
  const itemFrom = target => pins.find(p => p.item === target.closest?.('.map-list-item'));

  // ── Gesture hint and help ──────────────────────────────────────────────
  function nudge(kind) {
    hint.textContent = kind === 'touch' ? 'Use two fingers to move the map' : `Hold ${mod} + scroll to zoom`;
    hint.classList.add('is-visible');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(hideHint, kind === 'touch' ? 1500 : 1100);
  }
  function hideHint() { clearTimeout(hintTimer); hint.classList.remove('is-visible'); }
  function updateHelp() {
    const touchFirst = coarse.matches;
    help.innerHTML = free()
      ? touchFirst ? '<kbd>Drag</kbd> to pan · <kbd>Pinch</kbd> to zoom · <kbd>Double-tap</kbd> to zoom in'
        : `<kbd>Drag</kbd> to pan · <kbd>Scroll</kbd> to zoom${expanded ? ' · <kbd>Esc</kbd> to close' : ''}`
      : touchFirst ? '<kbd>Two fingers</kbd> to pan and zoom · <kbd>Double-tap</kbd> to zoom in · <kbd>Expand</kbd> for full screen'
        : `<kbd>Drag</kbd> to pan · <kbd>${mod} + scroll</kbd> or pinch to zoom · <kbd>Double-click</kbd> to zoom in`;
  }

  // ── Expanded view ──────────────────────────────────────────────────────
  function setExpanded(on) {
    if (on === expanded) return;
    expanded = on;
    stop(); hideTip(); hideHint();
    shell.classList.toggle('is-expanded', on);
    document.body.classList.toggle('map-expanded', on);
    expandButton.setAttribute('aria-pressed', String(on));
    expandButton.setAttribute('aria-label', on ? 'Close full-screen map' : 'Expand map to full screen');
    expandButton.querySelector('.map-btn-label').textContent = on ? 'CLOSE' : 'EXPAND';
    expandButton.querySelector('path').setAttribute('d', on ? 'M14.5 6.5h-5v-5M9.5 6.5l5-5M1.5 9.5h5v5M6.5 9.5l-5 5' : 'M9.5 1.5h5v5M14.5 1.5 9 7M6.5 14.5h-5v-5M1.5 14.5 7 9');
    updateHelp();
    if (on) { loadDetail(); stage.focus({ preventScroll: true }); } else expandButton.focus({ preventScroll: true });
  }

  // ── Build ──────────────────────────────────────────────────────────────
  function build() {
    if (built) return;
    built = true;
    BACKPACKS.forEach((bp, idx) => {
      const pos = MAP_PINS[bp.num];
      if (!pos) return;
      const img = IMGS[idx];
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'map-pin'; el.tabIndex = -1; el.dataset.num = bp.num;
      el.setAttribute('aria-hidden', 'true'); // the location list is the accessible equivalent
      el.innerHTML = `<span class="map-pin-body">${img ? `<img class="map-pin-img" src="${img}" alt="" draggable="false">` : ''}<span class="map-pin-num">${pad2(bp.num)}</span></span>`;
      pinLayer.append(el);
      const li = document.createElement('li');
      li.innerHTML = `<button type="button" class="map-list-item">${img ? `<img class="map-list-thumb" src="${img}" alt="">` : '<span class="map-list-thumb"></span>'}<span class="map-list-num">${pad2(bp.num)}</span><span class="map-list-text"><span class="map-list-name"></span><span class="map-list-loc"></span></span><span class="map-list-lvl">LVL ${bp.level}</span></button>`;
      li.querySelector('.map-list-name').textContent = bp.name;
      li.querySelector('.map-list-loc').textContent = place(bp);
      list.append(li);
      pins.push({ bp, idx, num: bp.num, wx: pos[0] / 100 * W, wy: pos[1] / 100 * H, sx: 0, sy: 0, ox: 0, oy: 0, el, item: li.firstElementChild, shown: true });
    });
    addImage(IMAGE.base, 'Map of the Commonwealth, coloured by expected threat level')
      .then(() => { statusEl.hidden = true; }, () => { statusEl.firstElementChild.textContent = 'MAP IMAGE UNAVAILABLE'; });
    measure();
    Object.assign(view, fitView());
    new ResizeObserver(onResize).observe(stage);
    updateHelp();
    filter(match);
  }
  function measure() { stageW = stage.clientWidth; stageH = stage.clientHeight; fit = Math.min(stageW / W, stageH / H) || 1; }
  // Keep the same spot centred and the same relative zoom when the stage changes size.
  function onResize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h || (w === stageW && h === stageH)) return;
    const hadSize = stageW > 0, rel = view.s / fit;
    const cx = (stageW / 2 - view.x) / view.s, cy = (stageH / 2 - view.y) / view.s;
    measure(); stop();
    if (!hadSize) { Object.assign(view, fitView()); return schedule(); }
    const s = clampScale(rel * fit);
    jump({ s, x: w / 2 - cx * s, y: h / 2 - cy * s });
    if (selected) calloutSize = { w: callout.offsetWidth, h: callout.offsetHeight };
  }
  function filter(fn) {
    match = fn || (() => true);
    if (!built) return;
    let count = 0;
    for (const p of pins) {
      p.shown = !!match(p.bp);
      p.el.hidden = !p.shown;
      p.item.parentElement.hidden = !p.shown;
      if (p.shown) count++;
    }
    if (selected && !selected.shown) select(null);
    if (tipFor && !tipFor.shown) hideTip();
    if (hot && !hot.shown) setHot(null);
    document.getElementById('map-count').textContent = count === pins.length ? `${count} LOCATIONS` : `${count} OF ${pins.length} LOCATIONS`;
    document.getElementById('map-list-count').textContent = count;
    document.getElementById('map-list-empty').hidden = count > 0;
    schedule();
  }
  function show() { build(); schedule(); }
  function hide() { if (!built) return; setExpanded(false); stop(); hideTip(); hideHint(); setHot(null); if (immersive) select(null); }

  // ── Input: mouse and pen ───────────────────────────────────────────────
  let drag = null, suppressClick = false, lastDoubleTap = -1e9;
  stage.addEventListener('pointerdown', e => {
    suppressClick = false;
    if (!built || e.pointerType === 'touch' || e.button !== 0 || e.target.closest('.map-callout')) return;
    stop();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, from: { ...view }, moved: false, trail: [{ t: e.timeStamp, x: e.clientX, y: e.clientY }] };
  });
  stage.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      stage.setPointerCapture(e.pointerId);
      stage.classList.add('is-dragging');
      hideTip(); setHot(null);
    }
    jump({ s: view.s, x: drag.from.x + dx, y: drag.from.y + dy });
    drag.trail.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    if (drag.trail.length > 8) drag.trail.shift();
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.moved) {
      suppressClick = true;
      stage.classList.remove('is-dragging');
      if (e.type === 'pointerup') glide(drag.trail, e.timeStamp);
    }
    drag = null;
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('lostpointercapture', endDrag);
  // A drag that ends over a pin must not select it.
  stage.addEventListener('click', e => { if (suppressClick) { suppressClick = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  stage.addEventListener('click', e => { if (!e.target.closest('.map-pin, .map-callout')) select(null); });
  stage.addEventListener('dblclick', e => {
    if (!built || e.target.closest('.map-callout') || e.timeStamp - lastDoubleTap < 600) return;
    e.preventDefault();
    const p = local(e);
    tween(zoomed(anim?.target || view, e.shiftKey ? 0.5 : 2, p.x, p.y), 320, p.x, p.y);
  });

  // Plain wheel belongs to the page unless the map is expanded or immersive.
  stage.addEventListener('wheel', e => {
    if (!built) return;
    if (!free() && !e.ctrlKey && !e.metaKey) return nudge('wheel');
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * stageH : e.deltaY;
    if (!dy) return;
    // Mouse wheels send large steps (Chrome on macOS: multiples of 4.000244); trackpads and pinches send small ones.
    const notch = Math.abs(dy) >= 40 || Math.abs(dy % 4.000244140625) < 1e-6;
    const factor = Math.min(2, Math.max(0.5, Math.exp(-dy * (notch ? 0.0026 : 0.011))));
    const p = local(e);
    hideHint(); hideTip();
    if (notch) chase(zoomed(anim?.chase ? anim.target : view, factor, p.x, p.y));
    else { stop(); jump(zoomed(view, factor, p.x, p.y)); }
  }, { passive: false });

  // Safari reports trackpad pinches as gesture events rather than ctrl + wheel.
  let gesture = null;
  stage.addEventListener('gesturestart', e => { e.preventDefault(); gesture = touch ? null : { ...view }; });
  stage.addEventListener('gesturechange', e => {
    e.preventDefault();
    if (!gesture) return;
    const p = local(e);
    stop(); jump(zoomed(gesture, e.scale, p.x, p.y));
  });
  stage.addEventListener('gestureend', e => { e.preventDefault(); gesture = null; });

  // ── Input: touch ───────────────────────────────────────────────────────
  // Inline, one finger scrolls the page and two fingers pinch or pan the map.
  // Expanded, one finger pans too.
  let touch = null, lastTap = null;
  // Every finger on the map counts, even when one lands on a pin and another on bare map
  // (targetTouches would only list fingers on the same element).
  const stageTouches = e => [...e.touches].filter(t => stage.contains(t.target));
  function touchPoints(e) { const r = stage.getBoundingClientRect(); return stageTouches(e).map(t => ({ x: t.clientX - r.left, y: t.clientY - r.top })); }
  function beginTouch(e, continuing) {
    const pts = touchPoints(e);
    if (pts.length >= 2) {
      const [a, b] = pts, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      touch = { kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: view.s, wx: (mx - view.x) / view.s, wy: (my - view.y) / view.s };
    } else if (pts.length === 1) {
      touch = { kind: free() ? 'pan' : 'page', start: pts[0], from: { ...view }, moved: continuing, trail: [{ t: e.timeStamp, ...pts[0] }] };
    } else touch = null;
  }
  stage.addEventListener('touchstart', e => {
    if (!built) return;
    if (stageTouches(e).length === 1 && e.target.closest('.map-callout')) { touch = null; return; }
    stop(); hideTip();
    beginTouch(e, false);
  }, { passive: false });
  stage.addEventListener('touchmove', e => {
    if (!touch) return;
    const pts = touchPoints(e);
    if (touch.kind === 'pinch' && pts.length >= 2) {
      if (!e.cancelable) { touch = null; return; } // the page is already scrolling
      e.preventDefault();
      const [a, b] = pts, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const s = clampScale(touch.s * Math.hypot(a.x - b.x, a.y - b.y) / touch.dist);
      jump({ s, x: mx - touch.wx * s, y: my - touch.wy * s });
      hideHint();
    } else if (touch.kind === 'pan' && pts.length === 1) {
      e.preventDefault();
      const p = pts[0], dx = p.x - touch.start.x, dy = p.y - touch.start.y;
      if (!touch.moved && Math.hypot(dx, dy) > 6) touch.moved = true;
      if (!touch.moved) return;
      jump({ s: view.s, x: touch.from.x + dx, y: touch.from.y + dy });
      touch.trail.push({ t: e.timeStamp, ...p });
      if (touch.trail.length > 8) touch.trail.shift();
    } else if (touch.kind === 'page' && pts.length === 1 && !touch.moved) {
      const dx = pts[0].x - touch.start.x, dy = pts[0].y - touch.start.y;
      if (Math.hypot(dx, dy) < 10) return;
      touch.moved = true;
      if (view.s > fit * 1.02 || Math.abs(dx) > Math.abs(dy) * 1.5) nudge('touch');
    }
  }, { passive: false });
  function endTouch(e) {
    if (!touch) return;
    const remaining = stageTouches(e).length;
    if (e.type === 'touchend' && remaining === 0) {
      if (touch.kind === 'pan' && touch.moved) glide(touch.trail, e.timeStamp);
      else if (touch.kind !== 'pinch' && !touch.moved && e.changedTouches.length === 1) tap(e);
    }
    if (remaining) beginTouch(e, true); else touch = null;
  }
  stage.addEventListener('touchend', endTouch, { passive: false });
  stage.addEventListener('touchcancel', endTouch);
  function tap(e) {
    const t = e.changedTouches[0], r = stage.getBoundingClientRect(), p = { x: t.clientX - r.left, y: t.clientY - r.top };
    if (lastTap && e.timeStamp - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
      e.preventDefault(); // no synthetic click or browser zoom for the second tap
      lastTap = null; lastDoubleTap = e.timeStamp;
      tween(zoomed(view, 2, p.x, p.y), 300, p.x, p.y);
    } else lastTap = { t: e.timeStamp, ...p };
  }

  // ── Input: keyboard and controls ───────────────────────────────────────
  stage.addEventListener('keydown', e => {
    if (e.target !== stage || e.altKey || e.ctrlKey || e.metaKey) return;
    const d = Math.round(Math.min(stageW, stageH) * 0.18), base = anim?.target || view;
    const pan = { ArrowLeft: [d, 0], ArrowRight: [-d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }[e.key];
    if (pan) tween({ s: base.s, x: base.x + pan[0], y: base.y + pan[1] }, 220);
    else if (e.key === '+' || e.key === '=') zoomBy(1.6);
    else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.6);
    else if (e.key === '0') tween(fitView(), 420);
    else return;
    e.preventDefault();
  });
  // Escape closes the innermost layer first: details modal, then callout, then expanded view.
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !built || section.style.display === 'none' || !stage.getClientRects().length) return;
    if (document.getElementById('modal-overlay')?.classList.contains('visible') || document.querySelector('[aria-modal="true"]')) return;
    if (selected) select(null);
    else if (expanded) setExpanded(false);
    else return;
    e.preventDefault();
  }, true);
  shell.querySelector('.map-controls').addEventListener('click', e => {
    const button = e.target.closest('[data-map]');
    if (!button || !built || button.getAttribute('aria-disabled') === 'true') return;
    const action = button.dataset.map;
    if (action === 'zoom-in') zoomBy(1.6);
    else if (action === 'zoom-out') zoomBy(1 / 1.6);
    else if (action === 'fit') tween(fitView(), 420);
    else if (action === 'expand') setExpanded(!expanded);
  });
  callout.addEventListener('click', e => {
    const action = e.target.closest('[data-callout]')?.dataset.callout;
    if (action === 'stats' && selected) {
      if (window.openBackpack) window.openBackpack(selected.num);
      else if (typeof openModal === 'function') openModal(selected.idx);
    }
    else if (action === 'prev') step(-1);
    else if (action === 'next') step(1);
    else if (action === 'close') select(null);
  });
  pinLayer.addEventListener('click', e => { const p = pinFrom(e.target); if (p && p !== selected) select(p, 'reveal'); });
  pinLayer.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse' || drag?.moved) return;
    const p = pinFrom(e.target);
    if (p && !p.el.contains(e.relatedTarget)) { showTip(p); setHot(p); }
  });
  pinLayer.addEventListener('pointerout', e => {
    const p = pinFrom(e.target);
    if (p && !p.el.contains(e.relatedTarget)) { if (tipFor === p) hideTip(); setHot(null); }
  });
  list.addEventListener('click', e => {
    const p = itemFrom(e.target);
    if (!p) return;
    select(p, 'fly');
    // Below the map on narrow screens: bring the map back into view for the flight.
    const r = stage.getBoundingClientRect();
    if (!free() && (r.top < 0 || r.bottom > innerHeight)) stage.scrollIntoView({ block: 'nearest', behavior: motion.matches ? 'auto' : 'smooth' });
  });
  list.addEventListener('pointerover', e => { if (e.pointerType === 'mouse') setHot(itemFrom(e.target)); });
  list.addEventListener('pointerleave', () => setHot(null));
  list.addEventListener('focusin', e => setHot(itemFrom(e.target)));
  list.addEventListener('focusout', () => setHot(null));
  coarse.addEventListener('change', updateHelp);

  // Start fetching the map when someone reaches for the Map View button, and
  // bring the whole panel on screen after they open it (main catalog only).
  const mapButton = document.getElementById('btn-map');
  let preloaded = false;
  const preload = () => { if (!preloaded && !built) { preloaded = true; new Image().src = IMAGE.base; } };
  if (mapButton) {
    for (const type of ['pointerenter', 'focus', 'touchstart']) mapButton.addEventListener(type, preload, { passive: true });
    mapButton.addEventListener('click', () => requestAnimationFrame(() => {
      if (section.style.display === 'none') return;
      const r = shell.getBoundingClientRect(), gap = 12;
      if (r.top >= gap && r.bottom <= innerHeight - gap) return;
      const top = r.height + gap * 2 <= innerHeight ? r.top - (innerHeight - r.height) / 2 : r.top - gap;
      window.scrollBy({ top, behavior: motion.matches ? 'auto' : 'smooth' });
    }));
  }

  // Fly to one backpack's pin, e.g. from the Pip-Boy inventory's "Show on map".
  function focus(num) {
    build();
    const p = pins.find(q => q.num === num);
    if (!p) return;
    if (!p.shown) filter(null);
    select(p, 'fly');
  }

  window.catalogMap = { show, hide, filter, focus, pins: MAP_PINS };
})();
