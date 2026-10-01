/* Browser-based behavioral tests. No npm install is needed for the app itself.
 * Optional test dependency: playwright (set PLAYWRIGHT_MODULE if installed elsewhere).
 */
const path = require('node:path');
const fs = require('node:fs');
let playwright;
for (const candidate of [process.env.PLAYWRIGHT_MODULE, 'playwright', path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)) {
  try { playwright = require(candidate); break; } catch (_) {}
}
if (!playwright) {
  console.error('Tests require Playwright. Set PLAYWRIGHT_MODULE to its module directory.');
  process.exit(1);
}
(async () => {
  let browser;
  try { browser = await playwright.chromium.launch({ headless: true, channel: 'msedge' }); }
  catch (_) { browser = await playwright.chromium.launch({ headless: true }); }
  try {
    const page = await browser.newPage();
    await page.addScriptTag({ path: path.resolve(__dirname, '../engine.js') });
    await page.addScriptTag({ path: path.resolve(__dirname, '../demo.js') });
    const results = await page.evaluate(() => {
      const E = window.FomodEngine;
      const D = window.FomodDemo;
      const results = [];
      const assert = (condition, message) => { if (!condition) throw new Error(message); };
      const equal = (actual, expected, message) => assert(actual === expected, `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      const run = (name, fn) => { try { fn(); results.push({ name, passed: true }); } catch (error) { results.push({ name, passed: false, error: error.stack || error.message }); } };
      const env = { files: {}, gameVersion: '1.10.163' };
      const evaluate = (xml, selections = {}, environment = env) => { const model = E.parse(xml); return { model, evaluation: E.evaluate(model, selections, environment) }; };
      const plan = (xml, selections = {}, inventory = [], environment = env) => { const { model, evaluation } = evaluate(xml, selections, environment); return E.simulate(model, evaluation, inventory); };
      const config = body => `<?xml version="1.0"?><config><moduleName>Test package</moduleName>${body}</config>`;
      const plugin = (name, type = 'Optional', body = '') => `<plugin name="${name}"><description>${name}</description>${body}<typeDescriptor><type name="${type}" /></typeDescriptor></plugin>`;
      const group = (type, plugins) => `<group name="Choices" type="${type}"><plugins order="Explicit">${plugins}</plugins></group>`;
      const step = (name, groups, visible = '') => `<installStep name="${name}">${visible}<optionalFileGroups order="Explicit">${groups}</optionalFileGroups></installStep>`;
      const steps = body => `<installSteps order="Explicit">${body}</installSteps>`;
      const norm = value => String(value).replaceAll('/', '\\').toLowerCase();
      const operation = (result, destination, status = 'planned') => result.operations.find(item => norm(item.destination) === norm(destination) && item.status === status);

      run('Demo defaults choose 2K, hide weathering, and exclude unavailable patch', () => {
        const { model, evaluation } = evaluate(D.xml);
        equal(evaluation.steps.length, 3, 'step count');
        assert(evaluation.steps[0].groups[0].options[0].selected, 'recommended 2K should be selected');
        assert(!evaluation.steps[0].groups[0].options[1].selected, '4K should be unselected');
        assert(!evaluation.steps[2].visible, 'weathering step should be hidden');
        equal(evaluation.flags.quality, '2k', 'quality flag');
        const output = E.simulate(model, evaluation, D.files);
        equal(output.totals.planned, 4, 'default planned files');
        equal(output.totals.missing, 0, 'demo missing files');
        assert(operation(output, 'Trailbound.esp'), 'required plugin should be planned');
      });

      run('Changing texture choices changes flags and preserves destination mapping', () => {
        const selections = { 'option-0-0-0': false, 'option-0-0-1': true };
        const { model, evaluation } = evaluate(D.xml, selections);
        equal(evaluation.flags.quality, '4k', '4K flag');
        const output = E.simulate(model, evaluation, D.files);
        assert(norm(operation(output, 'textures/Trailbound/pack_d.dds').source).includes('textures\\4k'), '4K folder source should be expanded');
      });

      run('Weathering reveals a page and higher priority supersedes the base texture', () => {
        const { model, evaluation } = evaluate(D.xml, { 'option-1-0-0': true });
        assert(evaluation.steps[2].visible, 'third step should be visible');
        const output = E.simulate(model, evaluation, D.files);
        equal(output.totals.overridden, 1, 'one base color should be overridden');
        equal(output.totals.planned, 4, 'effective file count stays the same');
        assert(norm(operation(output, 'textures/Trailbound/pack_d.dds').source).endsWith('weathered\\amber.dds'), 'weathered source should win');
      });

      run('Backtracking removes hidden page files even when old selections remain', () => {
        const selections = { 'option-1-0-0': false, 'option-2-0-0': false, 'option-2-0-1': true };
        const { model, evaluation } = evaluate(D.xml, selections);
        assert(!evaluation.steps[2].visible, 'weathering should be hidden again');
        const output = E.simulate(model, evaluation, D.files);
        assert(!output.operations.some(item => norm(item.source).includes('weathered')), 'hidden-page files must not be simulated');
        equal(output.totals.overridden, 0, 'no stale override');
      });

      run('Simulated file dependency resolves case-insensitively and supports all states', () => {
        for (const state of ['Missing', 'Inactive', 'Active']) {
          const { evaluation } = evaluate(D.xml, {}, { files: { 'companionmod.esp': state }, gameVersion: '1.10.163' });
          const patch = evaluation.steps[1].groups[0].options[1];
          equal(patch.type, state === 'Active' ? 'Recommended' : 'NotUsable', `${state} option type`);
          equal(patch.selected, state === 'Active', `${state} default selection`);
        }
      });

      run('Explicitly declining a Recommended option is preserved', () => {
        const { evaluation } = evaluate(D.xml, { 'option-1-0-1': false }, { files: { 'companionmod.esp': 'Active' } });
        assert(!evaluation.steps[1].groups[0].options[1].selected, 'explicit false must not revert to recommendation');
      });

      run('Exactly-one and at-least-one groups report unsatisfied choices', () => {
        for (const type of ['SelectExactlyOne', 'SelectAtLeastOne']) {
          const xml = config(steps(step('One', group(type, plugin('A') + plugin('B')))));
          const empty = evaluate(xml, { 'option-0-0-0': false, 'option-0-0-1': false }).evaluation;
          assert(empty.issues.length > 0, `${type} must report empty selection`);
          const one = evaluate(xml, { 'option-0-0-0': true, 'option-0-0-1': false }).evaluation;
          equal(one.issues.length, 0, `${type} single selection should be valid`);
        }
      });

      run('At-most-one group catches competing selections; select-all locks every option', () => {
        const xml = config(steps(step('One', group('SelectAtMostOne', plugin('A') + plugin('B')))));
        assert(evaluate(xml, { 'option-0-0-0': true, 'option-0-0-1': true }).evaluation.issues.length > 0, 'multiple selections must violate SelectAtMostOne');
        const all = evaluate(config(steps(step('One', group('SelectAll', plugin('A') + plugin('B')))))).evaluation;
        assert(all.steps[0].groups[0].options.every(item => item.selected && item.locked), 'SelectAll should select and lock choices');
      });

      run('Required and NotUsable types constrain caller-supplied selections', () => {
        const xml = config(steps(step('One', group('SelectAny', plugin('Required', 'Required') + plugin('Blocked', 'NotUsable')))));
        const { evaluation } = evaluate(xml, { 'option-0-0-0': false, 'option-0-0-1': true });
        const [required, blocked] = evaluation.steps[0].groups[0].options;
        assert(required.selected && required.locked, 'required selection is enforced');
        assert(!blocked.selected && blocked.locked, 'not-usable option cannot be selected');
      });

      run('Folder expansion is case-insensitive and preserves nested relative paths', () => {
        const xml = config('<requiredInstallFiles><folder source="SOURCE\\textures" destination="textures\\Demo" /></requiredInstallFiles>');
        const output = plan(xml, {}, [{ path: 'source/Textures/nested/PACK.DDS', size: 8 }, { path: 'source/texturesElsewhere/no.dds', size: 9 }]);
        equal(output.totals.planned, 1, 'only folder-boundary matches should expand');
        assert(operation(output, 'textures/Demo/nested/PACK.DDS'), 'nested relative suffix is preserved');
        equal(output.totals.bytes, 8, 'size is counted once');
      });

      run('File renaming and an empty folder destination resolve under the package target', () => {
        const xml = config('<requiredInstallFiles><file source="core\\old.esp" destination="new.esp" /><folder source="payload" destination="" /></requiredInstallFiles>');
        const output = plan(xml, {}, [{ path: 'core/old.esp', size: 3 }, { path: 'payload/textures/x.dds', size: 5 }]);
        assert(operation(output, 'new.esp'), 'file should be renamed');
        assert(operation(output, 'textures/x.dds'), 'empty folder destination means target root');
      });

      run('Same-priority destination collisions remain visible in the plan', () => {
        const xml = config('<requiredInstallFiles><file source="a.dds" destination="shared.dds" priority="5" /><file source="b.dds" destination="shared.dds" priority="5" /></requiredInstallFiles>');
        const output = plan(xml, {}, [{ path: 'a.dds', size: 2 }, { path: 'b.dds', size: 4 }]);
        assert(output.totals.conflicts > 0, 'equal priority collisions should be reported');
        assert(output.operations.some(item => item.status === 'conflict'), 'conflict operation should be visible');
      });

      run('XML-only preview marks sources unverified and imported packages report missing sources', () => {
        const xml = config('<requiredInstallFiles><file source="missing.esp" destination="missing.esp" /><folder source="unknown" destination="textures" /></requiredInstallFiles>');
        const unverified = plan(xml, {}, null);
        equal(unverified.totals.unverified, 2, 'unknown inventory must not claim sources exist');
        equal(unverified.totals.missing, 0, 'unknown inventory is not known missing');
        const missing = plan(xml, {}, []);
        equal(missing.totals.missing, 2, 'empty inventory proves sources missing');
      });

      run('Unsafe paths cannot escape the virtual destination', () => {
        for (const unsafe of ['../outside.esp', '..\\outside.esp', 'C:\\outside.esp', '/root/outside.esp', '\\\\server\\share\\file', 'https://example.com/file']) {
          let threw = false;
          try { E.normalizePath(unsafe); } catch (_) { threw = true; }
          assert(threw, `unsafe path must reject: ${unsafe}`);
        }
      });

      run('Malformed XML, unexpected roots, and external-entity declarations reject cleanly', () => {
        for (const xml of ['<config><moduleName>broken</config>', '<other />', '<!DOCTYPE config [<!ENTITY x SYSTEM "file:///private">]><config><moduleName>&x;</moduleName></config>']) {
          let threw = false;
          try { E.parse(xml); } catch (_) { threw = true; }
          assert(threw, 'malformed or entity-bearing input must throw');
        }
      });

      run('Unknown features produce a diagnostic instead of silent full-support claims', () => {
        const model = E.parse(config('<futureFeature mode="magic" />'));
        assert(model.diagnostics.length > 0, 'unsupported elements should be reported');
      });

      run('Conditional installs follow selected flags and module dependencies reflect environment', () => {
        const xml = config('<moduleDependencies operator="And"><fileDependency file="Base.esp" state="Active" /></moduleDependencies>' + steps(step('One', group('SelectAny', plugin('Extra', 'Optional', '<conditionFlags><flag name="extra">on</flag></conditionFlags>')))) + '<conditionalFileInstalls><patterns><pattern><dependencies operator="And"><flagDependency flag="extra" value="on" /></dependencies><files><file source="extra.esp" destination="extra.esp" /></files></pattern></patterns></conditionalFileInstalls>');
        const blocked = evaluate(xml).evaluation;
        assert(!blocked.requirementsMet, 'missing module dependency should be reported');
        const environment = { files: { 'base.esp': 'Active' } };
        assert(evaluate(xml, {}, environment).evaluation.requirementsMet, 'active dependency should pass');
        equal(plan(xml, {}, [{ path: 'extra.esp', size: 2 }], environment).totals.planned, 0, 'unselected flag excludes conditional file');
        equal(plan(xml, { 'option-0-0-0': true }, [{ path: 'extra.esp', size: 2 }], environment).totals.planned, 1, 'selected flag includes conditional file');
      });

      run('Omitted destinations preserve source paths, while root and trailing-slash targets resolve correctly', () => {
        const xml = config('<requiredInstallFiles><file source="core\\keep.esp" /><folder source="bundle" /><file source="core\\root.esp" destination="" /><file source="core\\trailing.esp" destination="renamed\\" /><file source="core\\dot.esp" destination="." /></requiredInstallFiles>');
        const inventory = ['core/keep.esp', 'bundle/textures/color.dds', 'core/root.esp', 'core/trailing.esp', 'core/dot.esp'].map(path => ({ path, size: 1 }));
        const output = plan(xml, {}, inventory);
        for (const destination of ['core/keep.esp', 'bundle/textures/color.dds', 'root.esp', 'renamed/trailing.esp', 'dot.esp']) assert(operation(output, destination), `destination should resolve: ${destination}`);
      });

      run('Always-install and install-if-usable mappings honor their exceptions', () => {
        const mappings = '<files><file source="always.esp" destination="always.esp" alwaysInstall="true" /><file source="blocked.esp" destination="blocked.esp" installIfUsable="true" /></files>';
        const usable = '<files><file source="usable.esp" destination="usable.esp" installIfUsable="true" /></files>';
        const xml = config(steps(step('One', group('SelectAny', plugin('Blocked', 'NotUsable', mappings) + plugin('Usable', 'Optional', usable)))));
        const output = plan(xml, { 'option-0-0-0': false, 'option-0-0-1': false }, ['always.esp', 'blocked.esp', 'usable.esp'].map(path => ({ path, size: 1 })));
        assert(operation(output, 'always.esp'), 'alwaysInstall applies even to unusable unselected option');
        assert(operation(output, 'usable.esp'), 'installIfUsable applies to unselected usable option');
        assert(!output.operations.some(o => o.source === 'blocked.esp'), 'installIfUsable cannot include unusable option');
      });

      run('Hidden pages honor install exceptions without contributing normal selections or flags', () => {
        const mappings = '<files><file source="always.esp" destination="always.esp" alwaysInstall="true" /><file source="usable.esp" destination="usable.esp" installIfUsable="true" /><file source="ordinary.esp" destination="ordinary.esp" /></files><conditionFlags><flag name="hiddenFlag">set</flag></conditionFlags>';
        const xml = config(steps(step('Hidden', group('SelectAny', plugin('Hidden option', 'Recommended', mappings)), '<visible><fileDependency file="Absent.esp" state="Active" /></visible>')));
        const { model, evaluation } = evaluate(xml, { 'option-0-0-0': true });
        assert(!evaluation.steps[0].visible && !evaluation.flags.hiddenFlag, 'hidden page must not set flags');
        const output = E.simulate(model, evaluation, ['always.esp', 'usable.esp', 'ordinary.esp'].map(path => ({ path, size: 1 })));
        assert(operation(output, 'always.esp') && operation(output, 'usable.esp'), 'explicit install exceptions should still be represented');
        assert(!output.operations.some(o => o.source === 'ordinary.esp'), 'ordinary hidden mapping is excluded');
        assert(output.issues.some(i => /hidden step/i.test(i.message)), 'hidden exception compatibility caveat should be visible');
      });

      run('Nested dependency logic and first-match conditional option types evaluate deterministically', () => {
        const nested = '<moduleDependencies operator="And"><fileDependency file="Base.esp" state="Active" /><dependencies operator="Or"><fileDependency file="A.esp" state="Active" /><fileDependency file="B.esp" state="Inactive" /></dependencies></moduleDependencies>';
        const descriptor = '<plugin name="Typed"><description>Conditional option</description><typeDescriptor><dependencyType><defaultType name="NotUsable" /><patterns><pattern><dependencies><fileDependency file="Base.esp" state="Active" /></dependencies><type name="Recommended" /></pattern><pattern><dependencies><fileDependency file="Base.esp" state="Active" /></dependencies><type name="Required" /></pattern></patterns></dependencyType></typeDescriptor></plugin>';
        const xml = config(nested + steps(step('One', group('SelectAny', descriptor))));
        assert(!evaluate(xml, {}, { files: { 'base.esp': 'Active' } }).evaluation.requirementsMet, 'nested Or must fail without either child match');
        const evaluation = evaluate(xml, {}, { files: { 'base.esp': 'Active', 'b.esp': 'Inactive' } }).evaluation;
        assert(evaluation.requirementsMet, 'nested And and Or should both be satisfied');
        equal(evaluation.steps[0].groups[0].options[0].type, 'Recommended', 'first matching conditional type wins');
      });

      run('Game version dependencies compare numeric components instead of text', () => {
        const xml = config('<moduleDependencies><gameDependency version="1.9.9" /></moduleDependencies>');
        assert(evaluate(xml, {}, { files: {}, gameVersion: '1.10.0' }).evaluation.requirementsMet, '1.10.0 is newer than 1.9.9');
        assert(!evaluate(xml, {}, { files: {}, gameVersion: '1.9.8' }).evaluation.requirementsMet, 'older patch version should fail');
        assert(evaluate(xml, {}, { files: {}, gameVersion: '1.9.9.0' }).evaluation.requirementsMet, 'trailing zero components should be equivalent');
      });

      run('Explicit, ascending and descending order preserve stable XML-based IDs', () => {
        for (const order of ['Explicit', 'Ascending', 'Descending']) {
          const opts = `<plugins order="${order}">${plugin('Zulu')}${plugin('Alpha')}</plugins>`;
          const groups = `<optionalFileGroups order="${order}"><group name="Zulu" type="SelectAny">${opts}</group><group name="Alpha" type="SelectAny">${opts}</group></optionalFileGroups>`;
          const xml = config(`<installSteps order="${order}"><installStep name="Zulu">${groups}</installStep><installStep name="Alpha">${groups}</installStep></installSteps>`);
          const { evaluation } = evaluate(xml);
          const expected = order === 'Ascending' ? 'Alpha' : 'Zulu';
          const expectedIndex = order === 'Ascending' ? 1 : 0;
          equal(evaluation.steps[0].name, expected, `${order} page ordering`);
          equal(evaluation.steps[0].id, `step-${expectedIndex}`, 'ID tracks original XML index');
          equal(evaluation.steps[0].groups[0].name, expected, `${order} group ordering`);
          equal(evaluation.steps[0].groups[0].options[0].name, expected, `${order} option ordering`);
        }
      });

      run('Same-step flags warn and do not retroactively alter option dependencies', () => {
        const setter = plugin('Setter', 'Recommended', '<conditionFlags><flag name="sameStep">on</flag></conditionFlags>');
        const dependent = '<plugin name="Dependent"><description>Depends on this page</description><typeDescriptor><dependencyType><defaultType name="NotUsable" /><patterns><pattern><dependencies><flagDependency flag="sameStep" value="on" /></dependencies><type name="Recommended" /></pattern></patterns></dependencyType></typeDescriptor></plugin>';
        const { model, evaluation } = evaluate(config(steps(step('Same page', group('SelectAny', setter + dependent)))));
        equal(evaluation.steps[0].groups[0].options[1].type, 'NotUsable', 'only earlier-page flags drive this page');
        assert(model.diagnostics.some(i => i.level === 'warning'), 'same-page flag dependency limitation should be disclosed');
      });

      run('Unknown prototype-like elements and invalid schema shapes diagnose cleanly', () => {
        const unknown = E.parse(config('<constructor/><__proto__/>'));
        assert(unknown.diagnostics.length >= 2, 'unknown names must not collide with JavaScript object properties');
        const missingDescription = E.parse(config(steps(step('One', group('SelectAny', '<plugin name="Bad"><typeDescriptor><type name="Optional" /></typeDescriptor></plugin>')))));
        assert(missingDescription.diagnostics.some(i => i.level === 'error' && /description/i.test(i.message)), 'missing description should be diagnosed');
        const duplicate = E.parse(config('<conditionalFileInstalls><patterns><pattern><dependencies/><dependencies/><files/></pattern></patterns></conditionalFileInstalls>'));
        assert(duplicate.diagnostics.some(i => i.level === 'error' && /duplicate/i.test(i.message)), 'duplicate dependencies should not be silently accepted');
      });
      return results;
    });
    for (const result of results) console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.name}${result.passed ? '' : '\n' + result.error}`);
    console.log(`\n${results.filter(item => item.passed).length}/${results.length} behavior tests passed.`);
    if (results.some(item => !item.passed)) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
