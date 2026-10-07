// Collectibles share the catalog controls, but have their own fields and detail view.
const COLLECTIBLE_LOCATIONS = {
  GameStart: 'Game start',
  ConcordMuseumExt02: 'Concord Museum exterior',
  CabotHouse03: 'Cabot House',
  CambridgePD01: 'Cambridge Police Station',
  BackpackRoom: 'Boston Backpacks HQ',
  VaultTecOffice01: 'Vault-Tec Regional HQ',
  Vault81: 'Vault 81',
  DLC03Vault118: 'Vault 118',
  BackpackBunker: 'Vault-Tec Bunker Sigma (northern Glowing Sea)',
  Vault75: 'Vault 75',
  Vault114: 'Vault 114 (Park Street Station)',
  Vault111Cryo: 'Vault 111'
};
// Magazine shorthand clarified by the mod author on 2026-09-07.
const COLLECTIBLE_EFFECT_LABELS = {
  '+1 CHR': '+1 Charisma', '+10% Energy': '+10% energy damage',
  '+10% Guns': '+10% gun damage', '+10% Sneak': '+10% sneak',
  '+5RR': '+5 radiation resistance', '+5DR': '+5 damage resistance',
  '+BP': 'Aesthetic item · no stat bonus',
  '+20PACC': '+20 Power Armor carry capacity',
  '+PACC': 'Power Armor carry capacity bonus',
  '+SpawnRate': 'Small increase to backpack spawn rate'
};
let catalogCategory = 'backpacks';
let catalogView = 'grid';
let catalogListView = 'grid'; // the card or table view that stays under the full-screen map
let collectibleSort = { key: 'sourceRow', direction: 1 };
const escapeCatalog = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const collectibleLocation = item => COLLECTIBLE_LOCATIONS[item.locationId] || item.locationId;
const collectibleEffects = item => [...new Set(item.effects)]
  .filter(effect => effect !== '+PACC' || !item.effects.includes('+20PACC'))
  .map(effect => COLLECTIBLE_EFFECT_LABELS[effect] || effect);
const CATEGORY_LABELS = { backpacks: 'BACKPACKS', charms: 'VAULT-TEC CHARMS', magazines: 'MAGAZINES' };
const CATEGORY_TOTALS = { backpacks: BACKPACKS.length, charms: COLLECTIBLES.filter(item => item.type === 'charms').length, magazines: COLLECTIBLES.filter(item => item.type === 'magazines').length };
const backpackMatches = (bp, query) => [bp.name, bp.id, bp.location].join(' ').toLowerCase().includes(query);
const catalogQuery = () => document.getElementById('search-input').value.trim().toLowerCase();
function collectibleMatches(item, query) {
  return [item.name, item.locationId, collectibleLocation(item), ...item.effects, ...collectibleEffects(item)].join(' ').toLowerCase().includes(query);
}

function setCatalogCategory(category) {
  if (!['backpacks','charms','magazines'].includes(category)) return;
  catalogCategory = category;
  document.querySelectorAll('.catalog-tab').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)));
  setView(catalogView);
}

function showCatalogView(view) {
  hideCollectiblePreview();
  catalogView = view;
  if (view !== 'map') catalogListView = view;
  // The map opens full screen over the page; the list underneath (laid out by applyCatalogSearch)
  // stays put for when it closes.
  document.getElementById('map-view').style.display = catalogView === 'map' ? 'block' : 'none'; // one map with all three layers
  ['grid','table','map'].forEach(mode => {
    const button = document.getElementById('btn-' + mode);
    button.classList.toggle('active', catalogView === mode);
    button.setAttribute('aria-pressed', String(catalogView === mode));
  });
  if (catalogView === 'map') window.catalogMap?.show(); else window.catalogMap?.hide();
  applyCatalogSearch();
}

// The search box looks through every category: results come in groups, one per category with
// matches. With the box empty, only the open tab's entries show.
function applyCatalogSearch() {
  const query = catalogQuery(), searching = Boolean(query), listView = catalogListView;
  const bpMatch = bp => backpackMatches(bp, query), itemMatch = item => collectibleMatches(item, query);
  const counts = { backpacks: BACKPACKS.filter(bpMatch).length };
  for (const type of ['charms', 'magazines']) counts[type] = COLLECTIBLES.filter(item => item.type === type && itemMatch(item)).length;
  const shown = searching ? ['backpacks', 'charms', 'magazines'].filter(c => counts[c]) : [catalogCategory];
  const packs = shown.includes('backpacks'), types = shown.filter(c => c !== 'backpacks');
  document.body.classList.toggle('catalog-searching', searching);
  document.getElementById('grid').style.display = packs && listView === 'grid' ? '' : 'none';
  document.getElementById('table-view').style.display = packs && listView === 'table' ? 'block' : 'none';
  if (packs && listView === 'table' && !document.getElementById('table-body').children.length) buildTable();
  document.querySelectorAll('#grid .card, #table-body tr').forEach(entry => {
    entry.style.display = bpMatch(BACKPACKS[Number(entry.dataset.idx)]) ? '' : 'none';
  });
  const head = document.getElementById('sg-backpacks');
  head.hidden = !(searching && packs);
  head.querySelector('span').textContent = `${counts.backpacks} ${counts.backpacks === 1 ? 'MATCH' : 'MATCHES'}`;
  renderCollectibles(types, searching);
  document.getElementById('collectible-grid').hidden = !types.length || listView !== 'grid';
  document.getElementById('collectible-table-view').hidden = !types.length || listView !== 'table';
  window.catalogMap?.filter(bpMatch, itemMatch);
  document.querySelectorAll('.catalog-tab').forEach(tab => {
    const c = tab.dataset.category;
    tab.querySelector('.tab-count').textContent = searching ? counts[c] : CATEGORY_TOTALS[c];
    tab.classList.toggle('is-empty', searching && !counts[c]);
  });
  const total = shown.reduce((sum, c) => sum + counts[c], 0);
  document.getElementById('catalog-count').textContent = searching
    ? `${total} ${total === 1 ? 'match' : 'matches'}: ` + ['backpacks', 'charms', 'magazines'].map(c => `${counts[c]} ${counts[c] === 1 ? c.slice(0, -1) : c}`).join(', ')
    : `${counts[catalogCategory]} ${catalogCategory}`;
  document.getElementById('catalog-empty').hidden = !searching || total > 0;
  window.updateArcPreview?.();
}

// Collectible cards and table rows for the given categories; grouped adds a heading per category.
function renderCollectibles(types, grouped) {
  hideCollectiblePreview();
  const query = catalogQuery(), sort = (a, b) => {
    if (collectibleSort.key === 'sourceRow') return a.sourceRow - b.sourceRow;
    const left = collectibleSort.key === 'name' ? a.name : collectibleLocation(a);
    const right = collectibleSort.key === 'name' ? b.name : collectibleLocation(b);
    return left.localeCompare(right) * collectibleSort.direction;
  };
  let cards = '', rows = '';
  for (const type of types) {
    const items = COLLECTIBLES.filter(item => item.type === type && collectibleMatches(item, query)).sort(sort);
    if (!items.length) continue;
    const kind = type === 'charms' ? 'VAULT-TEC CHARM' : 'MAGAZINE';
    if (grouped) {
      const label = `${CATEGORY_LABELS[type]} <span>${items.length} ${items.length === 1 ? 'MATCH' : 'MATCHES'}</span>`;
      cards += `<h2 class="search-group" id="sg-${type}">${label}</h2>`;
      rows += `<tr class="search-group-row"><th colspan="3" scope="colgroup" id="sg-${type}-table">${label}</th></tr>`;
    }
    cards += items.map(item => `
    <button class="collectible-card" data-collectible-row="${item.sourceRow}" aria-label="View details for ${escapeCatalog(item.name)}">
      <div class="collectible-kicker">${kind}</div>
      <div class="collectible-card-heading">${item.thumbnail ? `<img class="collectible-thumbnail" src="${escapeCatalog(item.thumbnail)}" alt="" width="64" height="76" loading="lazy">` : ''}<h2>${escapeCatalog(item.name)}</h2></div>
      <div class="collectible-effects">${collectibleEffects(item).map(effect => `<span class="collectible-effect">${escapeCatalog(effect)}</span>`).join('')}</div>
      <div class="collectible-place">${escapeCatalog(collectibleLocation(item))}</div>
      <div class="collectible-id">${escapeCatalog(item.locationId)}</div>
      <span class="collectible-hint">◉ VIEW EFFECTS & LOCATION</span>
    </button>`).join('');
    rows += items.map(item => `
    <tr><td><button class="collectible-details collectible-table-name" data-collectible-row="${item.sourceRow}">${item.thumbnail ? `<img class="collectible-thumbnail" src="${escapeCatalog(item.thumbnail)}" alt="" width="44" height="52" loading="lazy">` : ''}<span>${escapeCatalog(item.name)}</span></button></td>
      <td>${collectibleEffects(item).map(escapeCatalog).join('<br>')}</td>
      <td>${escapeCatalog(collectibleLocation(item))}<div class="collectible-id">${escapeCatalog(item.locationId)}</div></td></tr>`).join('');
  }
  document.getElementById('collectible-grid').innerHTML = cards;
  document.getElementById('collectible-table-body').innerHTML = rows;
}

const collectibleDialog = document.getElementById('collectible-dialog');
function openCollectible(row) {
  const item = COLLECTIBLES.find(entry => entry.sourceRow === row);
  if (!item) return;
  hideCollectiblePreview();
  const isCharm = item.type === 'charms';
  const unexpanded = !isCharm && item.effects.some(effect => !COLLECTIBLE_EFFECT_LABELS[effect]);
  const photo = item.locationImage ? `<figure class="cd-photo">
      ${item.locationImageB ? `<div class="cd-photo-tabs" role="tablist" aria-label="Location photos">
        <button type="button" role="tab" aria-selected="true" data-src="${escapeCatalog(item.locationImage)}">Where to find it</button>
        <button type="button" role="tab" aria-selected="false" data-src="${escapeCatalog(item.locationImageB)}">Close-up</button></div>` : ''}
      <a href="${escapeCatalog(item.locationImage)}" target="_blank" rel="noopener" aria-label="Open full-size location screenshot for ${escapeCatalog(item.name)}"><img src="${escapeCatalog(item.locationImage)}" alt="${escapeCatalog(item.name + ' ' + item.locationHint + ' at ' + collectibleLocation(item))}" width="640" height="640"></a>
      <figcaption>${escapeCatalog(item.locationHint)}</figcaption></figure>` : '';
  collectibleDialog.classList.toggle('has-photo', Boolean(item.locationImage));
  collectibleDialog.innerHTML = `
    <button class="collectible-close" aria-label="Close details" autofocus>×</button>
    <div class="cd-grid">
    <div class="cd-head"><div class="collectible-kicker">${isCharm ? 'VAULT-TEC CHARM' : 'MAGAZINE'}</div>
    <h2 id="collectible-dialog-title">${escapeCatalog(item.name)}</h2></div>
    ${photo}
    <div class="cd-body">
    ${isCharm ? `<p>One of the eight Vault-Tec charms. Craft the ${escapeCatalog(item.edition)} at an armor workbench and the animated charm hangs from the pack.</p>` : item.effects.includes('+BP') ? '<p>An aesthetic introduction to the mod, indicating that it is installed and backpacks will appear in the game. This magazine provides no stat bonus.</p>' : ''}
    <h3>▸ ${isCharm ? 'EDITION EFFECT' : 'EFFECTS'}</h3>
    <div class="collectible-effects">${collectibleEffects(item).map(effect => `<span class="collectible-effect">${escapeCatalog(effect)}</span>`).join('')}</div>
    ${unexpanded ? '<p class="source-effects">Some effects are listed using the source sheet’s shorthand; exact bonuses have not been expanded.</p>' : ''}
    <h3>▸ ${item.locationId === 'GameStart' ? 'ACQUISITION' : 'WORLD LOCATION'}</h3>
    <p>${escapeCatalog(collectibleLocation(item))}</p>
    <p class="source-effects">${item.locationId === 'GameStart' ? 'Available at game start.' : 'Location ID: ' + escapeCatalog(item.locationId)}</p></div>
    </div>`;
  collectibleDialog.querySelector('.collectible-close').addEventListener('click', () => collectibleDialog.close());
  collectibleDialog.querySelectorAll('.cd-photo-tabs button').forEach(tab => tab.addEventListener('click', () => {
    const fig = tab.closest('.cd-photo');
    fig.querySelectorAll('.cd-photo-tabs button').forEach(other => other.setAttribute('aria-selected', String(other === tab)));
    fig.querySelector('img').src = tab.dataset.src;
    fig.querySelector('a').href = tab.dataset.src;
  }));
  document.body.classList.add('modal-open');
  collectibleDialog.showModal();
  collectibleDialog.scrollTop = 0;
}
collectibleDialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
collectibleDialog.addEventListener('click', event => {
  const rect = collectibleDialog.getBoundingClientRect();
  if (event.target === collectibleDialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) collectibleDialog.close();
});
document.querySelectorAll('.catalog-tab').forEach(button => button.addEventListener('click', () => {
  const category = button.dataset.category;
  setCatalogCategory(category);
  if (!catalogQuery()) return;
  const group = document.getElementById(category === 'backpacks' ? 'sg-backpacks' : catalogListView === 'table' ? `sg-${category}-table` : `sg-${category}`);
  if (group && group.getClientRects().length) group.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}));
document.querySelectorAll('#collectible-grid, #collectible-table-body').forEach(container => container.addEventListener('click', event => {
  const button = event.target.closest('[data-collectible-row]');
  if (button) openCollectible(Number(button.dataset.collectibleRow));
}));
document.querySelectorAll('.collectible-sort').forEach(button => button.addEventListener('click', () => {
  collectibleSort = { key: button.dataset.sort, direction: collectibleSort.key === button.dataset.sort ? -collectibleSort.direction : 1 };
  document.querySelectorAll('.collectible-sort').forEach(other => {
    const active = other === button;
    other.closest('th').setAttribute('aria-sort', active ? (collectibleSort.direction === 1 ? 'ascending' : 'descending') : 'none');
    other.querySelector('span').textContent = active ? (collectibleSort.direction === 1 ? '↑' : '↓') : '↕';
  });
  applyCatalogSearch();
}));
document.getElementById('search-input').addEventListener('input', applyCatalogSearch);

// A separate preview keeps collectible hover state independent of backpack previews.
const collectiblePreview = document.createElement('div');
collectiblePreview.id = 'collectible-preview';
collectiblePreview.setAttribute('aria-hidden','true');
collectiblePreview.innerHTML = '<img alt="" width="180" height="214"><div class="collectible-preview-label"></div>';
document.body.appendChild(collectiblePreview);
function hideCollectiblePreview() { collectiblePreview.classList.remove('visible'); }
function showCollectiblePreview(button) {
  const item = COLLECTIBLES.find(entry => entry.sourceRow === Number(button.dataset.collectibleRow));
  if (!item?.thumbnail || collectibleDialog.open) return;
  collectiblePreview.querySelector('img').src = item.thumbnail;
  collectiblePreview.querySelector('.collectible-preview-label').textContent = item.name;
  const rect = button.getBoundingClientRect();
  const width = collectiblePreview.offsetWidth, height = collectiblePreview.offsetHeight;
  let left = rect.right + 14;
  if (left + width > innerWidth - 8) left = rect.left - width - 14;
  collectiblePreview.style.left = Math.max(8,Math.min(left,innerWidth-width-8))+'px';
  collectiblePreview.style.top = Math.max(8,Math.min(rect.top,innerHeight-height-8))+'px';
  collectiblePreview.classList.add('visible');
}
for (const container of document.querySelectorAll('#collectible-grid, #collectible-table-body')) {
  container.addEventListener('pointerover',event => {
    if (event.pointerType !== 'mouse' || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const button = event.target.closest('[data-collectible-row]');
    if (button && !button.contains(event.relatedTarget)) showCollectiblePreview(button);
  });
  container.addEventListener('pointerout',event => {
    const button = event.target.closest('[data-collectible-row]');
    if (button && !button.contains(event.relatedTarget)) hideCollectiblePreview();
  });
  container.addEventListener('focusin',event => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const button = event.target.closest('[data-collectible-row]');
    if (button) showCollectiblePreview(button);
  });
  container.addEventListener('focusout',hideCollectiblePreview);
}
document.addEventListener('scroll',hideCollectiblePreview,true);
window.addEventListener('resize',hideCollectiblePreview);
document.addEventListener('keydown',event => {if(event.key==='Escape')hideCollectiblePreview();});
// Closing the map (its buttons, Escape, or Back) returns to the card or table view.
document.getElementById('map-view').addEventListener('catalogmap:close', () => setView(catalogListView));
setCatalogCategory('backpacks');
if (location.hash === '#map') setView('map'); // a link straight to the map
