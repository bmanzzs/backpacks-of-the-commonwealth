# backpacks-of-the-commonwealth
Field catalog for Backpacks of the Commonwealth: 26 backpacks, 4 backpack upgrade bobbleheads, and 5 magazines.

## Editing and previewing

Open `index.html` in a browser. This is a static GitHub Pages site; no install or build step is required.

- `index.html`: page markup only: top bar, hero, inventory, field map, collectibles, prototype, footer, about panel.
- `site.css`: design tokens (colors, type, spacing) and all page styles.
- `backpacks-data.js`: the backpack records (`BACKPACKS`), their workbench mods (`OMODS`), and thumbnail paths (`IMGS`). Edit backpack data here.
- `assets/backpacks/`: one WebP thumbnail per backpack (208 × 247, quality 90), exported from the images that used to be embedded in `index.html`. A new backpack needs a record in `BACKPACKS`, an `OMODS` entry, a thumbnail and a matching `IMGS` path, and a pin in `MAP_PINS` (see **Map view**).
- `catalog.js`: the carry-capacity chart, inventory (inspect and compare), collectibles shelves and dialog, section navigation and deep links.
- `map-view.js` / `map-view.css`: the interactive backpack map (see **Map view**).
- `collectibles-data.js`: magazine and bobblehead source records.
- `prototype.js`: the Arc-tesla prototype teaser (see **Arc-tesla prototype teaser**).
- `backpacks.html`: separate legacy page; the main catalog is `index.html`.

## Page layout

The page reads like a Pip-Boy terminal: a sticky top bar (a bottom tab bar on phones) with **INV**, **MAP**, **DATA** and **LAB** sections that highlight as you scroll.

- **Hero:** title, counts (backpacks, workbench mods, bobbleheads, magazines, computed from the data), and a carry-capacity-by-level chart. Each backpack is a line from its base carry capacity to its best workbench mod; hover or focus shows it, selecting opens it in the inventory. Arrow keys move through the chart when it has focus.
- **Inventory, Inspect view:** the backpack list on the left scrolls with the page; the spec sheet on the right stays pinned. It shows stats, every carry-capacity and resistance mod as a bar on one scale shared by all backpacks, each mod's side effects, perks and components, the base recipe, a mini-map of the location, and colors. With the list focused, ↑/↓/Home/End move through backpacks.
- **Inventory, Compare view:** a sortable table of every backpack. Selecting a row opens it in Inspect.
- **Search, sort, your level:** search covers names, places, mods and perks. **Your level** (remembered in the browser) dims backpacks above it in the list, table and chart.
- **Links:** **Copy link** copies a direct link to a backpack (`#bp-07`). **Show on field map** flies the map to its pin; the map card's **Open in inventory** goes the other way.
- **Phones:** tapping a backpack slides its spec sheet over the list, with previous/next buttons; the back gesture closes it.

## Map view

The map panel is sized to fit the browser window, so the whole Commonwealth is visible without scrolling the page. Scrolling over the map always scrolls the page; the map never captures the scroll wheel.

- Zoom: Ctrl/⌘ + scroll, trackpad pinch, double-click (Shift + double-click zooms out), the − / + buttons, or + / − keys. **Fit** shows the whole map.
- Pan: drag with the mouse (it glides after release), or use the arrow keys when the map has focus.
- Phones and tablets: one finger scrolls the page; two fingers pinch or move the map; double-tap zooms in.
- **Expand** opens the map full screen. There, plain scrolling zooms and one finger pans. Escape closes it.
- Hovering a pin shows its name and location. Clicking a pin or a **Locations** entry selects it: the map glides to the pin and a card shows its level, carry capacity, damage resistance, weight, previous/next buttons, and **Open in inventory**. Escape closes the card.
- The map loads when you scroll near it; the inventory's **Show on field map** flies straight to a pin.
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

The `?` button opens a small public traffic chart with 1M (past 30 days), 1Y (past 12 calendar months), and ALL ranges. It counts visits to the main catalog, not selections or detail views. Counts can include returning visitors and are not an all-time count of distinct people.

The data service is [GoatCounter](https://www.goatcounter.com/). In the site's settings, enable **Allow adding visitor counts on your website**. The full GoatCounter dashboard can remain private. Set the public site URL and the actual tracking start date in `analytics-config.js`; do not add a password or API token. An empty URL disables tracking and displays an honest unconnected state.

- `analytics.js`: production-only visit tracking, lazy chart reads, cached counts, and the accessible about panel.
- `analytics.css`: traffic chart and panel styles.
- `analytics-config.js`: public service URL, start date, production host, and canonical catalog path.

GoatCounter counters can be cached for up to four hours. The chart uses UTC dates and differences between cumulative counts at successive boundaries to avoid overlapping time buckets. Failed requests display an unavailable state, not zero visits. Local previews never send visit events. History starts when tracking is enabled; earlier traffic cannot be recovered from this integration.

GitHub Pages serves the main catalog from `index.html`. Include `site.css`, the JS files, and the `assets/` folders alongside it when publishing updates.

## Arc-tesla prototype teaser

The **LAB** section previews the upcoming Arc-tesla P.C.D. Mk IV without adding unverified stats or locations to the 26-entry catalog; its stats are shown as classified. **Power on 3D preview** loads the viewer. Drag to orbit through 360°, scroll/pinch to zoom, or focus the canvas and use arrow keys and +/−. Pause, turntable, reset and render/3D controls are available.

- `prototype.js`: the teaser stage, controls, video fallback, and visibility lifecycle.
- `arc-viewer.js`: lighting, orbit controls, bloom, fan rotation, alternating lightning, fluid and CRT scrolling, signal bars, and reactor glow. Effects use presentation timings rather than the game’s combat state.
- `assets/previews/arc-tesla/`: compressed GLB, still poster, and eight-second 768 × 768 / 30 fps WebM and MP4 renders.
- `assets/vendor/three/`: locally hosted Three.js 0.180.0 and only required modules, with its MIT license. No external viewer service or account is required.

Only the poster loads initially. The 3D library and model load when someone powers the preview on, and video loads only when selected or when 3D fails. Rendering stops while the stage is off screen or the document is hidden. Reduced-motion preference disables initial animation and auto-rotation; manual camera controls remain available.

Source: `C:\Users\Admin\Documents\Fallout4_Mod_Projects\ARC_Tesla_PCD_MkIV\Source\ARC_PCD_MkIV.blend`. Separate authoring scene, render frames, export scripts, and logs: `Website_Preview_20260927` in that ARC project. Canonical Blender source and game assets are unchanged. Web effects and materials are adapted from the source; this preview is not evidence of in-game appearance or behavior.
