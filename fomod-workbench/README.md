# FOMOD Workbench

A portable, offline FOMOD wizard previewer, editor, and installation simulator for mod authors. Version **0.1.0 — preview**.

**Open `index.html` in Microsoft Edge or Chrome.** No install, server, account, build process, or game installation is required. Keep the adjacent JavaScript and CSS files with it. The same folder can also be served by an ordinary static web host.

## Start here

1. Explore the built-in Trailbound sample. Select texture quality, turn on weathering, and inspect the conditional third page.
2. Choose **Open mod folder** and select an extracted mod's package root, containing `fomod/ModuleConfig.xml` and its source assets. Selecting the whole package lets Workbench expand folders, verify sources, and show images. If multiple installers exist, choose one.
3. Make your choices and select **Simulate installation**. Inspect the file plan and console log; download a text log or JSON plan if useful.
4. Use **Editor** for visual changes or full XML editing. **Download ModuleConfig.xml** saves a separate copy. Place that copy in your package yourself when ready.

**New** starts an installer from a small editable template. **Open XML** previews a configuration without assets: file existence, folder contents, and package images remain unverified until you open the full package.

The sample-package directory is available for testing the real folder picker. Its `.esp`, `.nif`, and `.dds` files are clearly labeled text fixtures, not game assets. Do not install the sample in a game. Built-in sample file sizes are illustrative.

## Included

- Wizard pages, groups, single and multiple selections, descriptions, package images, and Back/Next navigation.
- All five selection rules: SelectAny, SelectAll, SelectExactlyOne, SelectAtMostOne, SelectAtLeastOne.
- Required, Recommended, Optional, NotUsable, and CouldBeUsable option types; conditional option types.
- Conditional page visibility, flags, nested And/Or rules, conditional files, required files, and simulated file/game dependencies.
- A mock environment for Active/Inactive/Missing files and game versions, separate from the opened package's source inventory.
- Case-insensitive source lookup, folder expansion, file renaming, priority resolution, collision reports, missing sources, image checks, and skipped-file reasons.
- Visual editing of installer/page/group/option names, descriptions, image paths, selection rules, option types, file mappings, and priorities. Add/remove pages, groups, and options; undo the last 30 applied edits.
- Full XML editing with parse errors, Apply to preview, and separate-copy download. Ctrl+Enter applies XML; Ctrl+S downloads XML.
- Optional browser-local draft recovery. On reload, only the XML draft is recovered; source files, images, and mock environment must be reopened/re-entered. Draft recovery depends on browser storage availability and is not a substitute for downloading your work.

## What the simulation means

There is no installation implementation. Selected files are read only for configuration and image previews; file metadata supplies the inventory. No mod content is copied, moved, deleted, deployed, or uploaded. Downloads are only the XML or reports you explicitly request. The app makes no external network requests, has no analytics, and does not fetch the XML schema URL.

Destinations in the plan are relative to a game's Data folder or the mod manager's staging root. `COPY` means a proposed mapping with a source found in the opened package. It does not mean that a copy occurred. `UNVERIFIED` is used when only XML is available. Overridden rows remain visible so you can trace the winning mapping. Equal-priority competing sources are reported as ambiguous instead of inventing a definitive winner.

The package inventory is a snapshot. Reopen the folder after adding/removing assets or changing its XML outside Workbench. Unapplied XML changes do not change the working preview. Applying editor changes resets wizard selections; changing the mock environment recalculates conditions.

## Compatibility and limitations

This is a useful tested prototype, **not a certified replacement for testing in your target mod manager**. Workbench uses its own visual design. It does not reproduce every MO2/Vortex layout detail or implementation quirk.

- XML-based ModuleConfig installers only. Legacy scripted installers and archive extraction are not supported. Extract ZIP/7z/RAR packages first.
- Covers the common FOMOD 5-style XML features above. Validation checks structure and supported values; it is not full XSD validation.
- Advanced dependency rules and condition flags are edited in XML. The visual editor retains these existing nodes rather than flattening them.
- Unsupported elements/attributes are retained with diagnostics. Unsupported dependency types evaluate to false with a warning; they are never silently treated as satisfied.
- Only simulated file states and game versions are evaluated. No game scanning, plugin activation, or mod-manager integration.
- Flags used for page visibility and option types reflect earlier visible pages. Conflicting assignments and manager-specific cases are reported where detected.
- File mappings with explicit `alwaysInstall` or `installIfUsable` can contribute files from hidden pages, following Nexus behavior. Such cases are warned because managers can differ. Ordinary hidden-page choices never contribute files or flags.
- Exactly-one groups with no required or recommended option ask for a choice; some mod managers may preselect the first option instead.
- XML editing preserves existing elements, attributes, and comments; serialization may normalize formatting and the XML declaration. Downloads use UTF-8.
- No automatic detection of existing destination files in a real game installation. Collision checks concern the current simulated package plan.
- Standard browser image formats work; DDS previews do not. Missing/unreadable images are reported.
- Source/destination paths must be safe relative Windows-style paths. Absolute paths, traversal, alternate streams, and reserved filenames are rejected. XML DTD/entity declarations are rejected.
- Large plans show the first 300 matching table rows and a bounded console preview. Report downloads contain the complete results.
- Best experience: current desktop Edge or Chrome. Folder picking and local draft storage vary by browser. The layout also adapts to narrow screens.

## Share or modify

Zip this entire folder and share it; the recipient extracts it and opens `index.html`. No private paths, credentials, telemetry configuration, or game files are required. The app's original source and demo artwork are provided under the MIT license in `LICENSE`.

Files:

- `engine.js`: XML parsing, choices, conditions, and dry-run planning.
- `app.js`: local folder import, wizard, visual/XML editor, and exports.
- `index.html` / `styles.css`: accessible responsive interface.
- `demo.js` / `sample-package/`: original example and text-only fixtures.
- `tests/`: browser-based regression tests (optional development dependency).

## Development checks

The app has no runtime dependencies. Tests use Node.js and Playwright with Edge or Chromium. Install those only if you want to run the tests. If Playwright is outside normal module resolution, set `PLAYWRIGHT_MODULE` to its installed module directory.

```text
node tests/run.cjs
node tests/ui.cjs
```

Engine tests exercise actual XML parsing and simulation in a browser. UI tests cover importing, selecting, editing, exporting, responsive layout, and absence of external requests.

Behavior references used while implementing:

- [Wrye Bash FOMOD developer reference](https://github.com/wrye-bash/wrye-bash/wiki/%5Bdev%5D-Fomod-for-Devs)
- [Nexus Mods FOMOD installer](https://github.com/Nexus-Mods/fomod-installer)
- [Mod Organizer FOMOD installer](https://github.com/ModOrganizer2/modorganizer-installer_fomod)

These projects are references, not bundled dependencies or endorsements.
