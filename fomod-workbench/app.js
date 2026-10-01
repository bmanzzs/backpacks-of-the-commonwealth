/* FOMOD Workbench — local-only preview and authoring. No install or upload API. */
(() => {
  'use strict';
  const E = window.FomodEngine;
  const $ = id => document.getElementById(id);
  const state = {
    model: null, xml: '', selections: {}, environment: { files: {}, gameVersion: '' },
    inventory: null, fileMap: new Map(), images: {}, imageURLs: new Map(),
    evaluation: null, plan: null, step: 0, tab: 'preview', editorMode: 'visual',
    editStep: 0, editGroup: 0, editOption: 0, dirty: false, history: [],
    importIssues: [], project: 'Demo package', imageRequest: 0
  };
  const DRAFT_KEY = 'fomod-workbench.draft.v1';
  const STATUS = { planned: 'COPY', missing: 'MISSING', unverified: 'UNVERIFIED', overridden: 'OVERRIDDEN', conflict: 'CONFLICT', invalid: 'INVALID' };
  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'className') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else if (value !== undefined && value !== null) node.setAttribute(key, value);
    });
    children.flat().forEach(child => { if (child != null) node.append(child.nodeType ? child : document.createTextNode(String(child))); });
    return node;
  }
  function button(text, onClick, cls = 'button-secondary') { return el('button', { type: 'button', className: cls, text, onclick: onClick }); }
  let toastTimer;
  function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; toastTimer = setTimeout(() => { $('toast').textContent = ''; }, 8000); }
  function norm(path) { return E.normalizePath(path).toLowerCase(); }
  function children(node, tag) { return Array.from(node?.children || []).filter(n => n.localName === tag); }
  function child(node, tag) { return children(node, tag)[0]; }
  const XML_ORDER = {
    config: ['moduleName', 'moduleImage', 'moduleDependencies', 'requiredInstallFiles', 'installSteps', 'conditionalFileInstalls'],
    installStep: ['visible', 'optionalFileGroups'], group: ['plugins'],
    plugin: ['description', 'image', 'files', 'conditionFlags', 'typeDescriptor']
  };
  function ensure(node, tag) {
    const found = child(node, tag); if (found) return found;
    const created = state.model.doc.createElement(tag), order = XML_ORDER[node.localName] || [];
    const index = order.indexOf(tag);
    const before = index < 0 ? null : Array.from(node.children).find(n => order.indexOf(n.localName) > index);
    node.insertBefore(created, before || null);
    if (['installSteps', 'optionalFileGroups', 'plugins'].includes(tag)) created.setAttribute('order', 'Explicit');
    return created;
  }
  function issue(message, level = 'warning') { return { message, level }; }
  function persist() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ xml: $('xml-editor').value, saved: Date.now() })); }
    catch { /* Storage is optional, including file:// and private browsing. */ }
  }
  function forgetDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch {} }
  function releaseImages() {
    for (const url of state.imageURLs.values()) URL.revokeObjectURL(url);
    state.imageURLs.clear(); state.imageRequest++;
  }
  function checkDiscard() {
    return !(state.dirty || state.history.length) || confirm('Replace the current editor draft? Download the XML first if you want to keep it.');
  }
  function readXML(file) {
    return file.arrayBuffer().then(buffer => {
      const bytes = new Uint8Array(buffer), head = new TextDecoder('ascii').decode(bytes.slice(0, 160));
      let encoding = /encoding\s*=\s*["']([^"']+)/i.exec(head)?.[1] || 'utf-8';
      if (bytes[0] === 255 && bytes[1] === 254) encoding = 'utf-16le';
      else if (bytes[0] === 254 && bytes[1] === 255) encoding = 'utf-16be';
      else if (bytes[0] === 60 && bytes[1] === 0) encoding = 'utf-16le';
      else if (bytes[0] === 0 && bytes[1] === 60) encoding = 'utf-16be';
      return new TextDecoder(encoding, { fatal: true }).decode(buffer);
    });
  }
  function load(xml, options = {}) {
    const model = E.parse(xml); // Parse before replacing the user's current draft.
    releaseImages();
    Object.assign(state, { model, xml, selections: {}, inventory: options.inventory ?? null,
      fileMap: options.fileMap || new Map(), images: options.images || {}, project: options.project || 'XML only',
      importIssues: options.issues || [], step: 0, editStep: 0, editGroup: 0, editOption: 0,
      dirty: false, history: [], environment: { files: {}, gameVersion: '' } });
    $('xml-editor').value = xml;
    $('game-version').value = '';
    refresh(); renderEnvironment(); renderEditor(); setTab('preview');
  }
  function loadDemo(initial = false) {
    if (!initial && !checkDiscard()) return;
    load(window.FomodDemo.xml, { inventory: window.FomodDemo.files, images: window.FomodDemo.images, project: 'Built-in sample · virtual files' });
    forgetDraft();
    if (!initial) toast('Sample loaded. Try changing the options, then simulate the installation.');
  }
  function newInstaller() {
    if (!checkDiscard()) return;
    load('<?xml version="1.0" encoding="UTF-8"?>\n<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://qconsulting.ca/fo3/ModConfig5.0.xsd">\n  <moduleName>My new installer</moduleName>\n  <installSteps order="Explicit">\n    <installStep name="Choose your options">\n      <optionalFileGroups order="Explicit">\n        <group name="Optional files" type="SelectAny">\n          <plugins order="Explicit">\n            <plugin name="My first option">\n              <description>Describe what this option does.</description>\n              <typeDescriptor><type name="Optional" /></typeDescriptor>\n            </plugin>\n          </plugins>\n        </group>\n      </optionalFileGroups>\n    </installStep>\n  </installSteps>\n</config>', { project: 'New installer · XML only' });
    persist(); setTab('editor'); setEditorMode('visual');
    toast('New installer ready. Add file mappings, then download the XML into your package’s fomod folder.');
  }
  async function chooseConfiguration(candidates) {
    if (candidates.length === 1) return candidates[0];
    return new Promise(resolve => {
      const dialog = el('dialog', { className: 'config-dialog' });
      dialog.append(el('h2', { text: 'Choose an installer' }), el('p', { text: 'This folder contains more than one ModuleConfig.xml.' }));
      candidates.forEach(file => dialog.append(button(file.webkitRelativePath || file.name, () => { dialog.close(); dialog.remove(); resolve(file); })));
      dialog.append(button('Cancel', () => { dialog.close(); dialog.remove(); resolve(null); }, 'button-ghost'));
      dialog.addEventListener('cancel', () => { dialog.remove(); resolve(null); });
      document.body.append(dialog); dialog.showModal();
    });
  }
  async function importFolder(files) {
    if (!files.length || !checkDiscard()) return;
    const candidates = files.filter(f => /(^|[/\\])moduleconfig\.xml$/i.test(f.webkitRelativePath || f.name));
    if (!candidates.length) throw new Error('No ModuleConfig.xml found. Choose the extracted mod package containing the fomod folder. ZIP, 7z, and RAR files must be extracted first.');
    const config = await chooseConfiguration(candidates); if (!config) return;
    const path = config.webkitRelativePath.replace(/\\/g, '/');
    const match = /^(.*\/)?fomod\/moduleconfig\.xml$/i.exec(path);
    const prefix = match ? (match[1] || '') : path.slice(0, path.lastIndexOf('/') + 1);
    const inventory = [], fileMap = new Map(), issues = [];
    for (const f of files) {
      const p = f.webkitRelativePath.replace(/\\/g, '/');
      if (!p.startsWith(prefix)) continue;
      const relative = p.slice(prefix.length);
      try {
        const key = norm(relative);
        if (fileMap.has(key)) issues.push(issue('Case-insensitive duplicate path: ' + relative));
        fileMap.set(key, f); inventory.push({ path: relative, size: f.size });
      } catch { issues.push(issue('Skipped unsupported package path: ' + relative)); }
    }
    if (!match) issues.push(issue('ModuleConfig.xml is not inside a fomod folder. Source paths are being resolved from its containing folder. Choose the whole mod package for accurate file checks.'));
    const xml = await readXML(config);
    load(xml, { inventory, fileMap, issues, project: (prefix.replace(/\/$/, '').split('/').pop() || 'Local package') + ' · ' + inventory.length + ' files' });
    forgetDraft(); toast('Package opened locally. No files are uploaded or installed.');
  }
  function setTab(tab) {
    state.tab = tab;
    for (const panel of ['preview', 'editor', 'plan', 'environment']) {
      $('panel-' + panel).hidden = panel !== tab;
      const b = document.querySelector('[data-tab="' + panel + '"]');
      b.classList.toggle('active', panel === tab); b.setAttribute('aria-selected', String(panel === tab));
      b.tabIndex = panel === tab ? 0 : -1;
    }
    if (tab === 'editor') renderEditor();
    if (tab === 'environment') renderEnvironment();
    if (tab === 'plan') renderPlan();
  }
  function visibleSteps() { return state.evaluation.steps.filter(s => s.visible); }
  function refresh() {
    state.evaluation = E.evaluate(state.model, state.selections, state.environment);
    state.selections = state.evaluation.selections;
    state.plan = E.simulate(state.model, state.evaluation, state.inventory);
    state.step = Math.max(0, Math.min(state.step, visibleSteps().length - 1));
    $('project-name').textContent = state.model.name || 'Untitled installer';
    $('package-status').textContent = state.project;
    renderSteps(); renderWizard(); renderDiagnostics(); renderPlan();
    $('editor-status').textContent = state.dirty ? 'Unapplied XML changes' : 'Preview is up to date';
    $('editor-status').classList.toggle('dirty', state.dirty);
  }
  function renderSteps() {
    const visible = visibleSteps();
    $('step-list').replaceChildren(...state.evaluation.steps.map(s => {
      const index = visible.indexOf(s);
      const b = button('', () => { state.step = index; setTab('preview'); renderSteps(); renderWizard(); }, 'step-button' + (!s.visible ? ' hidden-step' : index === state.step ? ' active' : ''));
      b.disabled = !s.visible;
      b.append(el('span', { className: 'step-index', text: s.visible ? String(index + 1).padStart(2, '0') : '—' }),
        el('span', { className: 'step-copy' }, el('span', { text: s.name }), el('span', { className: 'step-meta', text: s.visible ? s.groups.length + ' option group' + (s.groups.length === 1 ? '' : 's') : 'Hidden by conditions' })));
      return b;
    }));
    if (!state.evaluation.steps.length) $('step-list').append(el('p', { className: 'muted', text: 'This installer has no wizard pages.' }));
  }
  const GROUP_LABELS = { SelectExactlyOne: 'Choose one', SelectAtMostOne: 'Choose up to one', SelectAtLeastOne: 'Choose one or more', SelectAll: 'All options required', SelectAny: 'Choose any' };
  function renderWizard() {
    const steps = visibleSteps(), step = steps[state.step];
    $('wizard-heading').textContent = step?.name || 'Ready to simulate';
    $('wizard-subtitle').textContent = step ? 'Explore the choices exactly as defined by this installer.' : 'Required and conditional files will appear in the file plan.';
    $('step-counter').textContent = step ? 'STEP ' + (state.step + 1) + ' / ' + steps.length : 'NO VISIBLE STEPS';
    $('wizard-back').disabled = state.step === 0;
    $('wizard-next').textContent = state.step === steps.length - 1 || !step ? 'Review file plan →' : 'Next step →';
    const groups = (step?.groups || []).map(g => {
      const group = el('fieldset', { className: 'group' }, el('legend', { className: 'group-header' }, el('span', { text: g.name }), el('span', { className: 'badge', text: GROUP_LABELS[g.type] || g.type })));
      g.options.forEach(o => {
        const input = el('input', { type: ['SelectExactlyOne', 'SelectAtMostOne'].includes(g.type) ? 'radio' : 'checkbox', name: g.id, value: o.id, 'aria-label': o.name });
        input.checked = o.selected;
        input.disabled = o.locked || o.type === 'NotUsable' || (['SelectExactlyOne', 'SelectAtMostOne'].includes(g.type) && g.options.some(p => p.id !== o.id && p.type === 'Required'));
        input.addEventListener('change', () => {
          if (['SelectExactlyOne', 'SelectAtMostOne'].includes(g.type)) g.options.forEach(p => { state.selections[p.id] = p.locked ? p.selected : false; });
          state.selections[o.id] = input.checked; refresh();
          document.querySelector('input[value="' + o.id + '"]')?.focus();
        });
        const title = el('span', { className: 'option-heading', text: o.name });
        if (o.type !== 'Optional') title.append(el('span', { className: 'badge', text: o.type === 'NotUsable' ? 'Unavailable' : o.type === 'CouldBeUsable' ? 'Check compatibility' : o.type }));
        const body = el('span', { className: 'option-copy' }, title, el('span', { className: 'option-description', text: o.description || 'No description supplied.' }));
        const card = el('label', { className: 'option-card' + (o.selected ? ' selected' : '') + (input.disabled ? ' disabled' : ''), onmouseenter: () => inspectOption(o), onfocusin: () => inspectOption(o) }, input, body);
        group.append(card);
      });
      if (g.type === 'SelectAtMostOne') {
        const clear = button('Clear selection', () => { g.options.filter(o => !o.locked).forEach(o => { state.selections[o.id] = false; }); refresh(); }, 'button-ghost');
        clear.disabled = g.options.some(o => o.locked && o.selected); group.append(clear);
      }
      return group;
    });
    $('wizard-groups').replaceChildren(...groups);
    if (!groups.length) $('wizard-groups').append(el('div', { className: 'empty-state', text: 'No choices on this page. Review the file plan to see the simulated result.' }));
    const option = step?.groups.flatMap(g => g.options).find(o => o.selected) || step?.groups[0]?.options[0];
    inspectOption(option);
  }
  async function inspectOption(option) {
    const request = ++state.imageRequest, box = $('option-inspector');
    const imagePath = option?.image || (state.model.showImage ? state.model.image : '');
    const picture = el('div', { className: 'inspector-placeholder' }, el('span', { className: 'inspector-symbol', text: '◇' }), el('span', { text: imagePath ? 'Loading preview…' : 'No preview image' }));
    const content = el('div', { className: 'inspector-content' }, el('span', { className: 'eyebrow', text: 'OPTION PREVIEW' }), el('h3', { className: 'inspector-title', text: option?.name || state.model.name }), el('p', { text: option?.description || 'Choose an option to inspect its description and package image.' }));
    if (imagePath) content.append(el('p', { className: 'muted mono inspector-path', text: typeof imagePath === 'string' ? imagePath : imagePath.path || '' }));
    if (option?.files?.length) content.append(el('span', { className: 'badge', text: option.files.length + ' file mapping' + (option.files.length === 1 ? '' : 's') }));
    box.replaceChildren(picture, content);
    if (!imagePath) return;
    try {
      const key = norm(typeof imagePath === 'string' ? imagePath : imagePath.path || '');
      let url = state.images[key];
      if (!url && state.fileMap.has(key)) {
        if (!state.imageURLs.has(key)) state.imageURLs.set(key, URL.createObjectURL(state.fileMap.get(key)));
        url = state.imageURLs.get(key);
      }
      if (request !== state.imageRequest) return;
      if (!url) { picture.replaceChildren(el('span', { className: 'inspector-symbol', text: '◇' }), el('span', { text: state.inventory ? 'Image missing from package' : 'Open the package folder to load images' })); return; }
      const img = el('img', { className: 'inspector-image', src: url, alt: option?.name || state.model.name });
      img.addEventListener('error', () => { if (request === state.imageRequest) picture.replaceChildren(el('span', { text: 'This image could not be displayed.' })); });
      picture.replaceChildren(img);
    } catch { picture.replaceChildren(el('span', { text: 'Invalid image path' })); }
  }
  function allIssues() {
    const seen = new Set();
    return [...state.importIssues, ...(state.plan?.issues || state.evaluation?.issues || [])].filter(i => {
      const key = i.level + ':' + i.message; if (seen.has(key)) return false; seen.add(key); return true;
    });
  }
  function renderDiagnostics() {
    const issues = allIssues(), root = $('diagnostics');
    root.replaceChildren(); root.hidden = !issues.length;
    if (!issues.length) return;
    const errors = issues.filter(i => i.level === 'error').length;
    const details = el('details', {}, el('summary', { text: errors ? errors + ' issue' + (errors === 1 ? '' : 's') + ' need attention · ' + issues.length + ' total notes' : issues.length + ' preview note' + (issues.length === 1 ? '' : 's') }));
    issues.slice(0, 100).forEach(i => details.append(el('div', { className: 'issue ' + i.level, text: i.message })));
    if (issues.length > 100) details.append(el('p', { text: 'Additional notes are included in the exported log.' }));
    root.append(details);
  }
  function planText() {
    const ops = state.plan?.operations || [], issues = allIssues();
    const lines = ['FOMOD Workbench · simulation only', state.model.name, '', 'No files are copied, moved, deleted, or installed.', 'Destinations are relative to the game Data folder (or mod staging root).', 'Environment: simulated; unlisted dependencies are Missing.', 'Package: ' + state.project, ''];
    Object.entries(state.environment.files).forEach(([file, status]) => lines.push('[ENV] ' + file + ' = ' + status));
    if (state.environment.gameVersion) lines.push('[ENV] Game version = ' + state.environment.gameVersion);
    issues.forEach(i => lines.push('[' + i.level.toUpperCase() + '] ' + i.message));
    lines.push('');
    ops.forEach(o => lines.push('[' + (STATUS[o.status] || o.status.toUpperCase()) + '] ' + o.source + ' → ' + o.destination + '  | ' + o.reason + ' (priority ' + o.priority + ')'));
    (state.plan?.skipped || []).forEach(o => lines.push('[SKIPPED] ' + o.source + ' | ' + o.reason));
    lines.push('', issues.some(i => i.level === 'error') ? 'Simulation needs attention. Resolve errors before treating this plan as valid.' : 'Simulation complete. Review any warnings before testing in a mod manager.');
    return lines.join('\n');
  }
  function renderPlan() {
    if (!state.plan) return;
    const ops = state.plan.operations;
    const planned = ops.filter(o => o.status === 'planned').length;
    const needs = ops.filter(o => ['missing', 'invalid', 'conflict'].includes(o.status)).length;
    const skipped = (state.plan.skipped || []).length;
    const stats = [['Planned copies', planned], ['Overridden', ops.filter(o => o.status === 'overridden').length], ['Need attention', needs], ['Skipped mappings', skipped]];
    $('plan-summary').replaceChildren(...stats.map(([label, value]) => el('div', { className: 'stat' }, el('span', { className: 'stat-value', text: String(value).padStart(2, '0') }), el('span', { className: 'stat-label', text: label }))));
    const search = $('plan-search').value.toLowerCase(), filter = $('plan-filter').value;
    const match = ops.filter(o => (filter === 'all' || o.status === (filter === 'copy' ? 'planned' : filter)) && (!search || [o.source, o.destination, o.reason].join(' ').toLowerCase().includes(search)));
    $('plan-table').replaceChildren(...match.slice(0, 300).map(o => el('tr', {}, el('td', {}, el('span', { className: 'badge status-' + (o.status === 'planned' ? 'copy' : o.status), text: STATUS[o.status] || o.status })), el('td', { className: 'mono path-cell', text: o.source }), el('td', { className: 'mono path-cell', text: o.destination }), el('td', { text: o.reason }))));
    if (!match.length) $('plan-table').append(el('tr', {}, el('td', { colspan: 4, className: 'empty-state', text: ops.length ? 'No mappings match this filter.' : 'No files are selected for this simulation.' })));
    if (match.length > 300) $('plan-table').append(el('tr', {}, el('td', { colspan: 4, className: 'muted', text: 'Showing the first 300 of ' + match.length + ' results. Export the full plan to see all entries.' })));
    $('plan-console').textContent = planText().split('\n').slice(0, 1000).join('\n') + (ops.length > 980 ? '\n… Export the log for the complete result.' : '');
  }
  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = el('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast('Downloaded ' + name + '. Original package files are unchanged.');
  }
  function renderEnvironment() {
    const names = new Map();
    (state.model.fileDependencies || []).forEach(p => { const path = typeof p === 'string' ? p : p.file; if (path) { try { names.set(norm(path), path); } catch {} } });
    Object.keys(state.environment.files).forEach(p => { if (!names.has(p)) names.set(p, p); });
    const rows = [...names].map(([key, name]) => {
      const select = el('select', { 'aria-label': name, 'data-environment-file': key }, ...['Missing', 'Inactive', 'Active'].map(value => el('option', { value, text: value })));
      select.value = state.environment.files[key] || 'Missing';
      return el('label', { className: 'environment-row field-row' }, el('span', { className: 'mono', text: name }), select);
    });
    if (!rows.length) rows.push(el('p', { className: 'muted', text: 'This installer has no file dependencies. Add a mock file below if you are authoring a new condition.' }));
    const input = el('input', { type: 'text', placeholder: 'ExampleMod.esp', 'aria-label': 'New simulated file' });
    const add = button('Add file', () => {
      try { const key = norm(input.value.trim()); if (!key) throw new Error('Enter a relative plugin or file path.'); state.environment.files[key] = 'Missing'; renderEnvironment(); }
      catch (e) { toast(e.message); }
    });
    rows.push(el('div', { className: 'field-row environment-add' }, input, add));
    $('environment-files').replaceChildren(...rows);
    $('game-version').value = state.environment.gameVersion;
  }
  function applyEnvironment() {
    document.querySelectorAll('[data-environment-file]').forEach(select => { state.environment.files[select.dataset.environmentFile] = select.value; });
    state.environment.gameVersion = $('game-version').value.trim();
    refresh(); toast('Simulated environment updated. Dependent pages and choices have been recalculated.');
  }
  function parseAndApply(xml, recordHistory = true) {
    const model = E.parse(xml);
    if (recordHistory) { state.history.push(state.xml); if (state.history.length > 30) state.history.shift(); }
    state.xml = xml; state.model = model; state.selections = {}; state.dirty = false;
    $('xml-editor').value = xml; persist(); refresh(); renderEnvironment(); renderEditor();
  }
  function edit(mutator) {
    if (state.dirty) { toast('Apply the XML draft before using the visual editor.'); return; }
    const previous = state.xml;
    try { mutator(state.model.doc); parseAndApply(E.serialize(state.model.doc)); }
    catch (error) { state.model = E.parse(previous); toast(error.message); }
  }
  function setText(node, tag, value) { ensure(node, tag).textContent = value; }
  function field(label, value, onChange, options = {}) {
    const control = options.multiline ? el('textarea', { rows: options.rows || 3 }) : options.values ? el('select', {}, ...options.values.map(v => el('option', { value: v, text: v }))) : el('input', { type: options.type || 'text' });
    control.value = value ?? ''; control.setAttribute('aria-label', label);
    if (options.placeholder) control.placeholder = options.placeholder;
    control.addEventListener('change', () => onChange(control.value));
    return el('label', { className: 'field' }, el('span', { className: 'field-label', text: label }), control, options.help ? el('span', { className: 'muted field-help', text: options.help }) : null);
  }
  function addOption(group) {
    edit(doc => {
      const plugins = ensure(group.node, 'plugins');
      const node = doc.createElement('plugin'); node.setAttribute('name', 'New option');
      node.append(doc.createElement('description'), doc.createElement('files'));
      const desc = doc.createElement('typeDescriptor'), type = doc.createElement('type'); type.setAttribute('name', 'Optional'); desc.append(type); node.append(desc); plugins.append(node);
      state.editOption = group.options.length;
    });
  }
  function renderMappings(container, owner, parentTag, title) {
    const list = child(owner, parentTag);
    const mappings = Array.from(list?.children || []).filter(n => ['file', 'folder'].includes(n.localName));
    container.append(el('h4', { text: title }));
    mappings.forEach((mapping, index) => {
      const row = el('div', { className: 'mapping-row' },
        field('Kind', mapping.localName, value => edit(doc => { const replacement = doc.createElement(value); Array.from(mapping.attributes).forEach(a => replacement.setAttribute(a.name, a.value)); mapping.replaceWith(replacement); }), { values: ['file', 'folder'] }),
        field('Source ' + (index + 1), mapping.getAttribute('source'), value => edit(() => mapping.setAttribute('source', value)), { placeholder: 'Options\\2K\\textures' }),
        field('Destination ' + (index + 1), mapping.getAttribute('destination'), value => edit(() => mapping.setAttribute('destination', value)), { placeholder: 'textures' }),
        field('Priority ' + (index + 1), mapping.getAttribute('priority') || '0', value => edit(() => mapping.setAttribute('priority', value)), { type: 'number' }),
        button('Remove', () => edit(() => mapping.remove()), 'button-ghost'));
      if (mapping.getAttribute('alwaysInstall') === 'true' || mapping.getAttribute('installIfUsable') === 'true') row.append(el('p', { className: 'muted', text: 'Advanced install flags are preserved. Edit them in XML.' }));
      container.append(row);
    });
    if (!mappings.length) container.append(el('p', { className: 'muted', text: 'No file mappings yet.' }));
    container.append(button('+ Add file mapping', () => edit(doc => {
      const n = doc.createElement('file'); n.setAttribute('source', 'path\\to\\file.ext'); n.setAttribute('destination', 'file.ext'); n.setAttribute('priority', '0'); ensure(owner, parentTag).append(n);
    }), 'button-ghost'));
  }
  function renderVisualEditor() {
    const root = $('visual-editor'); root.replaceChildren();
    if (state.dirty) {
      root.append(el('div', { className: 'issue warning', text: 'There are unapplied XML changes. Apply the draft in the XML editor to continue visual editing.' }), button('Go to XML draft', () => setEditorMode('xml'))); return;
    }
    const module = state.model.doc.documentElement;
    const moduleSection = el('section', { className: 'form-section' }, el('h3', { text: 'Installer details' }), el('div', { className: 'field-row' },
      field('Installer name', state.model.name, value => edit(() => setText(module, 'moduleName', value))),
      field('Header image path', typeof state.model.image === 'string' ? state.model.image : state.model.image?.path || '', value => edit(() => { if (!value) child(module, 'moduleImage')?.remove(); else { const n = ensure(module, 'moduleImage'); n.setAttribute('path', value); const name = child(module, 'moduleName'); name?.after(n); } }), { placeholder: 'fomod\\images\\header.png' })));
    const requiredDetails = el('details', { className: 'mapping-details' }, el('summary', { text: 'Required file mappings' }));
    renderMappings(requiredDetails, module, 'requiredInstallFiles', 'Always included'); moduleSection.append(requiredDetails); root.append(moduleSection);
    const toolbar = el('div', { className: 'toolbar editor-toolbar' }, el('h3', { text: 'Wizard pages' }), button('+ Add page', () => edit(doc => {
      const steps = ensure(module, 'installSteps');
      const step = doc.createElement('installStep'); step.setAttribute('name', 'New page'); const groups = doc.createElement('optionalFileGroups'); groups.setAttribute('order', 'Explicit'); step.append(groups); steps.append(step); state.editStep = state.model.steps.length; state.editGroup = 0; state.editOption = 0;
    })), button('Undo edit', () => { const xml = state.history.pop(); if (xml) parseAndApply(xml, false); }, 'button-ghost'));
    toolbar.lastChild.disabled = !state.history.length; root.append(toolbar);
    if (!state.model.steps.length) { root.append(el('p', { className: 'empty-state', text: 'Add your first wizard page, then add a group and its options.' })); return; }
    state.editStep = Math.min(state.editStep, state.model.steps.length - 1);
    const step = state.model.steps[state.editStep];
    const pageSelect = el('select', { 'aria-label': 'Page to edit' }, ...state.model.steps.map((s, i) => el('option', { value: i, text: (i + 1) + '. ' + s.name })));
    pageSelect.value = String(state.editStep); pageSelect.addEventListener('change', () => { state.editStep = Number(pageSelect.value); state.editGroup = 0; state.editOption = 0; renderVisualEditor(); });
    const page = el('section', { className: 'form-section visual-step' }, pageSelect, field('Page name', step.name, value => edit(() => step.node.setAttribute('name', value))));
    const pageActions = el('div', { className: 'toolbar' }, button('+ Add group', () => edit(doc => {
      const groups = ensure(step.node, 'optionalFileGroups'); const n = doc.createElement('group'); n.setAttribute('name', 'New group'); n.setAttribute('type', 'SelectExactlyOne'); const plugins = doc.createElement('plugins'); plugins.setAttribute('order', 'Explicit'); n.append(plugins); groups.append(n); state.editGroup = step.groups.length; state.editOption = 0;
    })), button('Remove page', () => { if (confirm('Remove this page and its options? You can undo this edit.')) edit(() => { step.node.remove(); state.editStep = Math.max(0, state.editStep - 1); }); }, 'button-ghost'));
    if (child(step.node, 'visible')) page.append(el('p', { className: 'muted', text: 'This page has visibility conditions. They are preserved; use the XML editor to change them.' }));
    page.append(pageActions); root.append(page);
    if (!step.groups.length) return;
    state.editGroup = Math.min(state.editGroup, step.groups.length - 1); const group = step.groups[state.editGroup];
    const groupSelect = el('select', { 'aria-label': 'Group to edit' }, ...step.groups.map((g, i) => el('option', { value: i, text: g.name })));
    groupSelect.value = String(state.editGroup); groupSelect.addEventListener('change', () => { state.editGroup = Number(groupSelect.value); state.editOption = 0; renderVisualEditor(); });
    const groupSection = el('section', { className: 'form-section' }, el('h3', { text: 'Option group' }), groupSelect,
      el('div', { className: 'field-row' }, field('Group name', group.name, value => edit(() => group.node.setAttribute('name', value))), field('Selection rule', group.type, value => edit(() => group.node.setAttribute('type', value)), { values: Object.keys(GROUP_LABELS) })),
      el('div', { className: 'toolbar' }, button('+ Add option', () => addOption(group)), button('Remove group', () => { if (confirm('Remove this group and its options? You can undo this edit.')) edit(() => { group.node.remove(); state.editGroup = Math.max(0, state.editGroup - 1); }); }, 'button-ghost')));
    root.append(groupSection);
    if (!group.options.length) return;
    state.editOption = Math.min(state.editOption, group.options.length - 1); const option = group.options[state.editOption];
    const optionSelect = el('select', { 'aria-label': 'Option to edit' }, ...group.options.map((o, i) => el('option', { value: i, text: o.name })));
    optionSelect.value = String(state.editOption); optionSelect.addEventListener('change', () => { state.editOption = Number(optionSelect.value); renderVisualEditor(); });
    const section = el('section', { className: 'form-section' }, el('h3', { text: 'Option details' }), optionSelect,
      field('Option name', option.name, value => edit(() => option.node.setAttribute('name', value))),
      field('Description', option.description, value => edit(() => setText(option.node, 'description', value)), { multiline: true }),
      field('Preview image path', option.image, value => edit(() => { if (!value) child(option.node, 'image')?.remove(); else { const n = ensure(option.node, 'image'); n.setAttribute('path', value); child(option.node, 'description')?.after(n); } }), { placeholder: 'fomod\\images\\option.png' }));
    const descriptor = child(option.node, 'typeDescriptor');
    if (child(descriptor, 'dependencyType')) section.append(el('p', { className: 'issue info', text: 'This option uses a conditional type. Its rules are preserved and can be edited in XML.' }));
    else section.append(field('Option type', child(descriptor, 'type')?.getAttribute('name') || 'Optional', value => edit(() => { ensure(ensure(option.node, 'typeDescriptor'), 'type').setAttribute('name', value); }), { values: ['Optional', 'Recommended', 'Required', 'NotUsable', 'CouldBeUsable'] }));
    renderMappings(section, option.node, 'files', 'Files for this option');
    section.append(button('Remove option', () => { if (confirm('Remove this option? You can undo this edit.')) edit(() => { option.node.remove(); state.editOption = Math.max(0, state.editOption - 1); }); }, 'button-ghost'));
    root.append(section);
  }
  function setEditorMode(mode) { state.editorMode = mode; renderEditor(); }
  function renderEditor() {
    const xmlMode = state.editorMode === 'xml';
    $('visual-editor').hidden = xmlMode;
    $('xml-editor').hidden = !xmlMode;
    $('apply-xml').hidden = !xmlMode;
    document.querySelectorAll('[data-editor-mode]').forEach(b => { b.classList.toggle('active', b.dataset.editorMode === state.editorMode); b.setAttribute('aria-pressed', String(b.dataset.editorMode === state.editorMode)); });
    $('editor-help').textContent = xmlMode ? 'Edit the complete configuration. Apply to refresh the preview; Ctrl+Enter also applies. Ctrl+S downloads your XML.' : 'Changes refresh the preview and reset its choices. Advanced rules are preserved. Download XML to save a new copy.';
    if (!xmlMode) renderVisualEditor();
  }
  function applyXML() {
    try { parseAndApply($('xml-editor').value); toast('XML applied. Preview choices have been reset.'); }
    catch (error) { $('editor-status').textContent = error.message; $('editor-status').classList.add('dirty'); toast('XML could not be applied. The last working preview is preserved.'); }
  }
  function downloadXML() {
    try {
      E.parse($('xml-editor').value);
      const xml = $('xml-editor').value.replace(/(<\?xml[^?]*encoding\s*=\s*["'])[^"']+(["'])/i, '$1UTF-8$2');
      download('ModuleConfig.xml', xml, 'application/xml;charset=utf-8');
    } catch (error) { $('editor-status').textContent = error.message; setTab('editor'); setEditorMode('xml'); toast('Fix the XML syntax before downloading.'); }
  }
  function safeAsync(fn) { return async event => { try { await fn(event); } catch (error) { toast(error.message); } }; }
  $('open-folder').addEventListener('click', () => $('folder-input').click());
  $('open-xml').addEventListener('click', () => $('xml-input').click());
  $('load-demo').addEventListener('click', () => loadDemo());
  $('new-installer')?.addEventListener('click', newInstaller);
  $('folder-input').addEventListener('change', safeAsync(async event => { try { await importFolder(Array.from(event.target.files)); } finally { event.target.value = ''; } }));
  $('xml-input').addEventListener('change', safeAsync(async event => {
    try { const file = event.target.files[0]; if (file && checkDiscard()) { load(await readXML(file), { project: file.name + ' · XML only' }); forgetDraft(); toast('XML loaded. Open the package folder to verify source files and load images.'); } }
    finally { event.target.value = ''; }
  }));
  document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('workspace-tabs').addEventListener('keydown', event => {
    const tabs = Array.from(document.querySelectorAll('[data-tab]'));
    const index = tabs.indexOf(event.target); if (index < 0) return;
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault(); setTab(tabs[next].dataset.tab); tabs[next].focus();
  });
  document.querySelectorAll('[data-editor-mode]').forEach(b => b.addEventListener('click', () => setEditorMode(b.dataset.editorMode)));
  $('wizard-back').addEventListener('click', () => { state.step--; renderSteps(); renderWizard(); });
  $('wizard-next').addEventListener('click', () => {
    const step = visibleSteps()[state.step];
    const errors = (state.evaluation.issues || []).filter(i => i.level === 'error' && i.stepId === step?.id);
    if (errors.length) { toast(errors[0].message); $('diagnostics').querySelector('details')?.setAttribute('open', ''); return; }
    if (state.step < visibleSteps().length - 1) { state.step++; renderSteps(); renderWizard(); } else setTab('plan');
  });
  $('simulate').addEventListener('click', () => { refresh(); setTab('plan'); toast(allIssues().some(i => i.level === 'error') ? 'Simulation needs attention. Review the issues above the plan.' : 'Simulation complete. No files were installed.'); });
  $('plan-search').addEventListener('input', renderPlan); $('plan-filter').addEventListener('change', renderPlan);
  $('download-log').addEventListener('click', () => download('fomod-simulation.log', planText(), 'text/plain;charset=utf-8'));
  $('download-plan').addEventListener('click', () => download('fomod-file-plan.json', JSON.stringify({ tool: 'FOMOD Workbench 0.1.0', simulationOnly: true, module: state.model.name, source: state.project, environment: state.environment, flags: state.evaluation.flags, operations: state.plan.operations, skipped: state.plan.skipped, issues: allIssues(), totals: state.plan.totals }, null, 2), 'application/json'));
  $('apply-environment').addEventListener('click', applyEnvironment);
  $('xml-editor').addEventListener('input', () => { state.dirty = $('xml-editor').value !== state.xml; $('editor-status').textContent = state.dirty ? 'Unapplied XML changes · draft saved locally when available' : 'Preview is up to date'; $('editor-status').classList.toggle('dirty', state.dirty); persist(); });
  $('xml-editor').addEventListener('keydown', event => {
    if (event.key === 'Tab') { event.preventDefault(); const t = event.target; t.setRangeText('  ', t.selectionStart, t.selectionEnd, 'end'); t.dispatchEvent(new Event('input')); }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); applyXML(); }
  });
  $('apply-xml').addEventListener('click', applyXML); $('download-xml').addEventListener('click', downloadXML);
  document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); downloadXML(); } });
  window.addEventListener('beforeunload', event => { if (state.dirty || state.history.length) { event.preventDefault(); event.returnValue = ''; } });
  // Exposed read-only snapshot for diagnostics and regression tests, never filesystem access.
  window.FomodWorkbench = { snapshot: () => ({ name: state.model.name, evaluation: state.evaluation, plan: state.plan, dirty: state.dirty, source: state.project }) };
  let draft;
  try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch {}
  try {
    if (draft?.xml) {
      try { load(draft.xml, { project: 'Recovered editor draft · XML only' }); toast('Recovered your local XML draft. Reopen the package folder for file checks and images.'); }
      catch { loadDemo(true); $('xml-editor').value = draft.xml; state.dirty = true; persist(); setTab('editor'); setEditorMode('xml'); $('editor-status').textContent = 'Recovered draft needs XML syntax fixes'; }
    } else loadDemo(true);
  } catch (error) { toast('Could not start the workbench: ' + error.message); }
})();
