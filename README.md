# backpacks-of-the-commonwealth
Field catalog for Backpacks of the Commonwealth: 26 backpacks, 4 backpack upgrade bobbleheads, and 5 magazines.

## Editing and previewing

Open `index.html` in a browser. This is a static GitHub Pages site; no install or build step is required.

- `index.html`: backpack records, embedded images, backpack card/table/map views, and shared catalog controls.
- `collectibles-data.js`: magazine and bobblehead source records.
- `collectibles.js`: collectible effects, readable location labels, category switching, search, sorting, and detail dialogs.
- `collectibles.css`: collectible styles extending the original Pip-Boy theme.
- `backpacks.html`: separate legacy page; the main catalog is `index.html`.

## Browser icons

`favicon.ico` and `assets/icons/` provide browser-tab, Chrome shortcut, and Apple touch icons. `site.webmanifest` uses relative paths for GitHub Pages. The unchanged generated source is `assets/icons/backpack-source.png`; the smaller files are Lanczos downscaled exports, with 16/32/48px frames in the ICO.

Created using built-in image generation from the author's backpack screenshot on September 8, 2026. Prompt direction: isolate and simplify the olive military backpack, twin brown buckle straps, two front pockets, and horizontal brown bedroll; bold readable silhouette on a dark forest-green background, no text or incidental equipment, recognizable at small favicon sizes.

## Collectible source

Read from the [reference spreadsheet](https://docs.google.com/spreadsheets/d/1obmNsElEoexa8rE5gitiuBC1Tgo1RS1RehSQfYrNvGc/edit?gid=0#gid=0) on September 7, 2026: `Main!G34:L38` (magazines) and `Main!G40:L43` (bobbleheads). These are static records, not a live Sheets connection. Source row numbers are retained in the data for maintenance.

The mod author clarified the magazine shorthand:

- `+BP`: aesthetic introductory magazine indicating the mod is installed; no stat bonus.
- `+20PACC`: +20 Power Armor carry capacity.
- `+PACC`: redundant Power Armor bonus indicator for Armored Infantry, omitted from displayed effects when `+20PACC` is present.
- `+SpawnRate`: small increase to backpack world spawn rate; no numeric amount supplied.

Bobbleheads are upgrade items for the Vault-Tec Utility Backpack. Original effect strings and location IDs are retained in the data. Collectible map pins are unavailable because the sheet supplies location IDs, not map coordinates or precise pickup positions. `GameStart` is shown as an acquisition method.

The mod author supplied four bobblehead close-ups and eight location screenshots on September 8, 2026, plus five magazine covers on September 12, 2026, stored unchanged in `assets/collectibles/`. Bobblehead and magazine thumbnails use their close-ups or covers in card and table views, with larger desktop hover/focus previews. Detail dialogs show the location screenshots with the author's short hints, and screenshots can open full-size. The introductory game-start magazine has no world-location photo. Image paths and hints live in `collectibles-data.js`.

## Traffic panel

The `?` button opens a small public traffic chart with 1M (past 30 days), 1Y (past 12 calendar months), and ALL ranges. It counts visits to the main catalog, not category switches or detail views. Counts can include returning visitors and are not an all-time count of distinct people.

The data service is [GoatCounter](https://www.goatcounter.com/). In the site's settings, enable **Allow adding visitor counts on your website**. The full GoatCounter dashboard can remain private. Set the public site URL and the actual tracking start date in `analytics-config.js`; do not add a password or API token. An empty URL disables tracking and displays an honest unconnected state.

- `analytics.js`: production-only visit tracking, lazy chart reads, cached counts, and the accessible about panel.
- `analytics.css`: traffic chart and panel styles.
- `analytics-config.js`: public service URL, start date, production host, and canonical catalog path.

GoatCounter counters can be cached for up to four hours. The chart uses UTC dates and differences between cumulative counts at successive boundaries to avoid overlapping time buckets. Failed requests display an unavailable state, not zero visits. Local previews never send visit events. History starts when tracking is enabled; earlier traffic cannot be recovered from this integration.

GitHub Pages serves the main catalog from `index.html`. Include the collectible and analytics JS/CSS files alongside it when publishing updates.
