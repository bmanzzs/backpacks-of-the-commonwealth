// Collectibles share the catalog controls, but have their own fields and detail view.
const COLLECTIBLE_LOCATIONS = {
  GameStart: 'Game start',
  ConcordMuseumExt02: 'Concord Museum exterior',
  CabotHouse03: 'Cabot House',
  CambridgePD01: 'Cambridge Police Station',
  BackpackRoom: 'Boston Backpacks HQ',
  VaultTecOffice01: 'Vault-Tec offices',
  Vault81: 'Vault 81',
  DLC03Vault118: 'Vault 118'
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
  if (!['backpacks','bobbleheads','magazines'].includes(category)) return;
  catalogCategory = category;
  document.querySelectorAll('.catalog-tab').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)));
  const mapButton = document.getElementById('btn-map');
  mapButton.disabled = category !== 'backpacks';
  mapButton.title = category === 'backpacks' ? '' : 'Map pins are available for backpacks. Collectible locations are listed in cards and tables.';
  document.getElementById('search-input').placeholder = `◈  SEARCH ${category.toUpperCase()}...`;
  document.getElementById('search-input').setAttribute('aria-label', `Search ${category} by name, location, or effect`);
  if (catalogView === 'map' && category !== 'backpacks') catalogView = 'grid';
  setView(catalogView);
}

function showCatalogView(view) {
  catalogView = view === 'map' && catalogCategory !== 'backpacks' ? 'grid' : view;
  const backpacks = catalogCategory === 'backpacks';
  document.getElementById('grid').style.display = backpacks && catalogView === 'grid' ? '' : 'none';
  document.getElementById('table-view').style.display = backpacks && catalogView === 'table' ? 'block' : 'none';
  document.getElementById('map-view').style.display = backpacks && catalogView === 'map' ? 'block' : 'none';
  document.getElementById('collectible-grid').hidden = backpacks || catalogView !== 'grid';
  document.getElementById('collectible-table-view').hidden = backpacks || catalogView !== 'table';
  ['grid','table','map'].forEach(mode => {
    const button = document.getElementById('btn-' + mode);
    button.classList.toggle('active', catalogView === mode);
    button.setAttribute('aria-pressed', String(catalogView === mode));
  });
  if (backpacks && catalogView === 'table' && !document.getElementById('table-body').children.length) buildTable();
  if (backpacks && catalogView === 'map') buildMap();
  applyCatalogSearch();
}

function applyCatalogSearch() {
  const query = catalogQuery();
  const backpackMatches = bp => [bp.name, bp.id, bp.location].join(' ').toLowerCase().includes(query);
  document.querySelectorAll('#grid .card, #table-body tr').forEach(entry => {
    entry.style.display = backpackMatches(BACKPACKS[Number(entry.dataset.idx)]) ? '' : 'none';
  });
  document.querySelectorAll('.map-pin').forEach(pin => {
    const bp = BACKPACKS.find(item => item.num === Number(pin.dataset.num));
    pin.style.display = bp && backpackMatches(bp) ? '' : 'none';
  });
  const total = catalogCategory === 'backpacks' ? BACKPACKS.length : categoryItems().length;
  const count = catalogCategory === 'backpacks' ? BACKPACKS.filter(backpackMatches).length : renderCollectibles();
  document.getElementById('catalog-count').textContent = `${count} of ${total} ${catalogCategory}`;
  document.getElementById('catalog-description').textContent = catalogCategory === 'backpacks'
    ? 'Carry capacity, upgrades, crafting, and world locations.'
    : catalogCategory === 'bobbleheads'
      ? 'Upgrade items for the Vault-Tec Utility Backpack. Locations are listed below; collectible map pins are not yet available.'
      : 'Magazine effects and acquisition locations. Locations are listed below; collectible map pins are not yet available.';
  document.getElementById('catalog-empty').hidden = count > 0;
}

function renderCollectibles() {
  const items = categoryItems().filter(item => collectibleMatches(item, catalogQuery())).sort((a,b) => {
    if (collectibleSort.key === 'sourceRow') return a.sourceRow - b.sourceRow;
    const left = collectibleSort.key === 'name' ? a.name : collectibleLocation(a);
    const right = collectibleSort.key === 'name' ? b.name : collectibleLocation(b);
    return left.localeCompare(right) * collectibleSort.direction;
  });
  const kind = catalogCategory === 'bobbleheads' ? 'BACKPACK UPGRADE' : 'MAGAZINE';
  document.getElementById('collectible-grid').innerHTML = items.map(item => `
    <button class="collectible-card" data-collectible-row="${item.sourceRow}" aria-label="View details for ${escapeCatalog(item.name)}">
      <div class="collectible-kicker">${kind}</div>
      <h2>${escapeCatalog(item.name)}</h2>
      <div class="collectible-effects">${collectibleEffects(item).map(effect => `<span class="collectible-effect">${escapeCatalog(effect)}</span>`).join('')}</div>
      <div class="collectible-place">${escapeCatalog(collectibleLocation(item))}</div>
      <div class="collectible-id">${escapeCatalog(item.locationId)}</div>
      <span class="collectible-hint">◉ VIEW EFFECTS & LOCATION</span>
    </button>`).join('');
  document.getElementById('collectible-table-body').innerHTML = items.map(item => `
    <tr><td><button class="collectible-details" data-collectible-row="${item.sourceRow}">${escapeCatalog(item.name)}</button></td>
      <td>${collectibleEffects(item).map(escapeCatalog).join('<br>')}</td>
      <td>${escapeCatalog(collectibleLocation(item))}<div class="collectible-id">${escapeCatalog(item.locationId)}</div></td></tr>`).join('');
  return items.length;
}

const collectibleDialog = document.getElementById('collectible-dialog');
function openCollectible(row) {
  const item = COLLECTIBLES.find(entry => entry.sourceRow === row);
  if (!item) return;
  const isBobblehead = item.type === 'bobbleheads';
  const unexpanded = item.effects.some(effect => !COLLECTIBLE_EFFECT_LABELS[effect]);
  collectibleDialog.innerHTML = `
    <button class="collectible-close" aria-label="Close details" autofocus>×</button>
    <div class="collectible-kicker">${isBobblehead ? 'VAULT-TEC BACKPACK UPGRADE' : 'MAGAZINE'}</div>
    <h2 id="collectible-dialog-title">${escapeCatalog(item.name)}</h2>
    ${isBobblehead ? '<p>One of the four upgrade bobbleheads for the Vault-Tec Utility Backpack.</p>' : item.effects.includes('+BP') ? '<p>An aesthetic introduction to the mod, indicating that it is installed and backpacks will appear in the game. This magazine provides no stat bonus.</p>' : ''}
    <h3>▸ ${isBobblehead ? 'UPGRADE EFFECT' : 'EFFECTS'}</h3>
    <div class="collectible-effects">${collectibleEffects(item).map(effect => `<span class="collectible-effect">${escapeCatalog(effect)}</span>`).join('')}</div>
    ${unexpanded ? '<p class="source-effects">Some effects are listed using the source sheet’s shorthand; exact bonuses have not been expanded.</p>' : ''}
    <h3>▸ ${item.locationId === 'GameStart' ? 'ACQUISITION' : 'WORLD LOCATION'}</h3>
    <p>${escapeCatalog(collectibleLocation(item))}</p>
    <p class="source-effects">${item.locationId === 'GameStart' ? 'The sheet lists this entry at game start rather than at a world location.' : 'Location ID: ' + escapeCatalog(item.locationId) + '. The sheet does not specify an exact room or pickup position.'}</p>
    `;
  collectibleDialog.querySelector('.collectible-close').addEventListener('click', () => collectibleDialog.close());
  document.body.classList.add('modal-open');
  collectibleDialog.showModal();
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
setCatalogCategory('backpacks');
