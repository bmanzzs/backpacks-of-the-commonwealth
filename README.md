# backpacks-of-the-commonwealth
Field catalog for Backpacks of the Commonwealth 2.1.2: 29 backpacks, 8 Vault-Tec charms, and 5 magazines.

## Editing and previewing

Open `index.html` in a browser. This is a static GitHub Pages site; no install or build step is required.

- `index.html`: backpack records, embedded images, backpack card/table views, the map panel markup, and shared catalog controls.
- `map-view.js` / `map-view.css`: the interactive backpack map (see **Map view**).
- `collectibles-data.js`: magazine and Vault-Tec charm records.
- `collectibles.js`: collectible effects, readable location labels, category switching, search, sorting, and detail dialogs.
- `collectibles.css`: collectible styles extending the original Pip-Boy theme.
- `backpacks.html`: separate legacy page; the main catalog is `index.html`.
- `pipboy.html`, `pipboy.css`, `pipboy.js`: the Pip-Boy mode (see **Pip-Boy mode**).
- `pipboy-launch.css`, `pipboy-launch.js`: the **Open Pip-Boy here** button. It is off for now (see **Pip-Boy mode**); the files are kept for when it returns.
- `backpacks-data.js`: the backpack records (`BACKPACKS`), workbench mods (`OMODS`) and thumbnail paths (`IMGS`) used by the Pip-Boy. The main catalog still keeps its own inline copy in `index.html`, so a data change has to be made in both places.
- `assets/backpacks/`: one WebP thumbnail per backpack (208 × 247). Backpacks 1–26 are exported from the images embedded in `index.html`; 27–29 are referenced by path. 27 and 28 are marked placeholders until catalog renders arrive, and 29 is cropped from the 3D preview's poster.
- `assets/pipboy/`: the Charisma bobblehead cut out of its black background and split at the neck (`bobble-head.webp`, `bobble-body.webp`, both 81 × 193) so the head can bobble.

## Map view

The map panel is sized to fit the browser window, so the whole Commonwealth is visible without scrolling the page. Scrolling over the map always scrolls the page; the map never captures the scroll wheel.

- Zoom: Ctrl/⌘ + scroll, trackpad pinch, double-click (Shift + double-click zooms out), the − / + buttons, or + / − keys. **Fit** shows the whole map.
- Pan: drag with the mouse (it glides after release), or use the arrow keys when the map has focus.
- Phones and tablets: one finger scrolls the page; two fingers pinch or move the map; double-tap zooms in.
- **Expand** opens the map full screen. There, plain scrolling zooms and one finger pans. Escape closes it.
- With `data-immersive` on `#map-view` (the Pip-Boy, which has no page behind the map), plain scrolling zooms and one finger pans without expanding. `window.catalogMap.focus(num)` flies to a backpack's pin.
- Hovering a pin shows its name and location. Clicking a pin or a **Locations** entry selects it: the map glides to the pin and a card shows its level, carry capacity, damage resistance, weight, previous/next buttons, and **View full stats**. Escape closes the card.
- The catalog search filters the pins, the list, and the location count.
- Overlapping pins are nudged apart at low zoom and settle onto their exact spots as you zoom in; zoomed in, pins show backpack thumbnails.
- The footer legend explains the map's colours (expected threat level, sampled from the map's own legend).
- Reduced-motion preference turns glides and animations into instant moves.

Pin positions live in `MAP_PINS` at the top of `map-view.js`, as percentages of the map's width and height. The map image is no longer embedded in `index.html`. It loads only when the map opens: `assets/map/commonwealth-2k.webp` (half size, WebP quality 85) first, then `commonwealth-4k.webp` (full 4158 × 4155, quality 90) once you zoom past what the smaller image can show sharply or open full screen. Both were exported from the previously embedded JPEG. If the map is replaced, export both sizes and update `W`, `H`, and `IMAGE.baseWidth` in `map-view.js` and the `.map-img` size in `map-view.css`.

## Pip-Boy mode

`pipboy.html` shows the same catalog as a Fallout 4 Pip-Boy 3000 Mk IV. **It is unlisted while it gets refined:** the main catalog no longer shows the **Open Pip-Boy here** button, and the page carries `noindex`, though it still opens at its address. To bring the button back, restore `<link rel="stylesheet" href="pipboy-launch.css">`, the `<a class="pb-launch">` block before `<header>` and `<script src="pipboy-launch.js"></script>` in `index.html` (see the commit that removed them). Hovering the button slides a bobblehead out from behind it, and clicking it switches the page off like a CRT before loading the Pip-Boy.

- **Screen:** one colour (Fallout 4's default Pip-Boy green, `#14FF17`, from `fPipboyEffectColor` 0.08 / 1.00 / 0.09), with hierarchy from brightness only. Roboto Condensed for the interface and Share Tech Mono for the boot text. Scanlines, a rolling refresh band, grain, flicker, vignette and glass are overlays that never block clicks.
- **Boot:** a memory dump, the PIP-OS boot text, then the bobblehead splash. It runs once per browser session; any key or click skips it.
- **Tabs:** STAT (STATUS, SPECIAL, PERKS), INV (WEAPONS, APPAREL, AID, MISC, JUNK, MODS, AMMO), DATA (QUESTS, WORKSHOPS, STATS), MAP (WORLD MAP, LOCAL MAP) and RADIO.
  - **APPAREL** lists the 26 backpacks. Equipping one feeds STATUS, the carry-weight readout and ▲/▼ comparisons. **MODS** installs one carry mod and one armor mod per backpack. **WEAPONS** lists the combat mods; **AID**, **JUNK** and **AMMO** total every ingredient needed to craft everything once. **MISC** holds the magazines and bobbleheads.
  - **PERKS** ranks dim the mods you cannot craft yet. **SPECIAL** base values (28 points, as at character creation) set Strength for carry weight: 200 + 10 × Strength, plus 25 or 50 for Strong Back, plus the backpack.
  - Maximum carry and damage resistance are the best values the workbench mods can reach. Two headline strings in the data promise more than any mod gives: Trapper's Back Pouch lists +45 carry (its best mod gives +40) and Tinker's Rucksack lists +35 DR (it has no armor mods, so it stays at 25).
  - **QUESTS** is a collection tracker: every backpack, bobblehead and magazine is an objective you can tick off.
  - **WORLD MAP** reuses `map-view.js` with the map tinted to the Pip-Boy colour; **T** switches to the original threat-level colours. Found backpacks show solid pins. **LOCAL MAP** shows a crop around each backpack and the collectible location photos.
  - **RADIO** has five stations drawn on an oscilloscope. **ARC-Tesla Transmission** loads the Arc-tesla 3D preview (`arc-viewer.js`) inside the Pip-Boy, tinted like the rest of the screen, with a true-colour toggle.
- **Controls:** 1–5 or Shift+←/→ for tabs; ←/→ or A/D for sub-tabs (arrows also move along a focused tab strip); ↑/↓ or W/S for lists (the mouse wheel scrolls them, and resting the pointer on a row selects it, as in the game); E or Enter for the **E)** action at the bottom of the screen; every other action shows its key. On phones and narrow windows Enter opens the selected row's details first. `?` lists the controls. The side buttons change the colour, turn on the Pip-Boy light, sound effects (synthesised with Web Audio, off by default) and the CRT effects, and exit to the catalog.
- **No scroll trap:** the page itself never scrolls. Lists and detail panels scroll inside the screen, and the map zooms with plain scroll because there is no page behind it.
- **Phones:** the device frame is dropped, lists fill the screen, and tapping a row slides its details over it (the back gesture closes them). Swipe sideways on a list to change sub-tab. In landscape and short windows the side buttons move to a slim column on the right.
- **Saved in the browser only:** equipped backpack, installed mods, found items, perk ranks, SPECIAL, level, colour and effect settings (`localStorage` key `pipboy.v1`). Holding a key never repeats an action, and single-letter shortcuts can be turned off in HELP.
- **Links:** `pipboy.html#inv/apparel/18` opens a backpack; `#map/world`, `#data/quests`, `#radio/arc` and so on open a screen.
- Reduced-motion preference skips the boot and turns off the band, grain, flicker and bobbling.

Pip-Boy visits are not counted by the traffic panel, which counts the main catalog only.

## Browser icons

`favicon.ico` and `assets/icons/` provide browser-tab, Chrome shortcut, and Apple touch icons. `site.webmanifest` uses relative paths for GitHub Pages. The square source crop in `assets/icons/backpack-source.png` comes directly from the author's P.E.G.A. backpack screenshot supplied on September 13, 2026; the smaller files are Lanczos downscaled exports, with 16/32/48px frames in the ICO.

## 2.1.0 backpacks

Backpacks 27–29 (RobCo Nukatility Combo Pack, Brotherhood S.E.N.T.R.Y. Device, Arc-tesla P.C.D. Mk IV) were added from the reference spreadsheet's `Main` tab (levels 70, 75 and 80), then checked against the released 2.1.0 plugin: their descriptions, colours, weights, values and recipes, and every workbench mod's name, description, components and perks, are the plugin's own text. Their components keep the plugin's recipe order; packs 1–26 list components in item-FormID order, as the catalog always has. The S.E.N.T.R.Y. has no colour options in the plugin, so the sheet's Gunmetal/Black and Olive/Steel are not listed.

Locations: RobCo sits in a terminal-locked storage cage at Wilson Atomatoys Factory, the S.E.N.T.R.Y. behind a terminal-locked gate in Fort Strong's sublevel, and the Arc-tesla in a Master-locked case in Vault-Tec Bunker Sigma, in the south-east Glowing Sea about 43,000 units south of Vault 95. The Arc-tesla's pin is Bunker Sigma's own map marker, converted with a linear fit of the ten packs that lie in exterior cells (each lands within about 1% of its pin); the same fit confirms the Wilson Atomatoys and Fort Strong pins.

Checked against the same plugin, packs 1–26 now show: the P.E.G.A. at level 65; the Radio's SCR-3000 to SCR-3003 frames; the in-game colour names (the P.E.G.A. has ten radiation colours, the Scribe four finishes, the Wastelander none); the 2.1.0 mod texts (Hidden Stash and Lucky Teddy Bear +65, Plenty-O'-Pockets, the Wastelander's Rad-X pouch removing rads, the G.A.R.I.'s anti-gravity field); and corrections to weights (Trapper 2, Super Mutant 10, R.O.B.B. 7, Junkie's 4, Vault-Tec 6 and P.E.G.A. 8 lbs), the G.A.R.I.'s in-game name and value (834 caps), the Trapper's and Woodsman's frame texts, Brahmin, and recipes that were listed under a sibling mod (Wastelander, Squire, R.O.B.B., G.A.R.I., Mercenary, Vault-Tec, P.E.G.A.). The legacy `backpacks.html` is not updated.

## 2.1.2 update

Checked against the 2.1.2 release plugin (`ReleasePipeline\staging\2.1.2`, not the live development copy). The four bobbleheads are now the eight Vault-Tec charms (category key `charms`): each unlocks a Vault-Tec Utility Backpack edition that hangs its animated charm from the pack. Their cells come from the plugin's placed references; the four original location photos still match (the placements did not move). Charm thumbnails are renders of the installed item models, front-on so VAULT-TEC reads on the base. The Vault-Tec pack lists all ten editions; the Small Shoulder Bag, Leather Shoulder Bag and Raider's container show their new effects; the Mountaineer's Backpack mentions its bedroll and Straps / Strapless option. Vault-Tec Bunker Sigma moved to the northern Glowing Sea (cell -24,-19), so the Arc-tesla pin now comes from the new map marker. The bobbling Vault Boy icon was re-cut: the head sprite holds only the head, the body sprite carries the whole bedroll plus a short shadowed neck, so no part of the pack moves with the head (tool: `ReleasePipeline\website\icon_recut.py`).

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

## Vault-Tec survey

Visitors rank up to five favorite backpacks. A #1 pick earns 5 points, and each place below earns one less. The survey shows up in four places:

- A "Vault-Tec has selected you to participate in a survey!" invitation in the bottom left. It appears once per visit, after the boot screen, and waits while a detail page, the ? panel, or a text field is in use. Two "Not now"s turn it off in that browser.
- A featured card under the ARC tile (backpack card view only).
- A 👍 **Like** button on every backpack's detail page. It opens the survey with that backpack already on the ballot. It reads **Liked** once that backpack is on the visitor's submitted ballot. "N people like this" counts the ballots that include it.
- Results in the ? panel: ballots cast and the standings, top five first.

Ballots go to a small Google Apps Script web app that you own. A static GitHub Pages site can't store anything other visitors can see, so the script is the free place that keeps everyone's votes. It stores them in its own built-in storage (Script Properties): no spreadsheet, and no access to your Drive or Sheets.

1. Go to [script.google.com](https://script.google.com) and choose **New project**.
2. Replace `Code.gs` with `tools/vault-tec-survey.gs` and save.
3. Choose **Deploy > New deployment > Web app**. Set **Execute as** to *Me* and **Who has access** to *Anyone*, then deploy. If Google asks you to authorize, it's only for the script's own storage.
4. Copy the web app URL (it ends in `/exec`) into `survey-config.js` as `endpoint`.

After editing the script later, use **Deploy > Manage deployments > Edit > Version: New version** so the URL stays the same.

- `survey.js` / `survey.css`: invitation, featured card, ballot dialog, Like buttons, and ? panel results.
- `survey-config.js`: the endpoint, the survey round (`id`), and the ballot length (`picks`, 1–5). An empty endpoint hides every part of the survey, including the Like buttons.
- `tools/vault-tec-survey.gs`: the backend. It validates ballots, caches results for two minutes, and accepts at most 60 ballots a minute across all visitors.

The script keeps one entry per browser and round: a random browser ID and the picks as backpack numbers, plus the time of the round's latest ballot. It stores no names, emails, or IP addresses. Submitting again from the same browser replaces that browser's ballot. Another browser, or cleared site data, counts as a new voter, so treat the results as a fan poll rather than a secure vote. The storage holds 500 KB, roughly 8,000 ballots; after that, new ballots are refused with a message while existing voters can still change theirs. To start a fresh round, change `id` (for example, to `favorites-2`); earlier ballots stay stored but stop counting. Backpacks added to the catalog join the survey automatically.

## ARC-Tesla interactive preview

The **Field Lab** tile is the interactive 3D preview of the Arc-tesla P.C.D. Mk IV, catalog entry 29 since 2.1.0; its **Full stats** button opens that entry. Hover or focus the tile to open the viewer; click or tap to keep it open. Drag to orbit through 360°, scroll/pinch to zoom, or focus the canvas and use arrow keys and +/−. Reset, turntable, animation, and close controls are available. Moving between the tile and popout keeps it open; Escape closes it.

- `arc-preview.js` / `arc-preview.css`: accessible popout, catalog filtering, video fallback, and visibility lifecycle.
- `arc-viewer.js`: lighting, orbit controls, bloom, fan rotation, alternating lightning, fluid and CRT scrolling, signal bars, and reactor glow. Effects use presentation timings rather than the game’s combat state.
- `assets/previews/arc-tesla/`: compressed GLB, still poster, and eight-second 768 × 768 / 30 fps WebM and MP4 renders.
- `assets/vendor/three/`: locally hosted Three.js 0.180.0 and only required modules, with its MIT license. No external viewer service or account is required.

Only the poster loads initially. The 3D library and model load on first interaction, and video loads only when selected or when 3D fails. Rendering stops while the popout is closed or the document is hidden. Reduced-motion preference disables initial animation and auto-rotation; manual camera controls remain available. Touch devices open the popout by tapping. The preview is hidden in other categories and table/map views.

Current preview source: `C:\Users\Admin\Documents\Fallout4_Mod_Projects\ARC_Tesla_PCD_MkIV\R7_Final_20260928\R7_7_BoltSeat\Source\ARC_PCD_MkIV_R7_7.blend`, the final R7.7 model (seated hatch bolts, the support bar through the black rings behind the fan, and the seated heat exchanger). The web copy leaves out the in-game refraction field and rebuilds the `ARC_Body`, `ARC_Nameplate` and status-ring materials from the R7 runtime textures; the GLB has 23,908 triangles and WebP textures (normal and ORM maps lossless). Separate authoring scene, render frames, export, compression and validation scripts, and logs: `Website_Preview_R7_7_20261003` in that ARC project; `Website_Preview_R6_20260928` (the R6 preview it replaces) and `Website_Preview_20260927` are the earlier pipeline references. Canonical Blender source and game assets are unchanged. Web effects and materials are adapted from the source; this preview is not evidence of in-game appearance or behavior.
