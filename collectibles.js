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
let collectibleSort = { key: 'sourceRow', direction: 1 };
const escapeCatalog = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const collectibleLocation = item => COLLECTIBLE_LOCATIONS[item.locationId] || item.locationId;
const collectibleEffects = item => [...new Set(item.effects)]
  .filter(effect => effect !== '+PACC' || !item.effects.includes('+20PACC'))
  .map(effect => COLLECTIBLE_EFFECT_LABELS[effect] || effect);
const categoryItems = () => COLLECTIBLES.filter(item => item.type === catalogCategory);
const catalogQuery = () => document.getElementById('search-input').value.trim().toLowerCase();
function collectibleMatches(item, query) {
  return [item.name, item.locationId, collectibleLocation(item), ...item.effects, ...collectibleEffects(item)].join(' ').toLowerCase().includes(query);
}

function setCatalogCategory(category) {
  if (!['backpacks','charms','magazines'].includes(category)) return;
  catalogCategory = category;
  document.querySelectorAll('.catalog-tab').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)));
  document.getElementById('search-input').placeholder = `◈  SEARCH ${category.toUpperCase()}...`;
  document.getElementById('search-input').setAttribute('aria-label', `Search ${category} by name, location, or effect`);
  setView(catalogView);
}

function showCatalogView(view) {
  hideCollectiblePreview();
  catalogView = view;
  const backpacks = catalogCategory === 'backpacks';
  document.getElementById('grid').style.display = backpacks && catalogView === 'grid' ? '' : 'none';
  document.getElementById('table-view').style.display = backpacks && catalogView === 'table' ? 'block' : 'none';
  document.getElementById('map-view').style.display = catalogView === 'map' ? 'block' : 'none'; // one map with all three layers
  document.getElementById('collectible-grid').hidden = backpacks || catalogView !== 'grid';
  document.getElementById('collectible-table-view').hidden = backpacks || catalogView !== 'table';
  ['grid','table','map'].forEach(mode => {
    const button = document.getElementById('btn-' + mode);
    button.classList.toggle('active', catalogView === mode);
    button.setAttribute('aria-pressed', String(catalogView === mode));
  });
  if (backpacks && catalogView === 'table' && !document.getElementById('table-body').children.length) buildTable();
  if (catalogView === 'map') window.catalogMap?.show(); else window.catalogMap?.hide();
  applyCatalogSearch();
}

function applyCatalogSearch() {
  const query = catalogQuery();
  const backpackMatches = bp => [bp.name, bp.id, bp.location].join(' ').toLowerCase().includes(query);
  document.querySelectorAll('#grid .card, #table-body tr').forEach(entry => {
    entry.style.display = backpackMatches(BACKPACKS[Number(entry.dataset.idx)]) ? '' : 'none';
  });
  window.catalogMap?.filter(backpackMatches, item => collectibleMatches(item, query));
  const total = catalogCategory === 'backpacks' ? BACKPACKS.length : categoryItems().length;
  const count = catalogCategory === 'backpacks' ? BACKPACKS.filter(backpackMatches).length : renderCollectibles();
  document.getElementById('catalog-count').textContent = `${count} of ${total} ${catalogCategory}`;
  document.getElementById('catalog-description').textContent = catalogCategory === 'backpacks'
    ? 'Carry capacity, upgrades, crafting, and world locations.'
    : catalogCategory === 'charms'
      ? 'Vault-Tec charms: each unlocks a Vault-Tec Utility Backpack edition that hangs the animated charm from the pack. Map View shows where each one is.'
      : 'Magazine effects and acquisition locations. Map View shows where each one is.';
  document.getElementById('catalog-empty').hidden = count > 0;
  window.updateArcPreview?.();
}

function renderCollectibles() {
  hideCollectiblePreview();
  const items = categoryItems().filter(item => collectibleMatches(item, catalogQuery())).sort((a,b) => {
    if (collectibleSort.key === 'sourceRow') return a.sourceRow - b.sourceRow;
    const left = collectibleSort.key === 'name' ? a.name : collectibleLocation(a);
    const right = collectibleSort.key === 'name' ? b.name : collectibleLocation(b);
    return left.localeCompare(right) * collectibleSort.direction;
  });
  const kind = catalogCategory === 'charms' ? 'VAULT-TEC CHARM' : 'MAGAZINE';
  document.getElementById('collectible-grid').innerHTML = items.map(item => `
    <button class="collectible-card" data-collectible-row="${item.sourceRow}" aria-label="View details for ${escapeCatalog(item.name)}">
      <div class="collectible-kicker">${kind}</div>
      <div class="collectible-card-heading">${item.thumbnail ? `<img class="collectible-thumbnail" src="${escapeCatalog(item.thumbnail)}" alt="" width="64" height="76" loading="lazy">` : ''}<h2>${escapeCatalog(item.name)}</h2></div>
      <div class="collectible-effects">${collectibleEffects(item).map(effect => `<span class="collectible-effect">${escapeCatalog(effect)}</span>`).join('')}</div>
      <div class="collectible-place">${escapeCatalog(collectibleLocation(item))}</div>
      <div class="collectible-id">${escapeCatalog(item.locationId)}</div>
      <span class="collectible-hint">◉ VIEW EFFECTS & LOCATION</span>
    </button>`).join('');
  document.getElementById('collectible-table-body').innerHTML = items.map(item => `
    <tr><td><button class="collectible-details collectible-table-name" data-collectible-row="${item.sourceRow}">${item.thumbnail ? `<img class="collectible-thumbnail" src="${escapeCatalog(item.thumbnail)}" alt="" width="44" height="52" loading="lazy">` : ''}<span>${escapeCatalog(item.name)}</span></button></td>
      <td>${collectibleEffects(item).map(escapeCatalog).join('<br>')}</td>
      <td>${escapeCatalog(collectibleLocation(item))}<div class="collectible-id">${escapeCatalog(item.locationId)}</div></td></tr>`).join('');
  return items.length;
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
document.querySelectorAll('.catalog-tab').forEach(button => button.addEventListener('click', () => setCatalogCategory(button.dataset.category)));
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
  renderCollectibles();
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
setCatalogCategory('backpacks');
