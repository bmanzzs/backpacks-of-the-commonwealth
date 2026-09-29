// Prototype teaser: the Arc-tesla backpack, previewed in 3D before it joins the catalog.
// Only the poster loads with the page. The 3D library and model load when someone powers it on;
// the rendered video is the fallback. Rendering pauses whenever the stage is off screen.
(() => {
  'use strict';
  const stage = document.getElementById('arc-stage');
  if (!stage) return;
  const poster = stage.querySelector('.arc-poster');
  const video = stage.querySelector('video');
  const power = document.getElementById('proto-power');
  const status = document.getElementById('arc-status');
  const controls = document.getElementById('arc-controls');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const animationButton = controls.querySelector('[data-arc="animation"]');
  const orbitButton = controls.querySelector('[data-arc="orbit"]');
  const resetButton = controls.querySelector('[data-arc="reset"]');
  const modeButton = controls.querySelector('[data-arc="mode"]');
  const HINT = 'Drag to orbit · scroll or pinch to zoom · arrow keys to rotate';
  let viewer = null, loading = null, mode = 'off', inView = false;
  let animate = !motion.matches, turntable = !motion.matches;

  function sync() {
    animationButton.setAttribute('aria-pressed', String(animate));
    animationButton.textContent = animate ? 'Pause animation' : 'Play animation';
    orbitButton.setAttribute('aria-pressed', String(turntable));
    orbitButton.hidden = resetButton.hidden = mode !== '3d';
    modeButton.textContent = mode === '3d' ? 'Watch render' : 'Try 3D';
    viewer?.setMotion(animate, turntable);
    viewer?.setActive(mode === '3d' && inView && !document.hidden);
    if (mode === 'video') {
      if (animate && inView && !document.hidden) video.play().catch(() => { status.textContent = 'Press play on the video to start the render.'; });
      else video.pause();
    }
  }
  function showVideo(message) {
    mode = 'video';
    viewer?.setActive(false);
    viewer?.setVisible(false);
    video.hidden = false; poster.hidden = true; power.hidden = true; controls.hidden = false;
    if (!video.querySelector('source')) {
      for (const [file, type] of [['turntable.webm', 'video/webm'], ['turntable.mp4', 'video/mp4']]) {
        const source = document.createElement('source');
        source.src = `assets/previews/arc-tesla/${file}`; source.type = type;
        video.append(source);
      }
      video.querySelector('source:last-of-type').addEventListener('error', () => { status.textContent = 'The render could not load. Try 3D or open the MP4.'; });
      video.load();
    }
    status.textContent = message || 'Rendered turntable · use the video controls to pause or scrub.';
    sync();
  }
  async function show3d() {
    mode = '3d';
    video.pause(); video.hidden = true; power.hidden = true; controls.hidden = false;
    if (viewer) { viewer.setVisible(true); poster.hidden = true; status.textContent = HINT; sync(); return; }
    poster.hidden = false;
    status.textContent = 'Loading interactive preview…';
    sync();
    if (!loading) loading = import('./arc-viewer.js').then(module => module.createArcViewer(stage, {
      onInteract() { turntable = false; sync(); },
      onFailure() { viewer?.dispose(); viewer = null; loading = null; showVideo('3D is unavailable on this device. Showing the rendered preview.'); },
      onProgress(percent) { if (mode === '3d') status.textContent = `Loading interactive preview… ${percent}%`; }
    })).then(result => {
      viewer = result;
      viewer.setVisible(mode === '3d');
      if (mode === '3d') { poster.hidden = true; status.textContent = HINT; }
      sync();
    }).catch(() => { loading = null; if (mode === '3d') showVideo('3D could not load. Showing the rendered preview.'); });
    await loading;
  }

  power.addEventListener('click', () => show3d());
  animationButton.addEventListener('click', () => { animate = !animate; sync(); });
  orbitButton.addEventListener('click', () => { turntable = !turntable; sync(); });
  resetButton.addEventListener('click', () => { viewer?.reset(); turntable = !motion.matches; sync(); });
  modeButton.addEventListener('click', () => (mode === '3d' ? showVideo() : show3d()));
  new IntersectionObserver(entries => { inView = entries.some(e => e.isIntersecting); sync(); }, { threshold: 0.15 }).observe(stage);
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', () => { if (motion.matches) { animate = false; turntable = false; sync(); } });
  status.textContent = 'Power on to load the interactive model (about 5 MB).';
})();
