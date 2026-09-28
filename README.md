# backpacks-of-the-commonwealth
Field catalog for Backpacks of the Commonwealth: 26 backpacks, 4 backpack upgrade bobbleheads, and 5 magazines.

## Editing and previewing

Open `index.html` in a browser. This is a static GitHub Pages site; no install or build step is required.

- `index.html`: backpack records, embedded images, backpack card/table views, the map panel markup, and shared catalog controls.
- `map-view.js` / `map-view.css`: the interactive backpack map (see **Map view**).
- `collectibles-data.js`: magazine and bobblehead source records.
- `collectibles.js`: collectible effects, readable location labels, category switching, search, sorting, and detail dialogs.
- `collectibles.css`: collectible styles extending the original Pip-Boy theme.
- `backpacks.html`: separate legacy page; the main catalog is `index.html`.

## Map view

The map panel is sized to fit the browser window, so the whole Commonwealth is visible without scrolling the page. Scrolling over the map always scrolls the page; the map never captures the scroll wheel.

- Zoom: Ctrl/⌘ + scroll, trackpad pinch, double-click (Shift + double-click zooms out), the − / + buttons, or + / − keys. **Fit** shows the whole map.
- Pan: drag with the mouse (it glides after release), or use the arrow keys when the map has focus.
- Phones and tablets: one finger scrolls the page; two fingers pinch or move the map; double-tap zooms in.
- **Expand** opens the map full screen. There, plain scrolling zooms and one finger pans. Escape closes it.
- Hovering a pin shows its name and location. Clicking a pin or a **Locations** entry selects it: the map glides to the pin and a card shows its level, carry capacity, damage resistance, weight, previous/next buttons, and **View full stats**. Escape closes the card.
- The catalog search filters the pins, the list, and the location count.
- Overlapping pins are nudged apart at low zoom and settle onto their exact spots as you zoom in; zoomed in, pins show backpack thumbnails.
- The footer legend explains the map's colours (expected threat level, sampled from the map's own legend).
- Reduced-motion preference turns glides and animations into instant moves.

Pin positions live in `MAP_PINS` at the top of `map-view.js`, as percentages of the map's width and height. The map image is no longer embedded in `index.html`. It loads only when the map opens: `assets/map/commonwealth-2k.webp` (half size, WebP quality 85) first, then `commonwealth-4k.webp` (full 4158 × 4155, quality 90) once you zoom past what the smaller image can show sharply or open full screen. Both were exported from the previously embedded JPEG. If the map is replaced, export both sizes and update `W`, `H`, and `IMAGE.baseWidth` in `map-view.js` and the `.map-img` size in `map-view.css`.

## Browser icons

`favicon.ico` and `assets/icons/` provide browser-tab, Chrome shortcut, and Apple touch icons. `site.webmanifest` uses relative paths for GitHub Pages. The square source crop in `assets/icons/backpack-source.png` comes directly from the author's P.E.G.A. backpack screenshot supplied on September 13, 2026; the smaller files are Lanczos downscaled exports, with 16/32/48px frames in the ICO.

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

GitHub Pages serves the main catalog from `index.html`. Include the collectible, analytics, and map JS/CSS files and `assets/map/` alongside it when publishing updates.

## ARC-Tesla interactive preview

The separate **Field Lab** tile previews Arc-tesla P.C.D. Mk IV without adding unverified stats or locations to the 26-entry catalog. Hover or focus the tile to open the viewer; click or tap to keep it open. Drag to orbit through 360°, scroll/pinch to zoom, or focus the canvas and use arrow keys and +/−. Reset, turntable, animation, and close controls are available. Moving between the tile and popout keeps it open; Escape closes it.

- `arc-preview.js` / `arc-preview.css`: accessible popout, catalog filtering, video fallback, and visibility lifecycle.
- `arc-viewer.js`: lighting, orbit controls, bloom, fan rotation, alternating lightning, fluid and CRT scrolling, signal bars, and reactor glow. Effects use presentation timings rather than the game’s combat state.
- `assets/previews/arc-tesla/`: compressed GLB, still poster, and eight-second 768 × 768 / 30 fps WebM and MP4 renders.
- `assets/vendor/three/`: locally hosted Three.js 0.180.0 and only required modules, with its MIT license. No external viewer service or account is required.

Only the poster loads initially. The 3D library and model load on first interaction, and video loads only when selected or when 3D fails. Rendering stops while the popout is closed or the document is hidden. Reduced-motion preference disables initial animation and auto-rotation; manual camera controls remain available. Touch devices open the popout by tapping. The preview is hidden in other categories and table/map views.

Current preview source: `C:\Users\Admin\Documents\Fallout4_Mod_Projects\ARC_Tesla_PCD_MkIV\R6_CoilSeat_20260928\Source\ARC_PCD_MkIV_R6.blend`. The R6 preview includes the `ARC_Body` texture atlas, corrected coil seats, and repaired hatch UVs. Separate authoring scene, render frames, export scripts, and logs: `Website_Preview_R6_20260928` in that ARC project; `Website_Preview_20260927` is the earlier pipeline reference. Canonical Blender source and game assets are unchanged. Web effects and materials are adapted from the source; this preview is not evidence of in-game appearance or behavior.
