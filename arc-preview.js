// The Arc-tesla 3D preview. It opens from any ARC badge ([data-arc-open], built by arcBadge() in index.html):
// the grid card, the table row, the details page and the map callout. The panel sits next to the badge it came from.
(() => {
  'use strict';
  const panel = document.getElementById('arc-preview');
  if (!panel) return;
  const stage = panel.querySelector('.arc-stage');
  const poster = panel.querySelector('.arc-poster');
  const status = panel.querySelector('.arc-status');
  const video = panel.querySelector('video');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let viewer, loading, anchor = null, mode = '3d';
  let animate = !motion.matches, turntable = !motion.matches;
  const animationButton = panel.querySelector('[data-arc="animation"]');
  const orbitButton = panel.querySelector('[data-arc="orbit"]');
  const modeButton = panel.querySelector('[data-arc="mode"]');
  const statsButton = panel.querySelector('[data-arc="stats"]');
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
  const visible = el => Boolean(el?.isConnected && el.getClientRects().length);
  // Beside the badge on wide screens, otherwise below it (or above when there is more room there).
  function position() {
    if (panel.hidden) return;
    if (!visible(anchor)) { close(); return; }
    const r = anchor.getBoundingClientRect(), width = panel.offsetWidth, height = panel.offsetHeight;
    if (r.bottom < 0 || r.top > innerHeight) { close(); return; } // scrolled away from its badge
    let left = r.left, top = r.bottom + 8;
    if (innerWidth > 1000 && r.right + width + 12 < innerWidth) { left = r.right + 12; top = r.top; }
    else if (top + height > innerHeight - 12 && r.top - 8 - height >= 12) top = r.top - 8 - height;
    if (top + height > innerHeight - 12) top = Math.max(12, innerHeight - height - 12);
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
  function open(badge) {
    if (anchor && anchor !== badge) anchor.setAttribute('aria-expanded', 'false');
    anchor = badge;
    anchor.setAttribute('aria-expanded', 'true');
    statsButton.hidden = Boolean(anchor.closest('#modal')); // already on the stats page
    panel.hidden = false; position();
    if (mode === '3d') load3d(); else fallback();
    panel.querySelector('.arc-close').focus({ preventScroll: true });
  }
  function close(restoreFocus = false) {
    if (panel.hidden) return;
    panel.hidden = true;
    anchor?.setAttribute('aria-expanded', 'false');
    viewer?.setActive(false); video.pause();
    if (restoreFocus && visible(anchor)) anchor.focus({ preventScroll: true });
  }
  // Capture phase: a badge sits inside a clickable card, table row or callout, which must not open as well.
  document.addEventListener('click', event => {
    const badge = event.target.closest?.('[data-arc-open]');
    if (!badge) return;
    event.preventDefault(); event.stopPropagation();
    if (!panel.hidden && anchor === badge) close(true); else open(badge);
  }, true);
  panel.querySelector('.arc-close').addEventListener('click', () => close(true));
  animationButton.addEventListener('click', () => { animate = !animate; sync(); });
  orbitButton.addEventListener('click', () => { turntable = !turntable; sync(); });
  panel.querySelector('[data-arc="reset"]').addEventListener('click', () => { viewer?.reset(); turntable = !motion.matches; sync(); });
  modeButton.addEventListener('click', () => mode === '3d' ? fallback() : load3d());
  // The Arc-tesla is catalog entry 29 since 2.1.0: open its stats page from the preview.
  statsButton.addEventListener('click', () => {
    const idx = BACKPACKS.findIndex(bp => bp.id === 'BPArc');
    if (idx < 0 || typeof openModal !== 'function') return;
    close();
    openModal(idx);
  });
  video.addEventListener('error', () => { status.textContent = 'The render could not load. Try 3D or open the MP4 below.'; });
  // Escape closes the preview first, before the details page or the map underneath it.
  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || panel.hidden) return;
    event.preventDefault(); event.stopImmediatePropagation();
    close(true);
  }, true);
  document.addEventListener('pointerdown', event => { if (!panel.hidden && !panel.contains(event.target) && !anchor?.contains(event.target)) close(); });
  document.addEventListener('visibilitychange', () => {
    viewer?.setActive(!document.hidden && !panel.hidden && mode === '3d'); sync();
  });
  motion.addEventListener('change', () => { if (motion.matches) { animate = false; turntable = false; sync(); } });
  window.addEventListener('resize', position);
  new ResizeObserver(position).observe(panel);
  document.addEventListener('scroll', position, { capture: true, passive: true });
  // Called after searches and view changes (collectibles.js, survey.js): close when the badge is filtered out.
  window.updateArcPreview = position;
  sync();
})();
