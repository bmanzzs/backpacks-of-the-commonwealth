(() => {
  'use strict';
  const section = document.getElementById('arc-showcase');
  const tile = document.getElementById('arc-tile');
  const panel = document.getElementById('arc-preview');
  const stage = panel.querySelector('.arc-stage');
  const poster = panel.querySelector('.arc-poster');
  const status = panel.querySelector('.arc-status');
  const video = panel.querySelector('video');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let viewer, loading, closeTimer, hoverTimer, pinned = false, mode = '3d', dismissedHover = false;
  let animate = !motion.matches, turntable = !motion.matches;
  const animationButton = panel.querySelector('[data-arc="animation"]');
  const orbitButton = panel.querySelector('[data-arc="orbit"]');
  const modeButton = panel.querySelector('[data-arc="mode"]');
  function sync() {
    animationButton.setAttribute('aria-pressed', String(animate));
    animationButton.textContent = animate ? 'Pause animation' : 'Play animation';
    orbitButton.setAttribute('aria-pressed', String(turntable));
    orbitButton.hidden = mode !== '3d';
    panel.querySelector('[data-arc="reset"]').hidden = mode !== '3d';
    modeButton.textContent = mode === '3d' ? 'Watch render' : 'Try 3D';
    viewer?.setMotion(animate, turntable);
    if (mode === 'video') {
      if (animate && !panel.hidden && !document.hidden) video.play().catch(() => { status.textContent = 'Press play on the video to start the render.'; });
      else video.pause();
    }
  }
  function position() {
    if (panel.hidden) return;
    const r = tile.getBoundingClientRect(), width = panel.offsetWidth;
    let left = r.right - width, top = r.bottom + 8;
    if (innerWidth > 1000 && r.right + width + 12 < innerWidth) { left = r.right + 12; top = r.top; }
    if (top + panel.offsetHeight > innerHeight - 12) top = Math.max(12, innerHeight - panel.offsetHeight - 12);
    panel.style.left = Math.max(12, Math.min(left, innerWidth - width - 12)) + 'px';
    panel.style.top = Math.max(12, top) + 'px';
  }
  function fallback(message) {
    mode = 'video'; viewer?.setActive(false); viewer?.setVisible(false);
    video.hidden = false; poster.hidden = true;
    if (!video.querySelector('source')) {
      for (const [file, type] of [['turntable.webm','video/webm'],['turntable.mp4','video/mp4']]) {
        const source = document.createElement('source'); source.src = 'assets/previews/arc-tesla/' + file; source.type = type; video.append(source);
      }
      video.load();
    }
    status.textContent = message || 'Rendered turntable · use the video controls to pause or scrub.';
    sync(); position();
  }
  async function load3d() {
    mode = '3d'; video.pause(); video.hidden = true; sync();
    if (viewer) { viewer.setVisible(true); poster.hidden = true; viewer.setActive(!panel.hidden && !document.hidden); status.textContent = 'Drag to orbit · scroll or pinch to zoom · arrow keys to rotate'; return; }
    poster.hidden = false; status.textContent = 'Loading interactive preview…';
    if (!loading) loading = import('./arc-viewer.js').then(module => module.createArcViewer(stage, {
      onInteract() { turntable = false; sync(); },
      onFailure() {
        viewer?.dispose(); viewer = null; loading = null;
        fallback('3D is unavailable on this device. Showing the rendered preview.');
      },
      onProgress(percent) { if (mode === '3d') status.textContent = `Loading interactive preview… ${percent}%`; }
    })).then(result => {
      viewer = result; viewer.setMotion(animate, turntable);
      viewer.setVisible(mode === '3d'); viewer.setActive(mode === '3d' && !panel.hidden && !document.hidden);
      if (mode === '3d') { poster.hidden = true; status.textContent = 'Drag to orbit · scroll or pinch to zoom · arrow keys to rotate'; }
    }).catch(() => { loading = null; if (mode === '3d') fallback('3D could not load. Showing the rendered preview.'); });
    await loading;
  }
  function open(pin = false) {
    if (pin) dismissedHover = false;
    clearTimeout(closeTimer); clearTimeout(hoverTimer);
    if (pin) pinned = true;
    panel.hidden = false; tile.setAttribute('aria-expanded', 'true'); position();
    if (mode === '3d') load3d(); else fallback();
    if (pin) panel.querySelector('.arc-close').focus({preventScroll:true});
  }
  function close(restoreFocus = false) {
    if (restoreFocus) dismissedHover = true;
    clearTimeout(closeTimer); clearTimeout(hoverTimer);
    panel.hidden = true; pinned = false; tile.setAttribute('aria-expanded', 'false');
    viewer?.setActive(false); video.pause();
    if (restoreFocus) { suppressFocus = true; tile.focus({preventScroll:true}); suppressFocus = false; }
  }
  function delayedClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (!pinned && !panel.matches(':hover') && !tile.matches(':hover') && !panel.contains(document.activeElement) && document.activeElement !== tile) close();
    }, 350);
  }
  let suppressFocus = false;
  tile.addEventListener('pointerenter', e => { if (!dismissedHover && fine.matches && e.pointerType !== 'touch') hoverTimer = setTimeout(() => open(), 220); });
  tile.addEventListener('pointerleave', () => { dismissedHover = false; clearTimeout(hoverTimer); delayedClose(); });
  tile.addEventListener('focus', () => { if (!suppressFocus && fine.matches) open(); });
  tile.addEventListener('blur', delayedClose);
  tile.addEventListener('click', () => open(true));
  panel.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  panel.addEventListener('pointerleave', delayedClose);
  panel.addEventListener('focusout', delayedClose);
  panel.querySelector('.arc-close').addEventListener('click', () => close(true));
  animationButton.addEventListener('click', () => { animate = !animate; sync(); });
  orbitButton.addEventListener('click', () => { turntable = !turntable; sync(); });
  panel.querySelector('[data-arc="reset"]').addEventListener('click', () => { viewer?.reset(); turntable = !motion.matches; sync(); });
  modeButton.addEventListener('click', () => mode === '3d' ? fallback() : load3d());
  video.addEventListener('error', () => { status.textContent = 'The render could not load. Try 3D or open the MP4 below.'; });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); close(true); } });
  document.addEventListener('pointerdown', event => { if (!panel.hidden && !panel.contains(event.target) && !tile.contains(event.target)) close(); });
  document.addEventListener('visibilitychange', () => {
    viewer?.setActive(!document.hidden && !panel.hidden && mode === '3d'); sync();
  });
  motion.addEventListener('change', () => { if (motion.matches) { animate = false; turntable = false; sync(); } });
  window.addEventListener('resize', position);
  new ResizeObserver(position).observe(panel);
  window.addEventListener('scroll', () => { if (!pinned) close(); else position(); }, {passive:true});
  window.updateArcPreview = () => {
    const query = catalogQuery();
    section.hidden = catalogCategory !== 'backpacks' || catalogView !== 'grid' || !'arc-tesla arc tesla p.c.d. mk iv atomic resonance carrier animated 3d preview'.includes(query);
    if (section.hidden) close();
    else if (query && document.getElementById('catalog-empty').hidden === false) document.getElementById('catalog-empty').hidden = true;
  };
  sync(); window.updateArcPreview();
})();
