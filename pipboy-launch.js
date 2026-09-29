// "Open Pip-Boy here": prefetch on first hover, a CRT switch-off on click, and one
// peek of the bobblehead on touch screens (which have no hover).
(() => {
  'use strict';
  const link = document.querySelector('.pb-launch');
  if (!link) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  link.addEventListener('pointerenter', () => {
    const l = document.createElement('link');
    l.rel = 'prefetch'; l.href = link.href;
    document.head.append(l);
  }, { once: true });
  link.addEventListener('click', e => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || reduce.matches) return;
    e.preventDefault();
    const wipe = document.createElement('div');
    wipe.className = 'pb-wipe'; wipe.innerHTML = '<i></i>';
    document.body.append(wipe);
    setTimeout(() => { location.href = link.href; }, 520);
  });
  // Coming back with the Back button restores this page from cache with the wipe still on it.
  addEventListener('pageshow', e => { if (e.persisted) document.querySelector('.pb-wipe')?.remove(); });
  if (matchMedia('(hover: none)').matches && !reduce.matches) {
    setTimeout(() => {
      link.classList.add('is-teasing');
      setTimeout(() => link.classList.remove('is-teasing'), 2600);
    }, 3500);
  }
})();
