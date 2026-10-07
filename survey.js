// Vault-Tec citizen survey: visitors rank their favourite backpacks (#1 earns the most points).
// Ballots go to the Google Apps Script in tools/vault-tec-survey.gs, which keeps them in its own
// storage. Results show in the ? panel. Nothing appears until survey-config.js has an endpoint.
(() => {
  'use strict';
  const config = window.VAULT_TEC_SURVEY || {};
  const endpoint = typeof config.endpoint === 'string' && /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(config.endpoint) ? config.endpoint : '';
  if (!endpoint || typeof BACKPACKS === 'undefined') return;
  const SURVEY = typeof config.id === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(config.id) ? config.id : 'favorites-1';
  const MAX = Math.min(5, Math.max(1, Math.round(Number(config.picks)) || 5));
  const POINTS = 5; // MAX_PICKS in tools/vault-tec-survey.gs: a #1 pick earns 5 points, each place below one less
  const RESULTS_TTL = 2 * 60 * 1000;
  const SNOOZE = 3 * 24 * 60 * 60 * 1000;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2 = n => String(n).padStart(2, '0');
  const count = n => (Number.isSafeInteger(n) && n > 0 ? n : 0);
  const BOBBLE = '<span class="survey-bobble" aria-hidden="true"><img class="survey-bobble-body" src="assets/pipboy/bobble-body.webp" alt=""><img class="survey-bobble-head" src="assets/pipboy/bobble-head.webp" alt=""></span>';

  const PACKS = BACKPACKS.map((bp, idx) => ({ num: bp.num, name: bp.name, level: bp.level, img: (typeof IMGS !== 'undefined' && IMGS[idx]) || '' }));
  const byNum = new Map(PACKS.map(p => [p.num, p]));

  // ── Saved in this browser: a random voter ID, the ballot, invitation snoozes ──
  const KEY = 'vt-survey.v1';
  const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const readStore = () => { // null when storage is blocked or unreadable
    try { const saved = JSON.parse(localStorage.getItem(KEY)); return isObject(saved) ? saved : saved === null ? {} : null; } catch { return null; }
  };
  const tidy = saved => {
    if (!isObject(saved.ballots)) saved.ballots = {};
    if (!isObject(saved.invite)) saved.invite = {};
    return saved;
  };
  let store = tidy(readStore() || {});
  if (typeof store.voter !== 'string' || !/^v[a-z0-9]{15,39}$/.test(store.voter)) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    store.voter = ('v' + Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('')).slice(0, 24);
  }
  // Picks up what another open tab saved, keeping this tab's voter ID if none was saved yet.
  function reload() {
    const latest = tidy(readStore() || store);
    if (typeof latest.voter !== 'string' || !/^v[a-z0-9]{15,39}$/.test(latest.voter)) latest.voter = store.voter;
    store = latest;
  }
  // Each write starts from the saved copy, so another tab's ballot or snooze isn't overwritten.
  function save(change) {
    reload();
    change?.(store);
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* private browsing: works for this visit only */ }
  }
  save();
  const cleanPicks = list => (Array.isArray(list) ? [...new Set(list.map(Number))].filter(n => byNum.has(n)).slice(0, MAX) : []);
  const ballot = () => {
    const b = store.ballots[SURVEY];
    return b && Array.isArray(b.picks) ? { picks: cleanPicks(b.picks), at: b.at } : null;
  };
  const voted = () => Boolean(ballot()?.picks.length);

  // ── Talking to the survey script ──
  let results = null, resultsAt = 0, loading = null, sent = 0;
  try {
    const cached = JSON.parse(sessionStorage.getItem('vt-survey-results'));
    if (cached && cached.survey === SURVEY && Date.now() - cached.at < RESULTS_TTL && valid(cached.data)) { results = cached.data; resultsAt = cached.at; }
  } catch { /* no cached results */ }
  function valid(data) {
    return Boolean(data) && data.survey === SURVEY && Number.isSafeInteger(data.ballots) && data.ballots >= 0 && Array.isArray(data.results);
  }
  function remember(data) {
    results = data; resultsAt = Date.now();
    try { sessionStorage.setItem('vt-survey-results', JSON.stringify({ survey: SURVEY, at: resultsAt, data })); } catch { /* not cached */ }
  }
  const failure = code => Object.assign(new Error(code), { code });
  async function request(options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const url = options ? endpoint : `${endpoint}?survey=${encodeURIComponent(SURVEY)}`;
      const response = await fetch(url, Object.assign({ credentials: 'omit', redirect: 'follow', signal: controller.signal }, options || {}));
      if (!response.ok) throw failure('network');
      const data = await response.json().catch(() => { throw failure('network'); });
      if (!data || data.ok !== true) throw failure(String(data?.error || 'unknown'));
      if (!valid(data)) throw failure('unknown');
      return data;
    } catch (error) {
      throw error.code ? error : failure(error.name === 'AbortError' ? 'timeout' : 'network');
    } finally { clearTimeout(timer); }
  }
  function loadResults(force) {
    if (!force && results && Date.now() - resultsAt < RESULTS_TTL) return Promise.resolve(results);
    if (!loading) {
      const before = sent;
      loading = request().then(data => { if (before === sent) remember(data); return results; }).finally(() => { loading = null; });
    }
    return loading;
  }
  async function submit(picks) {
    reload(); // use the voter ID another tab may have saved first
    const data = await request({ method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ survey: SURVEY, voter: store.voter, picks }) });
    save(latest => { latest.ballots[SURVEY] = { picks: picks.slice(), at: new Date().toISOString() }; });
    sent++;
    remember(data);
    return data;
  }
  const problem = code => code === 'busy'
    ? 'Vault-Tec’s survey terminal is overloaded. Please try again in a minute.'
    : code === 'full'
      ? 'Vault-Tec’s survey terminal is out of room for new ballots. Thanks for trying, citizen.'
    : /^bad-/.test(code)
      ? 'Vault-Tec rejected that form. Please check your picks and submit again.'
      : 'No signal from Vault-Tec. Check your connection and try again. Your picks are still here.';

  // ── Standings: shared by the ? panel and the thank-you screen ──
  function standings(data) {
    const seen = new Set(), list = [];
    for (const r of data.results) {
      const pack = byNum.get(Number(r.id));
      if (!pack || seen.has(pack.num)) continue;
      seen.add(pack.num);
      list.push({ pack, points: count(r.points), first: count(r.first), picks: count(r.picks) });
    }
    list.sort((a, b) => b.points - a.points || b.first - a.first || b.picks - a.picks || a.pack.num - b.pack.num);
    for (const pack of PACKS) if (!seen.has(pack.num)) list.push({ pack, points: 0, first: 0, picks: 0 });
    return list;
  }
  function rowsHTML(data, limit) {
    const list = standings(data).slice(0, limit);
    const top = Math.max(1, ...list.map(r => r.points));
    const mine = ballot()?.picks || [];
    let place = 0, previous = null;
    return list.map((r, i) => {
      if (r.points !== previous) { place = i + 1; previous = r.points; }
      const rank = mine.indexOf(r.pack.num) + 1;
      const share = data.ballots ? Math.round(r.picks / data.ballots * 100) : 0;
      const detail = r.points
        ? `${r.first ? `#1 on ${r.first} ballot${r.first === 1 ? '' : 's'} · ` : ''}in ${share}% of ballots`
        : 'Not picked yet';
      return `<li class="survey-row${rank ? ' is-mine' : ''}${r.points ? '' : ' is-zero'}">
        <span class="survey-row-pos">${r.points ? place : '–'}</span>
        <img class="survey-row-thumb" src="${esc(r.pack.img)}" alt="" loading="lazy" decoding="async">
        <span class="survey-row-main"><span class="survey-row-name">${esc(r.pack.name)}</span>${rank ? `<span class="survey-row-mine">★ YOUR #${rank} PICK</span>` : ''}<span class="survey-row-bar" aria-hidden="true"><span style="width:${(r.points / top * 100).toFixed(1)}%"></span></span><span class="survey-row-sub">${detail}</span></span>
        <span class="survey-row-pts">${r.points}<small> pts</small></span>
      </li>`;
    }).join('');
  }
  function ago(iso) {
    const time = Date.parse(iso);
    if (!Number.isFinite(time)) return '';
    const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
    if (minutes < 2) return 'just now';
    if (minutes < 90) return `${minutes} minutes ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 36) return `${hours} hours ago`;
    const days = Math.round(hours / 24);
    return days < 45 ? `${days} days ago` : new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ── Featured card under the ARC tile ──
  const showcase = document.getElementById('survey-showcase');
  const card = document.getElementById('survey-card');
  function updateCard() {
    if (!card) return;
    const b = ballot();
    card.classList.toggle('is-done', Boolean(b?.picks.length));
    $('.survey-card-kicker', card).textContent = b?.picks.length ? 'VAULT-TEC CITIZEN SURVEY · ON FILE' : 'VAULT-TEC CITIZEN SURVEY';
    $('.survey-card-title', card).textContent = b?.picks.length ? 'Thanks for taking the survey, citizen!' : 'Which backpacks are your favorites?';
    $('.survey-card-desc', card).textContent = b?.picks.length
      ? `Your #1: ${byNum.get(b.picks[0]).name}. Change your picks anytime, or see how everyone voted.`
      : `Rank your top ${MAX} in about a minute. Results are in the ? panel.`;
    $('.survey-card-go', card).textContent = b?.picks.length ? '◈ UPDATE PICKS' : '◈ TAKE SURVEY';
    $('.survey-card-results', card).hidden = !b?.picks.length;
  }
  function updateShowcase() {
    if (!showcase) return;
    let show = true;
    try { show = catalogCategory === 'backpacks' && catalogView === 'grid' && !catalogQuery(); } catch { /* catalog script missing: always show */ }
    showcase.hidden = !show;
  }
  if (showcase && card) {
    const previous = window.updateArcPreview;
    window.updateArcPreview = () => { previous?.(); updateShowcase(); };
    // The whole card opens the survey; its buttons are the keyboard route, and View Results opens the ? panel.
    card.addEventListener('click', event => {
      if (event.target.closest('.survey-card-results')) setTimeout(openResults, 0); // after the ? panel's outside-click close
      else open($('.survey-card-go', card));
    });
    updateCard();
    updateShowcase();
  }

  // ── Ballot dialog ──
  let dialog = null, draft = [], opener = null, sending = false, notice = '', wanted = 0;
  function build() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.id = 'survey-dialog';
    dialog.setAttribute('aria-labelledby', 'survey-title');
    dialog.innerHTML = `<div class="survey-sheet">
      <div class="survey-head"><span class="survey-head-brand">VAULT-TEC</span><span class="survey-head-form">CITIZEN SURVEY · FORM VT-BP-${pad2(PACKS.length)}</span><button type="button" class="survey-x" data-act="close" aria-label="Close survey">×</button></div>
      <section class="survey-step" data-step="ballot">
        <div class="survey-intro"><h2 id="survey-title" tabindex="-1">Which backpacks are your favorites?</h2><p class="survey-lede"></p><p class="survey-notice" hidden></p></div>
        <div class="survey-body">
          <div class="survey-slots-panel"><p class="survey-slots-title">YOUR RANKING <span id="survey-drag-hint">· DRAG TO REORDER</span></p><ol class="survey-slots" aria-label="Your ranking"></ol>
            <p class="survey-points">Points: a #1 pick earns ${POINTS}, each place below earns one less.</p></div>
          <div class="survey-grid" role="group" aria-label="Backpacks to choose from">${PACKS.map(p => `<button type="button" class="survey-pick" data-num="${p.num}" aria-pressed="false">
            <span class="survey-pick-rank" aria-hidden="true"></span><img src="${esc(p.img)}" alt="" loading="lazy" decoding="async">
            <span class="survey-pick-meta"><span>${pad2(p.num)}</span><span>LVL ${p.level}</span></span><span class="survey-pick-name">${esc(p.name)}</span></button>`).join('')}</div>
        </div>
        <div class="survey-foot"><div class="survey-foot-text"><p class="survey-foot-note">Anonymous. Your picks and a random browser ID are stored so you can change them later.</p><p class="survey-foot-msg" role="alert"></p></div>
          <button type="button" class="survey-btn is-primary" data-act="send">SUBMIT TO VAULT-TEC</button></div>
      </section>
      <section class="survey-step" data-step="thanks" hidden>
        <div class="survey-thanks">${BOBBLE}
          <h2 id="survey-thanks-title" tabindex="-1">THANK YOU, CITIZEN!</h2>
          <p>Your responses have been recorded. Vault-Tec appreciates your cooperation.</p>
          <h3 class="survey-standings-title"></h3>
          <ol class="survey-standings"></ol>
          <div class="survey-thanks-actions"><button type="button" class="survey-btn" data-act="edit">CHANGE MY PICKS</button><button type="button" class="survey-btn" data-act="results">ALL RESULTS</button><button type="button" class="survey-btn is-primary" data-act="close">DONE</button></div>
        </div>
      </section>
      <p class="survey-sr" aria-live="polite" data-live></p>
    </div>`;
    document.body.append(dialog);
    dialog.addEventListener('click', event => {
      if (event.target === dialog) { close(); return; } // the backdrop
      const pick = event.target.closest('.survey-pick');
      if (pick) { toggle(Number(pick.dataset.num), pick); return; }
      const action = event.target.closest('[data-act]');
      if (!action) return;
      const i = Number(action.dataset.i);
      if (action.dataset.act === 'close') close();
      else if (action.dataset.act === 'send') send();
      else if (action.dataset.act === 'edit') { step('ballot'); $('#survey-title', dialog).focus({ preventScroll: true }); }
      else if (action.dataset.act === 'results') { close(); setTimeout(openResults, 0); }
      else if (action.dataset.act === 'remove') remove(i);
    });
    dialog.addEventListener('keydown', event => {
      const grip = event.target.closest?.('[data-act="grip"]');
      if (!grip || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
      event.preventDefault();
      move(Number(grip.dataset.i), event.key === 'ArrowUp' ? -1 : 1);
    });
    wireDrag($('.survey-slots', dialog));
    // While the survey is open, Escape closes only the survey: this runs before the catalog's own
    // Escape handlers (the backpack page, the ? panel), wherever focus is.
    addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !dialog.open) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }, true);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('close', () => {
      dialog.removeAttribute('aria-modal');
      if (!document.getElementById('modal-overlay')?.classList.contains('visible')) document.body.classList.remove('modal-open');
      const back = [opener, helpButton].find(shown);
      opener = null;
      renderLike();
      back?.focus({ preventScroll: true });
    });
  }
  // add: a backpack number to put on the ballot (from a Like button).
  function open(from, add) {
    build();
    if (dialog.open) return;
    opener = from || (document.activeElement !== document.body ? document.activeElement : null);
    if (!draft.length || sending === false && voted()) draft = ballot()?.picks.slice() || draft;
    notice = ''; wanted = 0;
    const liked = byNum.get(add);
    if (liked) {
      const at = draft.indexOf(liked.num);
      if (at >= 0) notice = `${liked.name} is already your #${at + 1} pick.`;
      else if (draft.length < MAX) {
        draft.push(liked.num);
        notice = `You liked ${liked.name}. It’s your #${draft.length} pick: ${draft.length < MAX ? `add up to ${MAX - draft.length} more or submit now.` : 'submit to make it count.'}`;
      } else { notice = `Your ballot already has ${MAX} picks. Remove one to make room for ${liked.name}.`; wanted = liked.num; }
    }
    step('ballot');
    document.body.classList.add('modal-open');
    dialog.setAttribute('aria-modal', 'true');
    dialog.showModal();
    $('#survey-title', dialog).focus({ preventScroll: true });
    if (liked) {
      $(`.survey-pick[data-num="${liked.num}"]`, dialog).scrollIntoView({ block: 'nearest' });
      live(notice);
    }
  }
  function close() { if (dialog?.open && !sending) dialog.close(); }
  // Visible and focusable: not inside a closed backpack page, a hidden element or an inert one.
  const shown = el => Boolean(el?.isConnected && el.getClientRects().length && !el.closest('[hidden], [inert], #modal-overlay:not(.visible)'));
  function step(name) {
    dialog.querySelectorAll('[data-step]').forEach(section => { section.hidden = section.dataset.step !== name; });
    $('[data-live]', dialog).textContent = '';
    $('.survey-x', dialog).disabled = sending;
    if (name === 'ballot') { renderBallot(); message(''); }
  }
  const live = text => { const el = $('[data-live]', dialog); el.textContent = ''; requestAnimationFrame(() => { el.textContent = text; }); };
  const message = text => { $('.survey-foot-msg', dialog).textContent = text; };
  function renderBallot() {
    const b = ballot();
    const note = $('.survey-notice', dialog);
    note.hidden = !notice;
    note.textContent = notice;
    $('.survey-lede', dialog).innerHTML = b?.picks.length
      ? `<span class="survey-onfile">Your ballot is on file${b.at ? ` from ${esc(new Date(b.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}` : ''}.</span> Change your picks and submit again to update it.`
      : `Pick up to ${MAX} backpacks, in order. Your first pick is your favorite.`;
    $('.survey-slots', dialog).innerHTML = Array.from({ length: MAX }, (_, i) => {
      const pack = byNum.get(draft[i]);
      if (!pack) return `<li class="survey-slot${i === draft.length ? ' is-next' : ''}"><span class="survey-slot-grip" aria-hidden="true"></span><span class="survey-slot-rank">#${i + 1}</span><span class="survey-slot-thumb is-empty" aria-hidden="true">?</span><span class="survey-slot-name">${i === draft.length ? (i ? 'Pick your next favorite' : 'Pick your favorite') : 'Empty'}</span></li>`;
      return `<li class="survey-slot is-filled" data-i="${i}"><button type="button" class="survey-slot-grip" data-act="grip" data-i="${i}" aria-label="${esc(pack.name)}, number ${i + 1}. Drag, or press the up and down arrow keys, to change its place." aria-describedby="survey-drag-hint"><svg viewBox="0 0 8 14" aria-hidden="true" focusable="false"><circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/><circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/><circle cx="2" cy="12" r="1.2"/><circle cx="6" cy="12" r="1.2"/></svg></button><span class="survey-slot-rank">#${i + 1}</span><img class="survey-slot-thumb" src="${esc(pack.img)}" alt="" draggable="false"><span class="survey-slot-name">${esc(pack.name)}<small>LVL ${pack.level}<span class="survey-slot-fav"> · FAVORITE</span></small></span>
        <button type="button" class="survey-slot-x" data-act="remove" data-i="${i}" aria-label="Remove ${esc(pack.name)}">✕</button></li>`;
    }).join('');
    dialog.querySelectorAll('.survey-pick').forEach(tile => {
      const num = Number(tile.dataset.num), rank = draft.indexOf(num) + 1, pack = byNum.get(num);
      tile.setAttribute('aria-pressed', String(rank > 0));
      tile.classList.toggle('is-full', draft.length >= MAX);
      tile.classList.toggle('is-wanted', num === wanted && !rank);
      $('.survey-pick-rank', tile).textContent = rank ? `#${rank}` : '';
      tile.setAttribute('aria-label', `${pack.name}, level ${pack.level}${rank ? `, your number ${rank} pick` : num === wanted ? ', the backpack you liked' : ''}`);
    });
    const sendButton = $('[data-act="send"]', dialog);
    sendButton.disabled = !draft.length;
    sendButton.setAttribute('aria-disabled', String(sending)); // not disabled: that would drop keyboard focus
    sendButton.classList.toggle('is-busy', sending);
    $('.survey-x', dialog).disabled = sending;
    sendButton.textContent = sending ? 'TRANSMITTING' : ballot()?.picks.length ? 'UPDATE MY BALLOT' : 'SUBMIT TO VAULT-TEC';
  }
  function toggle(num, tile) {
    if (sending) return;
    const at = draft.indexOf(num), pack = byNum.get(num);
    if (at >= 0) { draft.splice(at, 1); notice = ''; live(`Removed ${pack.name}.`); }
    else if (draft.length < MAX) { draft.push(num); notice = ''; if (num === wanted) wanted = 0; live(`${pack.name} is your number ${draft.length} pick.`); }
    else {
      message(`You already picked ${MAX}. Remove one first.`);
      if (!motion.matches) { tile.classList.remove('is-shake'); void tile.offsetWidth; tile.classList.add('is-shake'); }
      return;
    }
    message('');
    renderBallot();
  }
  function move(i, by) {
    const j = i + by;
    if (sending || j < 0 || j >= draft.length) return;
    [draft[i], draft[j]] = [draft[j], draft[i]];
    notice = '';
    live(`${byNum.get(draft[j]).name} is now number ${j + 1}.`);
    renderBallot();
    $(`.survey-slots [data-act="grip"][data-i="${j}"]`, dialog)?.focus({ preventScroll: true });
  }
  // Drag a pick to a new place. The list reorders live (the slot sizes follow the position, so a pick
  // grows as it climbs), the others slide aside, and the drop commits the new order to the draft.
  function wireDrag(slots) {
    let drag = null, suppress = false;
    const filled = () => [...slots.querySelectorAll('.survey-slot.is-filled')];
    const follow = y => {
      const li = drag.li;
      li.style.translate = '';
      const r = li.getBoundingClientRect();
      li.style.translate = `0 ${Math.round(y - drag.grab * r.height - r.top)}px`;
    };
    slots.addEventListener('pointerdown', event => {
      const li = event.target.closest('.survey-slot.is-filled');
      if (!li || sending || event.button !== 0 || event.target.closest('[data-act="remove"]')) return;
      const r = li.getBoundingClientRect();
      drag = { li, id: event.pointerId, y0: event.clientY, grab: (event.clientY - r.top) / r.height, moved: false };
    });
    slots.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      if (!drag.moved) {
        if (Math.abs(event.clientY - drag.y0) < 5) return;
        drag.moved = true;
        slots.setPointerCapture(event.pointerId);
        drag.li.classList.add('is-dragging');
        slots.classList.add('is-sorting');
      }
      event.preventDefault();
      const list = filled(), others = list.filter(el => el !== drag.li);
      let to = 0;
      for (const el of others) { const r = el.getBoundingClientRect(); if (event.clientY > r.top + r.height / 2) to++; }
      if (to !== list.indexOf(drag.li)) {
        const before = new Map(others.map(el => [el, el.getBoundingClientRect().top]));
        if (to >= others.length) others[others.length - 1].after(drag.li); else others[to].before(drag.li);
        filled().forEach((el, k) => { $('.survey-slot-rank', el).textContent = `#${k + 1}`; });
        if (!motion.matches) for (const el of others) {
          const dy = before.get(el) - el.getBoundingClientRect().top;
          if (!dy) continue;
          el.style.transition = 'none'; el.style.translate = `0 ${dy}px`;
          void el.offsetHeight; // commit the offset, then let it slide home
          el.style.transition = ''; el.style.translate = '';
        }
      }
      follow(event.clientY);
    });
    const end = event => {
      if (!drag || event.pointerId !== drag.id) return;
      const { li, moved } = drag;
      drag = null;
      if (!moved) return;
      suppress = true;
      setTimeout(() => { suppress = false; }, 0);
      const order = filled().map(el => draft[Number(el.dataset.i)]), at = order.indexOf(draft[Number(li.dataset.i)]);
      const lastTop = li.getBoundingClientRect().top, changed = order.some((num, k) => num !== draft[k]);
      slots.classList.remove('is-sorting');
      draft = order;
      notice = '';
      renderBallot();
      const dropped = filled()[at];
      if (dropped && !motion.matches) {
        const dy = lastTop - dropped.getBoundingClientRect().top;
        dropped.style.transition = 'none'; dropped.style.translate = `0 ${dy}px`;
        void dropped.offsetHeight;
        dropped.style.transition = ''; dropped.style.translate = '';
      }
      if (changed) live(`${byNum.get(order[at]).name} is now number ${at + 1}.`);
    };
    slots.addEventListener('pointerup', end);
    slots.addEventListener('pointercancel', end);
    // A drag that ends over a button must not press it.
    slots.addEventListener('click', event => { if (suppress) { event.stopPropagation(); event.preventDefault(); } }, true);
  }
  function remove(i) {
    if (sending) return;
    const [num] = draft.splice(i, 1);
    notice = '';
    live(`Removed ${byNum.get(num).name}.`);
    renderBallot();
    ($(`.survey-slots [data-act="remove"][data-i="${Math.min(i, draft.length - 1)}"]`, dialog) || $('.survey-grid .survey-pick', dialog))?.focus({ preventScroll: true });
  }
  async function send() {
    if (!draft.length || sending) return;
    sending = true;
    message('');
    renderBallot();
    try {
      const data = await submit(draft.slice());
      sending = false;
      notice = '';
      showThanks(data);
      updateCard();
      updateInviteState();
      renderLike();
      if (panel && section && !panel.hidden) renderPanel(data);
    } catch (error) {
      sending = false;
      renderBallot();
      message(problem(error.code));
      if (!dialog.contains(document.activeElement)) $('[data-act="send"]', dialog).focus({ preventScroll: true });
    }
  }
  function showThanks(data) {
    step('thanks');
    $('.survey-standings-title', dialog).textContent = `CURRENT STANDINGS · ${data.ballots} BALLOT${data.ballots === 1 ? '' : 'S'}`;
    $('.survey-thanks .survey-standings', dialog).innerHTML = rowsHTML(data, 5);
    $('#survey-thanks-title', dialog).focus({ preventScroll: true });
  }

  // ── Results in the ? panel ──
  const panel = document.getElementById('help-popup');
  const helpButton = document.getElementById('help-btn');
  const section = document.getElementById('survey-results');
  let expanded = false;
  function renderPanel(data) {
    const list = $('#survey-results-list'), status = $('#survey-results-status'), total = $('#survey-results-total');
    const more = $('#survey-results-more'), meta = $('#survey-results-meta');
    $('#survey-results-retry').hidden = true;
    total.hidden = false;
    total.innerHTML = `<strong>${data.ballots.toLocaleString('en-US')}</strong>ballot${data.ballots === 1 ? '' : 's'} cast`;
    meta.textContent = data.latest ? `Last ballot ${ago(data.latest)}.` : '';
    if (!data.ballots) {
      list.hidden = true; more.hidden = true; status.hidden = false;
      status.textContent = 'No ballots yet. Be the first citizen to respond!';
    } else {
      status.hidden = true; list.hidden = false;
      list.innerHTML = rowsHTML(data, expanded ? PACKS.length : 5);
      more.hidden = PACKS.length <= 5;
      more.textContent = expanded ? 'Show top 5' : `Show all ${PACKS.length}`;
      more.setAttribute('aria-expanded', String(expanded));
    }
    updateTake();
  }
  function updateTake() {
    const take = $('#survey-results-take');
    take.textContent = voted() ? '◈ CHANGE MY PICKS' : '◈ TAKE THE SURVEY';
    take.classList.toggle('is-done', voted());
  }
  function refreshPanel(force) {
    const status = $('#survey-results-status');
    if (!(results && !force && Date.now() - resultsAt < RESULTS_TTL)) {
      status.hidden = false; status.textContent = 'Contacting Vault-Tec…';
      $('#survey-results-retry').hidden = true;
    }
    loadResults(force).then(renderPanel).catch(() => {
      status.hidden = false;
      status.textContent = 'Survey results are temporarily unavailable. Please try again later.';
      $('#survey-results-list').hidden = true; $('#survey-results-more').hidden = true; $('#survey-results-total').hidden = true;
      $('#survey-results-retry').hidden = false;
    });
  }
  function openResults() {
    if (!panel || !section) return;
    if (document.getElementById('modal-overlay')?.classList.contains('visible') && typeof closeModal === 'function') closeModal();
    document.querySelector('.map-shell.is-expanded [data-map="expand"]')?.click();
    if (panel.hidden) helpButton.click();
    requestAnimationFrame(() => {
      const heading = $('#survey-results-title');
      heading.scrollIntoView({ block: 'nearest' });
      heading.focus({ preventScroll: true });
    });
  }
  if (panel && section && helpButton) {
    section.hidden = false;
    helpButton.setAttribute('aria-label', 'About this catalog, survey results and site traffic');
    panel.setAttribute('aria-label', 'About this catalog, survey results and site traffic');
    updateTake();
    new MutationObserver(() => { if (!panel.hidden) refreshPanel(false); }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
    $('#survey-results-more').addEventListener('click', () => { expanded = !expanded; if (results) renderPanel(results); });
    $('#survey-results-retry').addEventListener('click', () => refreshPanel(true));
    $('#survey-results-take').addEventListener('click', () => {
      document.getElementById('help-close')?.click(); // closes the panel and puts focus on the ? button
      open(helpButton);
    });
  }

  // ── 👍 Like on each backpack's detail page (a Pip-Boy take on a social network's button) ──
  // It opens the survey with that backpack on the ballot; "Liked" means it is on the ballot on file.
  const THUMB = '<svg class="like-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="1" y="7" width="3" height="8" rx=".8"/><path d="M5 7.4 8.1 1.9c.3-.6 1-.8 1.6-.5.8.4 1.2 1.4.9 2.3L9.9 6h3.7c1 0 1.7 1 1.4 2l-1.4 5.6c-.2.8-.9 1.4-1.7 1.4H5z"/></svg>';
  const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
  let likeNum = 0;
  function renderLike() {
    const bar = document.querySelector('#modal .like-bar');
    if (!bar) return;
    const pack = byNum.get(likeNum), rank = (ballot()?.picks || []).indexOf(likeNum) + 1;
    const button = $('.like-btn', bar), text = $('.like-text', bar);
    const wasLiked = bar.dataset.liked === 'true';
    bar.dataset.liked = String(rank > 0);
    button.classList.toggle('is-liked', rank > 0);
    $('.like-label', button).textContent = rank ? 'Liked' : 'Like';
    $('.like-hint', bar).textContent = rank
      ? `${pack.name} is your number ${rank} pick in the Vault-Tec survey. Opens the survey to change your ballot.`
      : `Opens the Vault-Tec survey with ${pack.name} on your ballot.`;
    if (rank && !wasLiked && bar.dataset.ready && !motion.matches) { button.classList.remove('is-pop'); void button.offsetWidth; button.classList.add('is-pop'); }
    bar.dataset.ready = '1';
    const entry = results?.results.find(r => Number(r.id) === likeNum);
    if (!results) { text.innerHTML = ''; return; }
    const likes = count(entry?.picks), others = Math.max(0, likes - (rank ? 1 : 0));
    const n = value => `<b>${esc(compact.format(value))}</b>`;
    const sentence = rank
      ? (others ? `You and ${n(others)} other citizen${others === 1 ? '' : 's'} like this` : 'You like this')
      : likes ? `${n(likes)} ${likes === 1 ? 'citizen likes' : 'citizens like'} this` : 'Be the first citizen to like this';
    text.innerHTML = `${rank || likes ? `<span class="like-badge" aria-hidden="true">${THUMB}</span>` : ''}<span>${sentence}</span>`;
  }
  const showDetails = window.openModal;
  if (typeof showDetails === 'function') {
    window.openModal = function (idx) {
      showDetails.apply(this, arguments);
      const pack = byNum.get(Number(BACKPACKS[idx]?.num)), hero = document.querySelector('#modal .modal-hero');
      if (!pack || !hero) return;
      likeNum = pack.num;
      const bar = document.createElement('div');
      bar.className = 'like-bar';
      bar.innerHTML = `<button type="button" class="like-btn" aria-haspopup="dialog" aria-describedby="like-hint like-text">${THUMB}<span class="like-label">Like</span></button><span class="like-text" id="like-text"></span><span class="survey-sr like-hint" id="like-hint"></span>`;
      hero.after(bar);
      $('.like-btn', bar).addEventListener('click', event => open(event.currentTarget, pack.num));
      renderLike();
      loadResults(false).then(renderLike, () => { /* the button works without a count */ });
    };
  }

  // ── "Vault-Tec has selected you" invitation ──
  let invite = null;
  function updateInviteState() { if (voted() && invite) dismissInvite(false); }
  function inviteAllowed() {
    if (voted() || store.invite.off) return false;
    if (Number(store.invite.until) > Date.now()) return false;
    try { if (sessionStorage.getItem('vt-survey-invited')) return false; } catch { /* allow */ }
    return true;
  }
  // Wait while something else has the visitor's attention.
  const busy = () => document.hidden
    || document.getElementById('modal-overlay')?.classList.contains('visible')
    || (panel && !panel.hidden)
    || document.getElementById('arc-preview')?.hidden === false
    || document.body.classList.contains('map-expanded')
    || dialog?.open
    || document.activeElement?.matches?.('input, textarea, select')
    || Boolean(document.querySelector('dialog[open]'));
  function showInvite() {
    if (invite || !inviteAllowed()) return;
    try { sessionStorage.setItem('vt-survey-invited', '1'); } catch { /* shown once per page load instead */ }
    invite = document.createElement('aside');
    invite.className = 'survey-invite';
    invite.setAttribute('aria-label', 'Vault-Tec survey invitation');
    invite.innerHTML = `<div class="survey-invite-card">${BOBBLE}
      <p class="survey-invite-kicker">VAULT-TEC · PRIORITY NOTICE</p>
      <p class="survey-invite-title">CONGRATULATIONS, CITIZEN!</p>
      <p class="survey-invite-text">Vault-Tec has selected you to participate in a survey!</p>
      <p class="survey-invite-sub">Rank your ${MAX} favorite backpacks. It takes about a minute.</p>
      <div class="survey-invite-actions"><button type="button" class="survey-invite-go">BEGIN SURVEY ▸</button><button type="button" class="survey-invite-later">Not now</button></div>
      <p class="survey-invite-fine">Participation is voluntary.* <span>*For now.</span></p>
    </div><button type="button" class="survey-invite-x" aria-label="Dismiss survey invitation">×</button>`;
    document.body.append(invite);
    const announce = document.createElement('p');
    announce.className = 'survey-sr'; announce.setAttribute('role', 'status');
    invite.append(announce);
    setTimeout(() => { announce.textContent = 'Vault-Tec has selected you to participate in a survey. Rank your favorite backpacks.'; }, 400);
    $('.survey-invite-go', invite).addEventListener('click', () => { dismissInvite(false); open(card || helpButton); });
    $('.survey-invite-later', invite).addEventListener('click', () => dismissInvite(true));
    $('.survey-invite-x', invite).addEventListener('click', () => dismissInvite(true));
  }
  function dismissInvite(snooze) {
    if (!invite) return;
    if (snooze) {
      save(latest => {
        latest.invite.snoozes = (Number(latest.invite.snoozes) || 0) + 1;
        latest.invite.until = Date.now() + SNOOZE;
        if (latest.invite.snoozes >= 2) latest.invite.off = true; // two "not now"s: only the card and ? panel remain
      });
    }
    const leaving = invite;
    invite = null;
    if (leaving.contains(document.activeElement)) {
      const box = card && !showcase.hidden ? card.getBoundingClientRect() : null;
      (box && box.bottom > 0 && box.top < innerHeight ? card : helpButton)?.focus({ preventScroll: true });
    }
    if (motion.matches) leaving.remove();
    else { leaving.classList.add('is-leaving'); setTimeout(() => leaving.remove(), 260); }
  }
  function scheduleInvite() {
    if (!inviteAllowed()) return;
    let fired = false, waiting = false, tries = 0;
    const started = performance.now();
    const fire = () => {
      if (fired || waiting) return;
      if (busy()) {
        if (++tries < 30) { waiting = true; setTimeout(() => { waiting = false; fire(); }, 4000); }
        return;
      }
      fired = true;
      removeEventListener('scroll', onScroll);
      showInvite();
    };
    const onScroll = () => { if (scrollY > 500 && performance.now() - started > 3000) fire(); };
    addEventListener('scroll', onScroll, { passive: true });
    setTimeout(fire, 9000);
  }
  const boot = document.getElementById('boot-screen');
  if (boot && !boot.classList.contains('gone')) {
    const watch = new MutationObserver(() => { if (boot.classList.contains('gone')) { watch.disconnect(); scheduleInvite(); } });
    watch.observe(boot, { attributes: true, attributeFilter: ['class'] });
  } else scheduleInvite();

  addEventListener('storage', event => {
    if (event.key !== KEY && event.key !== null) return;
    reload();
    updateCard();
    if (panel && section) updateTake();
    renderLike();
    if (voted() || store.invite.off || Number(store.invite.until) > Date.now()) dismissInvite(false);
  });

  window.vaultTecSurvey = { open: () => open(null), results: () => openResults() };
})();
