# FOMOD Workbench: agent handoff

The user requested a fake FOMOD installer that displays a working wizard and reports which files it would install, without actually installing anything. The prototype also includes a visual editor and full XML editing. This branch makes the project available for another agent to continue.

## Location and startup

- Repository: `bmanzzs/backpacks-of-the-commonwealth`
- Branch: `codex/fomod-workbench`
- Project directory: `fomod-workbench/`
- Open `fomod-workbench/index.html` in desktop Edge or Chrome. There is no build step, package installation, or backend requirement.
- The repository root is a separate backpack catalog. Work on this tool belongs inside `fomod-workbench/` unless a later request explicitly expands the scope.

Read `README.md` in this directory for the feature list, file map, usage, and limitations. Read `VERIFICATION.md` for the existing verification evidence.

## Implementation

- `engine.js` exposes `window.FomodEngine`: XML parsing, rule evaluation, simulated dependencies, and file planning.
- `app.js` implements local package import, wizard navigation, visual/XML editing, browser-local draft recovery, and separate-copy downloads.
- `index.html` and `styles.css` supply the interface. Classic local scripts let the app work directly from `file://` without a server.
- `demo.js` contains an original built-in sample. `sample-package/` tests the actual folder picker. Its game-format files are labeled text fixtures, not usable game assets.

Preserve the dry-run design: the tool must not deploy, copy, move, or delete mod content, scan a real game installation, or upload opened packages. XML and report downloads happen only through explicit user actions. Keep the app free of external runtime dependencies and network requests. Visual editing must preserve advanced XML rules that it does not expose as fields.

## Tests

From the repository root:

```text
node fomod-workbench/tests/run.cjs
node fomod-workbench/tests/ui.cjs
```

Tests require Node.js, Playwright, and Edge or Chromium. They try an installed Playwright module, an optional `PLAYWRIGHT_MODULE` override, and an available bundled runtime. The app itself needs none of these development tools. UI test screenshots and backups are written to the ignored sibling `work/` directory; keep those generated files out of source commits.

The prototype's previous verification passed 25 engine cases and 15 UI flows. Those are existing build-time results, not a claim of a new test run during this Git upload. The upload adds source and handoff documentation without changing application behavior.

## Remaining validation

Version 0.1.0 is a tested prototype. Real mod-package coverage and comparison against target mod managers remain useful next steps. It does not promise exact MO2/Vortex appearance or every manager-specific behavior. Schema checks are targeted rather than a complete XSD validator; archive extraction and legacy scripted installers are not implemented. Preserve the diagnostics and documented compatibility distinctions when extending the engine.

This branch is a source handoff. Uploading it does not publish or deploy the workbench as a website, and does not change the repository's default branch.
