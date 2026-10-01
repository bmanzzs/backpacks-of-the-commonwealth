/* FOMOD Workbench — offline XML interpreter and dry-run planner.
 * No filesystem writes, network requests, or script evaluation are performed here.
 * The retained DOM is the source of truth for lossless editor round-trips.
 */
(function (global) {
  'use strict';

  const GROUP_TYPES = ['SelectAny', 'SelectAll', 'SelectExactlyOne', 'SelectAtMostOne', 'SelectAtLeastOne'];
  const OPTION_TYPES = ['Required', 'Optional', 'Recommended', 'NotUsable', 'CouldBeUsable'];
  const ORDERS = ['Ascending', 'Descending', 'Explicit'];
  const FILE_STATES = ['Missing', 'Inactive', 'Active'];
  const nameOf = node => node && (node.localName || node.nodeName);
  const children = (node, tag) => node ? Array.from(node.children || []).filter(item => !tag || nameOf(item) === tag) : [];
  const child = (node, tag) => children(node, tag)[0] || null;
  const attr = (node, key, fallback = '') => node && node.hasAttribute(key) ? node.getAttribute(key) : fallback;
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  function normalizePath(value) {
    const path = String(value == null ? '' : value).replace(/\//g, '\\');
    if (/^[\\]/.test(path) || /[:\x00-\x1f<>"|?*]/.test(path)) {
      throw new Error('Path must be relative and cannot contain drive letters, alternate streams, wildcards, or reserved characters: ' + value);
    }
    const parts = path.split('\\').filter(part => part !== '' && part !== '.');
    if (parts.some(part => part === '..' || /[. ]$/.test(part) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part))) {
      throw new Error('Path contains traversal or an unsafe Windows filename: ' + value);
    }
    return parts.join('\\');
  }

  function addIssue(list, level, message, extra) {
    if (!list.some(item => item.level === level && item.message === message && item.stepId === (extra && extra.stepId))) {
      list.push(Object.assign({ level, message }, extra || {}));
    }
  }

  function parse(xml) {
    if (typeof xml !== 'string' || !xml.trim()) throw new Error('ModuleConfig.xml is empty.');
    if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('DOCTYPE and ENTITY declarations are not supported. Use plain FOMOD XML.');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const parserError = doc.getElementsByTagName('parsererror')[0];
    if (parserError || nameOf(doc.documentElement) === 'parsererror') {
      throw new Error('Invalid XML: ' + (parserError || doc.documentElement).textContent.trim().slice(0, 700));
    }
    const root = doc.documentElement;
    if (nameOf(root) !== 'config') throw new Error('Expected a <config> root. Open fomod/ModuleConfig.xml, not info.xml.');
    const diagnostics = [];
    const fileDependencies = new Map();
    let sequence = 0;
    const report = (level, message) => addIssue(diagnostics, level, message);

    const allowedChildren = {
      config: ['moduleName', 'moduleImage', 'moduleDependencies', 'requiredInstallFiles', 'installSteps', 'conditionalFileInstalls'],
      moduleName: [], moduleImage: [],
      moduleDependencies: ['dependencies', 'fileDependency', 'flagDependency', 'gameDependency', 'fommDependency', 'foseDependency'],
      dependencies: ['dependencies', 'fileDependency', 'flagDependency', 'gameDependency', 'fommDependency', 'foseDependency'],
      visible: ['dependencies', 'fileDependency', 'flagDependency', 'gameDependency', 'fommDependency', 'foseDependency'],
      fileDependency: [], flagDependency: [], gameDependency: [], fommDependency: [], foseDependency: [],
      requiredInstallFiles: ['file', 'folder'], files: ['file', 'folder'], file: [], folder: [],
      installSteps: ['installStep'], installStep: ['visible', 'optionalFileGroups'],
      optionalFileGroups: ['group'], group: ['plugins'], plugins: ['plugin'],
      plugin: ['description', 'image', 'files', 'conditionFlags', 'typeDescriptor'],
      description: [], image: [], conditionFlags: ['flag'], flag: [],
      typeDescriptor: ['type', 'dependencyType'], type: [], defaultType: [],
      dependencyType: ['defaultType', 'patterns'], patterns: ['pattern'],
      pattern: ['dependencies', 'files', 'type'], conditionalFileInstalls: ['patterns']
    };
    const allowedAttrs = {
      config: [], moduleName: ['colour', 'position'], moduleImage: ['path', 'showImage', 'showFade', 'height'],
      moduleDependencies: ['operator'], dependencies: ['operator'], visible: ['operator'],
      fileDependency: ['file', 'state'], flagDependency: ['flag', 'value'],
      gameDependency: ['version'], fommDependency: ['version'], foseDependency: ['version'],
      requiredInstallFiles: [], files: [], file: ['source', 'destination', 'alwaysInstall', 'installIfUsable', 'priority'],
      folder: ['source', 'destination', 'alwaysInstall', 'installIfUsable', 'priority'],
      installSteps: ['order'], installStep: ['name'], optionalFileGroups: ['order'], group: ['name', 'type'],
      plugins: ['order'], plugin: ['name'], description: [], image: ['path'], conditionFlags: [], flag: ['name'],
      typeDescriptor: [], type: ['name'], defaultType: ['name'], dependencyType: [], patterns: [], pattern: [], conditionalFileInstalls: []
    };
    const repeatable = {
      requiredInstallFiles: ['file', 'folder'], files: ['file', 'folder'],
      installSteps: ['installStep'], optionalFileGroups: ['group'], plugins: ['plugin'], conditionFlags: ['flag'], patterns: ['pattern'],
      moduleDependencies: allowedChildren.moduleDependencies, dependencies: allowedChildren.dependencies, visible: allowedChildren.visible
    };
    const sequenceOrder = {
      config: ['moduleName', 'moduleImage', 'moduleDependencies', 'requiredInstallFiles', 'installSteps', 'conditionalFileInstalls'],
      installStep: ['visible', 'optionalFileGroups'], dependencyType: ['defaultType', 'patterns'],
      plugin: ['description', 'image', ['files', 'conditionFlags'], 'typeDescriptor']
    };
    function inspect(node) {
      const tag = nameOf(node);
      if (node.namespaceURI) report('warning', 'XML namespace on <' + tag + '> is not part of the usual FOMOD schema; local names are being interpreted.');
      const patternOwner = tag === 'pattern' ? nameOf(node.parentNode && node.parentNode.parentNode) : null;
      const allowed = tag === 'pattern' ? ['dependencies', patternOwner === 'dependencyType' ? 'type' : 'files'] : own(allowedChildren, tag) ? allowedChildren[tag] : null;
      if (!allowed) return;
      const counts = Object.create(null);
      const order = tag === 'pattern' ? allowed : sequenceOrder[tag];
      let lastPosition = -1;
      children(node).forEach(item => {
        const itemTag = nameOf(item);
        if (!allowed.includes(itemTag)) report('warning', 'Unsupported <' + itemTag + '> inside <' + tag + '>. It is preserved in XML but is not interpreted.');
        counts[itemTag] = (counts[itemTag] || 0) + 1;
        if (counts[itemTag] > 1 && !(repeatable[tag] || []).includes(itemTag)) report('error', 'Duplicate <' + itemTag + '> inside <' + tag + '>.');
        if (order) {
          const position = order.findIndex(entry => Array.isArray(entry) ? entry.includes(itemTag) : entry === itemTag);
          if (position >= 0) {
            if (position < lastPosition) report('error', '<' + itemTag + '> is out of schema order inside <' + tag + '>.');
            lastPosition = Math.max(lastPosition, position);
          }
        }
        inspect(item);
      });
      if (!['moduleName', 'description', 'flag'].includes(tag) && Array.from(node.childNodes).some(item => (item.nodeType === 3 || item.nodeType === 4) && item.textContent.trim())) report('error', 'Unexpected text inside <' + tag + '>.');
      Array.from(node.attributes || []).forEach(item => {
        if (item.name === 'xmlns' || item.prefix === 'xmlns' || item.namespaceURI === 'http://www.w3.org/2001/XMLSchema-instance') return;
        if (!(allowedAttrs[tag] || []).includes(item.name)) report('warning', 'Unsupported attribute "' + item.name + '" on <' + tag + '> is preserved but not interpreted.');
      });
    }
    inspect(root);

    function requireChild(node, tag) {
      const result = child(node, tag);
      if (!result) report('error', '<' + nameOf(node) + '> is missing required <' + tag + '>.');
      return result;
    }
    function requiredAttr(node, key) {
      const result = attr(node, key);
      if (!node || !node.hasAttribute(key) || !result.trim()) report('error', '<' + nameOf(node) + '> is missing a nonempty "' + key + '" attribute.');
      return result;
    }
    function enumAttr(node, key, values, fallback, required) {
      if (!node || !node.hasAttribute(key)) {
        if (required) report('error', '<' + nameOf(node) + '> is missing required "' + key + '".');
        return fallback;
      }
      const value = attr(node, key);
      if (values.includes(value)) return value;
      report('error', 'Invalid ' + key + '="' + value + '" on <' + nameOf(node) + '>. Expected ' + values.join(', ') + '.');
      return fallback;
    }
    function boolAttr(node, key, fallback) {
      if (!node || !node.hasAttribute(key)) return fallback;
      const value = attr(node, key).trim();
      if (value === 'true' || value === '1') return true;
      if (value === 'false' || value === '0') return false;
      report('error', 'Invalid boolean ' + key + '="' + value + '" on <' + nameOf(node) + '>.');
      return fallback;
    }
    function checkedPath(value, context, allowEmpty) {
      try {
        const result = normalizePath(value);
        if (!result && !allowEmpty) throw new Error('Empty path');
        return result;
      } catch (error) {
        report('error', context + ': ' + error.message);
        return null;
      }
    }
    function ordered(node, records) {
      const order = enumAttr(node, 'order', ORDERS, 'Ascending');
      if (order === 'Explicit') return records;
      return records.slice().sort((a, b) => {
        const left = a.name.toLowerCase(), right = b.name.toLowerCase();
        return (left < right ? -1 : left > right ? 1 : 0) * (order === 'Descending' ? -1 : 1);
      });
    }
    function dependency(node) {
      if (!node) return null;
      const kind = nameOf(node);
      if (['dependencies', 'moduleDependencies', 'visible'].includes(kind)) {
        const rawOperator = attr(node, 'operator', 'And');
        const operator = enumAttr(node, 'operator', ['And', 'Or'], 'And');
        return { kind: 'composite', operator, valid: ['And', 'Or'].includes(rawOperator), children: children(node).map(dependency), node };
      }
      if (kind === 'fileDependency') {
        const rawFile = requiredAttr(node, 'file');
        const file = checkedPath(rawFile, 'File dependency', false);
        const state = enumAttr(node, 'state', FILE_STATES, 'Missing', true);
        if (file) fileDependencies.set(file.toLowerCase(), file);
        return { kind: 'file', file, state, valid: !!file && FILE_STATES.includes(attr(node, 'state')), node };
      }
      if (kind === 'flagDependency') {
        const flag = requiredAttr(node, 'flag');
        if (!node.hasAttribute('value')) report('error', '<flagDependency> is missing required "value".');
        return { kind: 'flag', flag, value: attr(node, 'value'), valid: !!flag && node.hasAttribute('value'), node };
      }
      if (kind === 'gameDependency') {
        const version = requiredAttr(node, 'version');
        const valid = /^\d+(?:\.\d+)*$/.test(version);
        if (!valid) report('error', 'Invalid minimum game version "' + version + '". Use dot-separated numbers.');
        return { kind: 'game', version, valid, node };
      }
      report('warning', 'Unsupported dependency <' + kind + '> evaluates to false. No external runtime is required or queried.');
      return { kind: 'unsupported', tag: kind, node };
    }
    function files(node) {
      if (!node) return [];
      const result = children(node).filter(item => ['file', 'folder'].includes(nameOf(item))).map(item => {
        const source = attr(item, 'source');
        const destination = attr(item, 'destination', source);
        const sourcePath = checkedPath(source, '<' + nameOf(item) + '> source', false);
        const destinationPath = checkedPath(destination, '<' + nameOf(item) + '> destination', true);
        if (!item.hasAttribute('source')) report('error', '<' + nameOf(item) + '> is missing required "source".');
        const priorityText = attr(item, 'priority', '0').trim();
        const priorityValid = /^[+-]?\d+$/.test(priorityText) && Number.isSafeInteger(Number(priorityText));
        if (!priorityValid) report('error', 'Invalid file priority "' + priorityText + '" for ' + source + '.');
        const sourceIsDirectory = nameOf(item) === 'file' && /[\\/]$/.test(source);
        if (sourceIsDirectory) report('error', 'A <file> source cannot end with a directory separator: ' + source + '.');
        return {
          kind: nameOf(item), source, destination, sourcePath, destinationPath,
          destinationIsDirectory: destinationPath === '' || /[\\/]$/.test(destination),
          alwaysInstall: boolAttr(item, 'alwaysInstall', false), installIfUsable: boolAttr(item, 'installIfUsable', false),
          priority: priorityValid ? Number(priorityText) : 0,
          valid: sourcePath !== null && destinationPath !== null && priorityValid && !sourceIsDirectory,
          sequence: sequence++, node: item
        };
      });
      if (!result.length) report('warning', '<' + nameOf(node) + '> has no file or folder entries.');
      return result;
    }
    function typeName(node) { return enumAttr(node, 'name', OPTION_TYPES, 'NotUsable', true); }
    function descriptor(node) {
      if (!node) return { defaultType: 'Optional', patterns: [] };
      const staticType = child(node, 'type'), dynamic = child(node, 'dependencyType');
      if (!!staticType === !!dynamic) report('error', '<typeDescriptor> must contain exactly one of <type> or <dependencyType>.');
      if (staticType) return { defaultType: typeName(staticType), patterns: [] };
      if (!dynamic) return { defaultType: 'NotUsable', patterns: [] };
      const defaultType = typeName(requireChild(dynamic, 'defaultType'));
      const patternsNode = requireChild(dynamic, 'patterns');
      const patterns = children(patternsNode, 'pattern').map(pattern => ({
        dependencies: dependency(requireChild(pattern, 'dependencies')),
        type: typeName(requireChild(pattern, 'type')), node: pattern,
        valid: !!child(pattern, 'dependencies') && !!child(pattern, 'type')
      }));
      if (patternsNode && !patterns.length) report('error', '<dependencyType> needs at least one <pattern>.');
      return { defaultType, patterns };
    }
    function imagePath(node) {
      if (!node) return '';
      const path = attr(node, 'path');
      return checkedPath(path, '<' + nameOf(node) + '> image path', nameOf(node) === 'moduleImage') || '';
    }

    const moduleName = requireChild(root, 'moduleName');
    const name = moduleName ? moduleName.textContent.trim() : 'Untitled installer';
    if (!name) report('error', '<moduleName> must not be empty.');
    if (moduleName) {
      enumAttr(moduleName, 'position', ['Left', 'Right', 'RightOfImage'], 'Left');
      if (moduleName.hasAttribute('colour') && !/^[0-9a-f]{6}$/i.test(attr(moduleName, 'colour'))) report('error', 'moduleName colour must contain six hexadecimal digits.');
    }
    const moduleImage = child(root, 'moduleImage');
    const image = imagePath(moduleImage);
    const showImage = boolAttr(moduleImage, 'showImage', true);
    boolAttr(moduleImage, 'showFade', true);
    if (moduleImage && moduleImage.hasAttribute('height') && !/^-?\d+$/.test(attr(moduleImage, 'height'))) report('error', 'moduleImage height must be an integer.');
    const dependencies = dependency(child(root, 'moduleDependencies'));
    const required = files(child(root, 'requiredInstallFiles'));
    const stepsNode = child(root, 'installSteps');
    const steps = ordered(stepsNode, children(stepsNode, 'installStep').map((stepNode, stepIndex) => {
      const id = 'step-' + stepIndex;
      const groupsNode = requireChild(stepNode, 'optionalFileGroups');
      const groups = ordered(groupsNode, children(groupsNode, 'group').map((groupNode, groupIndex) => {
        const pluginsNode = requireChild(groupNode, 'plugins');
        const options = ordered(pluginsNode, children(pluginsNode, 'plugin').map((optionNode, optionIndex) => {
          const flagsNode = child(optionNode, 'conditionFlags');
          const flags = children(flagsNode, 'flag').map(flag => ({ name: requiredAttr(flag, 'name'), value: flag.textContent.trim(), node: flag }));
          if (flagsNode && !flags.length) report('error', '<conditionFlags> needs at least one <flag>.');
          const typeNode = requireChild(optionNode, 'typeDescriptor');
          const descriptionNode = requireChild(optionNode, 'description');
          return {
            id: 'option-' + stepIndex + '-' + groupIndex + '-' + optionIndex,
            name: requiredAttr(optionNode, 'name') || 'Unnamed option',
            description: descriptionNode ? descriptionNode.textContent.trim() : '',
            image: imagePath(child(optionNode, 'image')), files: files(child(optionNode, 'files')),
            flags, descriptor: descriptor(typeNode), node: optionNode
          };
        }));
        if (!options.length) report('error', 'Group "' + attr(groupNode, 'name') + '" has no options.');
        return {
          id: 'group-' + stepIndex + '-' + groupIndex, name: requiredAttr(groupNode, 'name') || 'Unnamed group',
          type: enumAttr(groupNode, 'type', GROUP_TYPES, 'SelectAny', true), options, node: groupNode
        };
      }));
      if (!groups.length) report('error', 'Step "' + attr(stepNode, 'name') + '" has no groups.');
      return { id, name: requiredAttr(stepNode, 'name') || 'Unnamed step', visible: dependency(child(stepNode, 'visible')), groups, node: stepNode };
    }));
    if (stepsNode && !steps.length) report('error', '<installSteps> needs at least one <installStep>.');
    const conditionalNode = child(root, 'conditionalFileInstalls');
    const conditionalPatterns = conditionalNode ? requireChild(conditionalNode, 'patterns') : null;
    const conditional = children(conditionalPatterns, 'pattern').map((pattern, index) => ({
      id: 'conditional-' + index, dependencies: dependency(requireChild(pattern, 'dependencies')),
      files: files(requireChild(pattern, 'files')), node: pattern, valid: !!child(pattern, 'dependencies') && !!child(pattern, 'files')
    }));
    if (conditionalNode && !conditional.length) report('error', '<conditionalFileInstalls> needs at least one <pattern>.');

    // Same-page and forward flags behave differently across managers. Expose the
    // preview's sequential interpretation instead of silently claiming parity.
    const flagOrigins = new Map();
    steps.forEach((step, index) => step.groups.forEach(group => group.options.forEach(option => option.flags.forEach(flag => {
      if (!flagOrigins.has(flag.name)) flagOrigins.set(flag.name, []);
      flagOrigins.get(flag.name).push(index);
    }))));
    function inspectFlagReferences(dep, beforeIndex, context) {
      if (!dep) return;
      if (dep.kind === 'composite') dep.children.forEach(item => inspectFlagReferences(item, beforeIndex, context));
      if (dep.kind !== 'flag') return;
      const origins = flagOrigins.get(dep.flag) || [];
      if (!origins.length && dep.value !== '') report('warning', 'Flag "' + dep.flag + '" in ' + context + ' is never set by an option.');
      else if (origins.length && !origins.some(index => index < beforeIndex)) report('warning', 'Flag "' + dep.flag + '" in ' + context + ' is set only on the same or a later step. This preview evaluates flags from earlier visible steps only.');
    }
    inspectFlagReferences(dependencies, 0, 'module dependencies');
    steps.forEach((step, index) => {
      inspectFlagReferences(step.visible, index, 'visibility of "' + step.name + '"');
      step.groups.forEach(group => group.options.forEach(option => option.descriptor.patterns.forEach(pattern => inspectFlagReferences(pattern.dependencies, index, 'type of "' + option.name + '"'))));
    });
    conditional.forEach((pattern, index) => inspectFlagReferences(pattern.dependencies, steps.length, 'conditional rule ' + (index + 1)));
    return { doc, name: name || 'Untitled installer', image, showImage, steps, required, conditional, dependencies, diagnostics, fileDependencies: Array.from(fileDependencies.values()) };
  }

  function compareVersions(left, right) {
    const a = left.split('.').map(Number), b = right.split('.').map(Number);
    for (let index = 0; index < Math.max(a.length, b.length); index++) {
      if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) > (b[index] || 0);
    }
    return true;
  }

  function testDependency(dependency, flags, environment, issues) {
    if (!dependency) return true;
    if (dependency.valid === false) return false;
    switch (dependency.kind) {
      case 'composite': {
        // Evaluate every child so unsupported and missing-environment diagnostics remain visible.
        const results = dependency.children.map(item => testDependency(item, flags, environment, issues));
        return dependency.operator === 'Or' ? results.some(Boolean) : results.every(Boolean);
      }
      case 'flag': return (own(flags, dependency.flag) ? flags[dependency.flag] : '') === dependency.value;
      case 'file': return (environment.files[dependency.file.toLowerCase()] || 'Missing') === dependency.state;
      case 'game':
        if (!/^\d+(?:\.\d+)*$/.test(environment.gameVersion)) {
          addIssue(issues, 'warning', 'Set a simulated game version to evaluate the minimum version ' + dependency.version + '. This dependency currently evaluates to false.');
          return false;
        }
        return compareVersions(environment.gameVersion, dependency.version);
      default: return false;
    }
  }

  function evaluate(model, selections, environment) {
    selections = selections || {};
    environment = environment || {};
    const normalizedEnvironment = { files: Object.create(null), gameVersion: String(environment.gameVersion || '').trim() };
    const issues = model.diagnostics.map(item => Object.assign({}, item));
    Object.entries(environment.files || {}).forEach(([path, state]) => {
      try {
        const key = normalizePath(path).toLowerCase();
        if (!FILE_STATES.includes(state)) addIssue(issues, 'error', 'Invalid simulated file state "' + state + '" for ' + path + '.');
        else normalizedEnvironment.files[key] = state;
      } catch (error) { addIssue(issues, 'error', 'Invalid simulated dependency path: ' + error.message); }
    });
    const flags = Object.create(null), nextSelections = Object.create(null);
    const requirementsMet = testDependency(model.dependencies, flags, normalizedEnvironment, issues);
    if (!requirementsMet) addIssue(issues, 'error', 'Module dependencies are not satisfied by the simulated environment. A real installer would stop before installation.');
    const steps = model.steps.map(step => {
      const visible = testDependency(step.visible, flags, normalizedEnvironment, issues);
      const pendingFlags = [];
      const groups = step.groups.map(group => {
        const exclusive = group.type === 'SelectExactlyOne' || group.type === 'SelectAtMostOne';
        const options = group.options.map(option => {
          let type = option.descriptor.defaultType;
          for (const pattern of option.descriptor.patterns) {
            if (pattern.valid && testDependency(pattern.dependencies, flags, normalizedEnvironment, issues)) { type = pattern.type; break; }
          }
          const locked = type === 'Required' || type === 'NotUsable' || group.type === 'SelectAll';
          let selected = false;
          if (visible) {
            if (type === 'NotUsable') selected = false;
            else if (type === 'Required' || group.type === 'SelectAll') selected = true;
            else if (own(selections, option.id) && selections[option.id] !== undefined) selected = selections[option.id] === true;
          } else if (own(selections, option.id) && selections[option.id] !== undefined) {
            // Keep a previous choice available if this step reappears; hidden choices never set flags or selected files.
            nextSelections[option.id] = selections[option.id] === true;
          }
          return Object.assign({}, option, { type, selected, locked });
        });
        if (visible) {
          let selectedCount = options.filter(option => option.selected).length;
          options.forEach(option => {
            if (option.type === 'Recommended' && (!own(selections, option.id) || selections[option.id] === undefined) && (!exclusive || selectedCount === 0)) {
              option.selected = true;
              selectedCount++;
            }
            nextSelections[option.id] = option.selected;
            if (option.selected) {
              pendingFlags.push(...option.flags.map(flag => ({ name: flag.name, value: flag.value, option: option.name })));
              if (option.type === 'CouldBeUsable') addIssue(issues, 'warning', '"' + option.name + '" is marked CouldBeUsable. Verify its compatibility before using a real installer.', { stepId: step.id });
            }
          });
          const selectedCountFinal = options.filter(option => option.selected).length;
          if (group.type === 'SelectExactlyOne' && selectedCountFinal !== 1) addIssue(issues, 'error', 'Choose exactly one option in "' + group.name + '" (currently ' + selectedCountFinal + ').', { stepId: step.id });
          if (group.type === 'SelectAtMostOne' && selectedCountFinal > 1) addIssue(issues, 'error', 'Choose at most one option in "' + group.name + '".', { stepId: step.id });
          if (group.type === 'SelectAtLeastOne' && selectedCountFinal === 0) addIssue(issues, 'error', 'Choose at least one option in "' + group.name + '".', { stepId: step.id });
          if (group.type === 'SelectAll' && options.some(option => option.type === 'NotUsable')) addIssue(issues, 'error', '"' + group.name + '" requires all options, but an option is NotUsable.', { stepId: step.id });
        }
        return Object.assign({}, group, { options });
      });
      const stepAssignments = new Map();
      pendingFlags.forEach(flag => {
        if (stepAssignments.has(flag.name) && stepAssignments.get(flag.name) !== flag.value) addIssue(issues, 'warning', 'Selected options in "' + step.name + '" assign different values to flag "' + flag.name + '"; the last displayed option wins.', { stepId: step.id });
        stepAssignments.set(flag.name, flag.value);
        if (flag.value === '') delete flags[flag.name];
        else flags[flag.name] = flag.value;
      });
      return Object.assign({}, step, { visible, groups });
    });
    return { steps, selections: nextSelections, flags, issues, requirementsMet, environment: normalizedEnvironment, valid: !issues.some(item => item.level === 'error') };
  }

  function simulate(model, evaluated, inventory) {
    const issues = evaluated.issues.map(item => Object.assign({}, item));
    const operations = [], skipped = [], candidates = [];
    const knownInventory = Array.isArray(inventory);
    const inventoryMap = new Map();
    if (knownInventory) inventory.forEach(entry => {
      try {
        const path = normalizePath(typeof entry === 'string' ? entry : entry.path);
        if (!path) return;
        const size = typeof entry === 'object' && Number.isFinite(entry.size) && entry.size >= 0 ? entry.size : null;
        const key = path.toLowerCase();
        if (inventoryMap.has(key)) addIssue(issues, 'warning', 'Package contains case-insensitive duplicate paths: ' + path + '.');
        else inventoryMap.set(key, { path, size });
      } catch (error) { addIssue(issues, 'error', 'Unsafe package inventory path: ' + error.message); }
    });
    const include = (file, reason) => candidates.push({ file, reason });
    const skip = (file, reason) => skipped.push({ source: file.source, destination: file.destination, reason });
    model.required.forEach(file => include(file, 'Required files'));
    evaluated.steps.forEach(step => step.groups.forEach(group => group.options.forEach(option => {
      option.files.forEach(file => {
        if (file.alwaysInstall) include(file, 'Always install: ' + option.name);
        else if (file.installIfUsable && option.type !== 'NotUsable') include(file, 'Install if usable: ' + option.name);
        else if (!step.visible) skip(file, 'Step hidden: ' + step.name);
        else if (option.selected) include(file, 'Selected: ' + option.name);
        else skip(file, option.type === 'NotUsable' ? 'Not usable: ' + option.name : 'Option not selected: ' + option.name);
        if (!step.visible && (file.alwaysInstall || (file.installIfUsable && option.type !== 'NotUsable'))) addIssue(issues, 'warning', 'Hidden step "' + step.name + '" includes an alwaysInstall/installIfUsable file. This plan honors that exception; verify this edge case in the target mod manager.');
      });
    })));
    model.conditional.forEach((pattern, index) => {
      const matches = pattern.valid && testDependency(pattern.dependencies, evaluated.flags, evaluated.environment, issues);
      pattern.files.forEach(file => matches ? include(file, 'Conditional rule ' + (index + 1)) : skip(file, 'Conditional rule ' + (index + 1) + ' did not match'));
    });
    candidates.sort((a, b) => a.file.priority - b.file.priority || a.file.sequence - b.file.sequence);
    function operation(file, source, destination, reason, status, size, kind) {
      operations.push({ source, destination, reason, priority: file.priority, status, size: size == null ? null : size, kind: kind || 'file', sequence: file.sequence });
    }
    candidates.forEach(({ file, reason }) => {
      if (!file.valid) {
        operation(file, file.source, file.destination, reason, 'invalid', null, file.kind);
        addIssue(issues, 'error', 'Invalid mapping excluded from the dry-run result: ' + file.source + '.');
        return;
      }
      const source = file.sourcePath, destination = file.destinationPath;
      if (file.kind === 'folder') {
        if (!knownInventory) {
          operation(file, source + '\\', destination ? destination + '\\' : '', reason, 'unverified', null, 'folder');
          return;
        }
        const prefix = source.toLowerCase() + '\\';
        const matches = Array.from(inventoryMap.entries()).filter(([path]) => path.startsWith(prefix));
        if (!matches.length) {
          operation(file, source + '\\', destination ? destination + '\\' : '', reason, 'missing', null, 'folder');
          addIssue(issues, 'error', 'Source folder is missing or has no files in the opened package: ' + source + '.');
          return;
        }
        matches.forEach(([, entry]) => {
          const relative = entry.path.slice(source.length + 1);
          operation(file, entry.path, destination ? destination + '\\' + relative : relative, reason, 'planned', entry.size);
        });
      } else {
        const basename = source.split('\\').pop();
        const target = file.destinationIsDirectory ? (destination ? destination + '\\' : '') + basename : destination;
        const found = inventoryMap.get(source.toLowerCase());
        const status = !knownInventory ? 'unverified' : found ? 'planned' : 'missing';
        operation(file, found ? found.path : source, target, reason, status, found && found.size);
        if (status === 'missing') addIssue(issues, 'error', 'Source file is missing from the opened package: ' + source + '.');
      }
    });
    const byDestination = new Map();
    operations.forEach(item => {
      if (item.kind !== 'file' || item.status === 'invalid') return;
      const key = item.destination.toLowerCase();
      if (!byDestination.has(key)) byDestination.set(key, []);
      byDestination.get(key).push(item);
    });
    byDestination.forEach(items => {
      if (items.length < 2) return;
      const highest = Math.max(...items.map(item => item.priority));
      const winners = items.filter(item => item.priority === highest);
      const uniqueSources = new Set(winners.map(item => item.source.toLowerCase()));
      items.filter(item => item.priority < highest).forEach(item => {
        item.sourceStatus = item.status;
        item.status = 'overridden';
        item.overriddenBy = winners.map(winner => winner.source).join(', ');
      });
      if (uniqueSources.size > 1) {
        winners.forEach(item => { item.sourceStatus = item.status; item.status = 'conflict'; });
        addIssue(issues, 'warning', 'Equal-priority conflict at ' + items[0].destination + ': ' + Array.from(uniqueSources).join(', ') + '. Mod managers may choose different winners.');
      } else {
        // Repeated identical mappings do not produce extra destination files.
        winners.slice(0, -1).forEach(item => { item.sourceStatus = item.status; item.status = 'overridden'; item.overriddenBy = winners[winners.length - 1].source; });
        addIssue(issues, 'info', 'Multiple mappings target ' + items[0].destination + '; priority ' + highest + ' wins' + (winners.length > 1 ? ' (identical source mappings deduplicated).' : '.'));
      }
    });
    const paths = Array.from(byDestination.keys()).sort();
    paths.forEach(path => {
      const parts = path.split('\\');
      for (let index = 1; index < parts.length; index++) {
        const prefix = parts.slice(0, index).join('\\');
        if (byDestination.has(prefix)) addIssue(issues, 'error', 'Destination collision: "' + prefix + '" is used both as a file and as a folder.');
      }
    });
    if (!knownInventory && candidates.length) addIssue(issues, 'warning', 'XML-only preview: source files and images are unverified, folders cannot be expanded, and folder collisions cannot be fully detected. Open an extracted package folder to check them.');
    if (knownInventory) {
      const images = [model.image, ...model.steps.flatMap(step => step.groups.flatMap(group => group.options.map(option => option.image)))].filter(Boolean);
      new Set(images).forEach(path => {
        if (!inventoryMap.has(path.toLowerCase())) addIssue(issues, 'warning', 'Preview image is missing from the package: ' + path + '.');
      });
    }
    const totals = { files: 0, planned: 0, missing: 0, unverified: 0, overridden: 0, conflicts: 0, invalid: 0, bytes: 0, skipped: skipped.length, folders: 0 };
    operations.forEach(item => {
      if (item.status === 'conflict') totals.conflicts++;
      else if (own(totals, item.status)) totals[item.status]++;
      if (item.kind === 'folder') totals.folders++;
      if (item.kind === 'file' && item.status !== 'overridden' && item.status !== 'invalid') totals.files++;
      if (item.status === 'planned' && item.size !== null) totals.bytes += item.size;
    });
    return { operations, issues, skipped, totals, blocked: !evaluated.requirementsMet || issues.some(item => item.level === 'error'), complete: knownInventory && !issues.some(item => item.level === 'error' || item.level === 'warning') };
  }

  function serialize(doc) {
    return new XMLSerializer().serializeToString(doc);
  }

  global.FomodEngine = Object.freeze({ parse, evaluate, simulate, normalizePath, serialize, GROUP_TYPES, OPTION_TYPES });
})(typeof window !== 'undefined' ? window : globalThis);
