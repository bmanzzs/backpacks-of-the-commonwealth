# Website (Field Catalog) → General - Deploy

From the cloud session that maintains https://bmanzzs.github.io/backpacks-of-the-commonwealth/. Cloud sessions can't message sessions on Bman's PC, so this file is the message.

**How to reply:** push the files below, plus a `handoff/REPLY.md` with the text answers, to a new branch of `bmanzzs/backpacks-of-the-commonwealth` (for example `deploy/website-2.1.0`), then tell Bman the branch name. Don't push to `main`.

## Where the site stands

The 2.1.0 update is on branch `claude/practical-fermat-13yh4f` (not live yet):

- The three new backpacks: #27 RobCo Nukatility Combo Pack (level 70), #28 Brotherhood S.E.N.T.R.Y. Device (75), #29 Arc-tesla P.C.D. Mk IV (80).
- The Pip-Boy button is gone, the P.E.G.A. is level 65, and the patch-note text corrections are in.
- Data came from the sheet's `Main` tab, plus the 2.1.0 patch notes and the `Tracker` tab.

To see the current text for the new packs, search `index.html` for `BPRobCo`, `BPSentry` and `BPArc`.

## What the site still needs

1. **ARC web preview from the final R7.7 model** (`ARC_Tesla_PCD_MkIV\R7_Final_20260928\R7_7_BoltSeat`). Use the same pipeline as `Website_Preview_R6_20260928`, and leave the canonical `.blend` untouched. Put these in `assets/previews/arc-tesla/`:
   - `model.glb`: compressed, with WebP textures. Keep the names `arc-viewer.js` uses: node `ARC_RotorPivot`, nodes `ARC_BoltGate_<1-3>_<0-1>`, and materials `ARC_Signal1`–`7`, `ARC_Fluid*`, `ARC_Graph`, `ARC_Ticker`, `ARC_ReactorCore`, `ARC_Arc_*`.
   - `poster.webp`: 768 × 768.
   - `turntable.webm` and `turntable.mp4`: 8 seconds, 768 × 768, 30 fps.
2. **Catalog thumbnails**: 208 × 247 WebP, the pack centred on a black background like `assets/backpacks/26-p-e-g-a-fusion-powered-p-c-d-mk-iii.webp`. Name them `assets/backpacks/27-robco-nukatility-combo-pack.webp`, `28-brotherhood-s-e-n-t-r-y-device.webp` and `29-arc-tesla-p-c-d-mk-iv.webp` (29 from R7.7). Right now 27 and 28 are "IMAGE PENDING" placeholders, and 29 is cropped from the R6 poster.
3. **Exact 2.1.0 ESP data for the three new packs**:
   - For each pack: base description, weight, value and colour options.
   - For every carry mod (frame or module) and armour mod (lining or plating): name, description, components with counts, and perk requirements.

   The sheet still says 3 seconds for the S.E.N.T.R.Y.'s Reconnaissance Burst; the patch notes say six seconds, and the site uses six.
4. **Bunker Sigma's entrance**: where it is in the Commonwealth, as the nearest vanilla map marker or world coordinates, so the Arc-tesla gets a map pin. Also confirm the RobCo pin at Wilson Atomatoys Factory and the S.E.N.T.R.Y. pin at Fort Strong (the cage).
5. **Anything else from 2.1.0 the site should show for existing backpacks**: changed stats, names, levels or colours.
