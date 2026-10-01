/* End-to-end tests exercise the actual app from file:// with a local package.
 * Requires Playwright for testing only; the distributed app has no dependencies.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
let playwright;
for (const candidate of [process.env.PLAYWRIGHT_MODULE, 'playwright', path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)) {
  try { playwright = require(candidate); break; } catch (_) {}
}
if (!playwright) { console.error('Set PLAYWRIGHT_MODULE to an installed Playwright module directory.'); process.exit(1); }
const root = path.resolve(__dirname, '..');
const sample = path.join(root, 'sample-package');
const outputs = path.resolve(root, '../work');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
function digestTree(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? digestTree(full) : [[path.relative(sample, full), crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')]];
  });
}
function preserveOutput(file) {
  if (!fs.existsSync(file)) return;
  const backup = path.join(outputs, 'fomod-qa-backups', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(backup, { recursive: true });
  fs.copyFileSync(file, path.join(backup, path.basename(file)), fs.constants.COPYFILE_EXCL);
}
(async () => {
  let browser;
  try { browser = await playwright.chromium.launch({ headless: true, channel: 'msedge' }); }
  catch (_) { browser = await playwright.chromium.launch({ headless: true }); }
  const before = JSON.stringify(digestTree(sample));
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true });
  const page = await context.newPage();
  const outbound = [], pageErrors = [], results = [];
  page.on('request', request => { if (/^https?:/i.test(request.url())) outbound.push(request.url()); });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.route(/^https?:\/\//i, route => route.abort());
  const run = async (name, fn) => {
    try { await fn(); results.push({ name, passed: true }); console.log('PASS ' + name); }
    catch (error) { results.push({ name, passed: false, error: error.message }); console.error('FAIL ' + name + '\n' + error.stack); }
  };
  const snapshot = () => page.evaluate(() => {
    const s = window.FomodWorkbench.snapshot();
    return { name: s.name, source: s.source, dirty: s.dirty, totals: s.plan.totals, flags: s.evaluation.flags, operations: s.plan.operations.map(o => ({ source: o.source, destination: o.destination, status: o.status })), steps: s.evaluation.steps.map(step => ({ name: step.name, visible: step.visible, groups: step.groups.map(g => ({ name: g.name, options: g.options.map(o => ({ name: o.name, description: o.description, type: o.type, selected: o.selected })) })) })) };
  });
  const expectText = async (selector, text) => page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent.includes(text), { selector, text });
  const editField = async (label, value) => { const field = page.getByLabel(label, { exact: true }); await field.fill(value); await field.dispatchEvent('change'); };
  const rules = xml => page.evaluate(source => {
    const doc = new DOMParser().parseFromString(source, 'application/xml');
    return [...doc.querySelectorAll('conditionFlags, dependencyType, visible')].map(n => new XMLSerializer().serializeToString(n));
  }, xml);
  let baselineRules, editedXML;
  try {
    await run('Launch the complete offline app directly from file://', async () => {
      await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
      await page.waitForFunction(() => Boolean(window.FomodWorkbench));
      const s = await snapshot();
      assert(s.name === 'Trailbound • Field Kit', 'built-in sample name');
      assert(s.totals.planned === 4 && s.totals.missing === 0, 'demo default plan must be valid');
      assert(await page.locator('#panel-preview').isVisible(), 'wizard should be shown');
      await page.locator('.inspector-image').evaluate(img => img.decode());
    });

    await run('Import XML alone and report sources as unverified', async () => {
      await page.locator('#xml-input').setInputFiles(path.join(sample, 'fomod/ModuleConfig.xml'));
      await expectText('#package-status', 'XML only');
      const s = await snapshot();
      assert(s.totals.unverified === 3, 'required file and two folder mappings should remain unverified');
      assert(s.totals.missing === 0, 'XML-only import must not claim missing sources');
      await expectText('#option-inspector', 'Open the package folder to load images');
    });

    await run('Import an extracted package directory and resolve its real files and preview image', async () => {
      await page.locator('#folder-input').setInputFiles(sample);
      await expectText('#package-status', 'sample-package');
      const s = await snapshot();
      assert(s.totals.planned === 4 && s.totals.missing === 0, 'folder sources should resolve');
      assert(s.totals.unverified === 0, 'folder import should verify sources');
      await page.locator('.inspector-image').evaluate(img => img.decode());
      baselineRules = await rules(await page.locator('#xml-editor').inputValue());
    });

    await run('Change wizard options, reveal weathering, and inspect the overridden texture', async () => {
      await page.getByRole('radio', { name: '4K · Extra detail', exact: true }).check();
      await page.locator('#wizard-next').click();
      await page.getByRole('checkbox', { name: 'Weathered appearance', exact: true }).check();
      let s = await snapshot();
      assert(s.flags.quality === '4k' && s.steps[2].visible, 'flags and visibility should update');
      await page.locator('#wizard-next').click();
      await expectText('#wizard-heading', 'Weathering tone');
      await page.getByRole('radio', { name: 'Charcoal · Storm worn', exact: true }).check();
      await page.locator('#simulate').click();
      await expectText('#plan-console', '[OVERRIDDEN]');
      s = await snapshot();
      assert(s.totals.overridden === 1, 'base color should be overridden once');
      assert(s.operations.some(o => o.status === 'planned' && /Weathered[\\/]Charcoal\.dds/i.test(o.source)), 'charcoal texture must win');
    });

    await run('Simulated environment enables the Companion compatibility patch', async () => {
      await page.locator('[data-tab="environment"]').click();
      await page.getByLabel('CompanionMod.esp', { exact: true }).selectOption('Active');
      await page.locator('#apply-environment').click();
      await page.locator('[data-tab="preview"]').click();
      await page.locator('#step-list .step-button').filter({ hasText: 'Optional extras' }).click();
      const patch = page.getByRole('checkbox', { name: 'Companion compatibility patch', exact: true });
      assert(await patch.isEnabled(), 'patch should become selectable');
      await patch.check();
      const s = await snapshot();
      assert(s.operations.some(o => o.status === 'planned' && /Trailbound-Companion\.esp$/i.test(o.destination)), 'patch should be planned');
    });

    await run('Backtracking hides the conditional page and removes its files', async () => {
      await page.getByRole('checkbox', { name: 'Weathered appearance', exact: true }).uncheck();
      const s = await snapshot();
      assert(!s.steps[2].visible, 'third page should become hidden');
      assert(!s.operations.some(o => /Weathered/i.test(o.source)), 'hidden page should contribute no files');
    });

    await run('Visual editor updates name and description while retaining advanced rules', async () => {
      await page.locator('[data-tab="editor"]').click();
      await page.locator('[data-editor-mode="visual"]').click();
      await editField('Installer name', 'Trailbound • Edited Field Kit');
      await editField('Description', 'Edited in the visual workbench. Preview this description immediately.');
      await expectText('#project-name', 'Edited Field Kit');
      const s = await snapshot();
      assert(s.steps[0].groups[0].options[0].description === 'Edited in the visual workbench. Preview this description immediately.', 'option description should update');
      assert(JSON.stringify(await rules(await page.locator('#xml-editor').inputValue())) === JSON.stringify(baselineRules), 'flags, conditional types and page conditions must remain unchanged');
    });

    await run('Visual authoring adds a page, group, and option without losing original rules', async () => {
      await page.getByRole('button', { name: '+ Add page', exact: true }).click();
      await editField('Page name', 'Authoring smoke test');
      await page.getByRole('button', { name: '+ Add group', exact: true }).click();
      await editField('Group name', 'New choices');
      await page.getByLabel('Selection rule', { exact: true }).selectOption('SelectAny');
      await page.getByRole('button', { name: '+ Add option', exact: true }).click();
      await editField('Option name', 'A new optional choice');
      const s = await snapshot();
      assert(s.steps.length === 4 && s.steps[3].groups[0].options[0].name === 'A new optional choice', 'new hierarchy should be present');
      editedXML = await page.locator('#xml-editor').inputValue();
      assert(JSON.stringify(await rules(editedXML)) === JSON.stringify(baselineRules), 'advanced original rules must survive additions');
    });

    await run('Malformed XML cannot replace the last valid preview', async () => {
      const before = await snapshot();
      await page.locator('[data-editor-mode="xml"]').click();
      await page.locator('#xml-editor').fill('<config><moduleName>broken</config>');
      await page.locator('#apply-xml').click();
      await expectText('#toast', 'last working preview is preserved');
      const after = await snapshot();
      assert(after.name === before.name && after.steps.length === before.steps.length, 'valid preview must remain unchanged');
      assert(after.dirty, 'invalid draft should remain recoverable');
      await page.locator('#xml-editor').fill(editedXML);
      await page.locator('#apply-xml').click();
      assert(!(await snapshot()).dirty, 'correcting and applying XML clears dirty state');
    });

    await run('Export XML is parseable and contains the edited hierarchy and preserved rules', async () => {
      const pending = page.waitForEvent('download');
      await page.locator('#download-xml').click();
      const download = await pending;
      assert(download.suggestedFilename() === 'ModuleConfig.xml', 'download should use the standard file name');
      const xml = fs.readFileSync(await download.path(), 'utf8');
      const parsed = await page.evaluate(source => {
        const model = window.FomodEngine.parse(source);
        return { name: model.name, steps: model.steps.length, diagnostics: model.diagnostics };
      }, xml);
      assert(parsed.name === 'Trailbound • Edited Field Kit' && parsed.steps === 4, 'download must reflect current edits');
      assert(!parsed.diagnostics.some(i => /out of schema order/i.test(i.message)), 'exported visual edits must follow schema child ordering');
      assert(JSON.stringify(await rules(xml)) === JSON.stringify(baselineRules), 'advanced rules must survive export');
    });

    await run('Export JSON and console log contain a simulation plan', async () => {
      await page.locator('[data-tab="preview"]').click();
      await page.locator('#simulate').click();
      let pending = page.waitForEvent('download');
      await page.locator('#download-plan').click();
      const jsonDownload = await pending;
      const data = JSON.parse(fs.readFileSync(await jsonDownload.path(), 'utf8'));
      assert(data.simulationOnly === true && data.operations.length > 0, 'JSON export should include plan operations');
      pending = page.waitForEvent('download');
      await page.locator('#download-log').click();
      const log = fs.readFileSync(await (await pending).path(), 'utf8');
      assert(log.includes('No files are copied, moved, deleted, or installed.') && log.includes('[COPY]'), 'log must state dry-run behavior and list operations');
    });

    await run('New installer supports ordered root and option file mappings and image nodes', async () => {
      await page.locator('#new-installer').click();
      await expectText('#project-name', 'My new installer');
      assert(await page.locator('#panel-editor').isVisible(), 'New should open the visual editor');
      await page.locator('#visual-editor details.mapping-details summary').click();
      await page.locator('#visual-editor details.mapping-details').getByRole('button', { name: '+ Add file mapping', exact: true }).click();
      const optionSection = page.locator('#visual-editor .form-section').filter({ has: page.getByRole('heading', { name: 'Option details', exact: true }) });
      await optionSection.getByRole('button', { name: '+ Add file mapping', exact: true }).click();
      await editField('Header image path', 'fomod/images/header.png');
      await editField('Preview image path', 'fomod/images/choice.png');
      const xml = await page.locator('#xml-editor').inputValue();
      const parsed = await page.evaluate(source => {
        const model = window.FomodEngine.parse(source);
        const rootChildren = [...model.doc.documentElement.children].map(n => n.localName);
        const optionChildren = [...model.doc.querySelector('plugin').children].map(n => n.localName);
        return { rootChildren, optionChildren, errors: model.diagnostics.filter(i => i.level === 'error') };
      }, xml);
      assert(parsed.rootChildren.join(',') === 'moduleName,moduleImage,requiredInstallFiles,installSteps', 'root additions must be inserted in schema order');
      assert(parsed.optionChildren.join(',') === 'description,image,files,typeDescriptor', 'option additions must precede typeDescriptor');
      assert(parsed.errors.length === 0, 'new visual configuration must parse without schema errors: ' + JSON.stringify(parsed.errors));
      const pending = page.waitForEvent('download');
      await page.locator('#download-xml').click();
      const exported = fs.readFileSync(await (await pending).path(), 'utf8');
      assert(exported.includes('requiredInstallFiles') && exported.includes('fomod/images/choice.png'), 'export must include the new nodes');
    });

    await run('Valid and malformed local drafts both survive browser reload', async () => {
      const validXML = await page.locator('#xml-editor').inputValue();
      await page.reload();
      await expectText('#package-status', 'Recovered editor draft');
      assert((await snapshot()).name === 'My new installer', 'valid editor draft should be restored');
      assert(await page.locator('#xml-editor').inputValue() === validXML, 'valid draft text should remain exact');
      await page.locator('[data-tab="editor"]').click();
      await page.locator('[data-editor-mode="xml"]').click();
      const invalidXML = '<config><moduleName>Keep this unfinished draft';
      await page.locator('#xml-editor').fill(invalidXML);
      await page.reload();
      await expectText('#editor-status', 'Recovered draft needs XML syntax fixes');
      assert(await page.locator('#xml-editor').isVisible(), 'malformed recovered draft should open in XML mode');
      assert(await page.locator('#xml-editor').inputValue() === invalidXML, 'unfinished XML must not be lost');
      assert((await snapshot()).dirty, 'recovered malformed draft should remain dirty');
      await page.locator('#xml-editor').fill(validXML);
      await page.locator('#apply-xml').click();
      assert((await snapshot()).name === 'My new installer', 'recovered draft can be corrected and applied');
    });

    await run('Desktop and mobile layouts render without horizontal page overflow', async () => {
      await page.locator('#load-demo').click();
      await expectText('#project-name', 'Trailbound • Field Kit');
      await page.locator('.inspector-image').evaluate(img => img.decode());
      await page.waitForFunction(() => !document.getElementById('toast').textContent);
      fs.mkdirSync(outputs, { recursive: true });
      const desktop = path.join(outputs, 'fomod-desktop.png');
      preserveOutput(desktop);
      await page.screenshot({ path: desktop, fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile page should not overflow horizontally');
      const mobile = path.join(outputs, 'fomod-mobile.png');
      preserveOutput(mobile);
      await page.screenshot({ path: mobile, fullPage: true });
      console.log('Screenshots:', desktop, mobile);
    });

    await run('All flows leave source files unchanged and make no outbound network requests', async () => {
      assert(JSON.stringify(digestTree(sample)) === before, 'sample package files must remain byte-for-byte unchanged');
      assert(outbound.length === 0, 'app attempted outbound requests: ' + outbound.join(', '));
      assert(pageErrors.length === 0, 'browser errors: ' + pageErrors.join('; '));
    });
    console.log(`\n${results.filter(r => r.passed).length}/${results.length} UI integration tests passed.`);
    if (results.some(r => !r.passed)) process.exitCode = 1;
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
