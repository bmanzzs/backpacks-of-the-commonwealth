// Creates the folder-import fixture from the exact built-in demonstration.
// Existing files are never replaced by this helper.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const sandbox = { window: {}, TextEncoder, encodeURIComponent };
vm.runInNewContext(fs.readFileSync(path.join(root, 'demo.js'), 'utf8'), sandbox);
const demo = sandbox.window.FomodDemo;
const sample = path.join(root, 'sample-package');
const contents = {
  'fomod/ModuleConfig.xml': demo.xml + '\n',
  'fomod/info.xml': '<?xml version="1.0" encoding="UTF-8"?>\n<fomod><Name>Trailbound • Field Kit</Name><Author>FOMOD Workbench demo</Author><Version>1.0.0</Version><Description>Fictional simulation fixture. No working game assets are included.</Description></fomod>\n',
  'fomod/images/field-kit.svg': decodeURIComponent(demo.images['fomod\\images\\field-kit.svg'].split(',').slice(1).join(',')) + '\n',
  'README.txt': 'TRAILBOUND / FIELD KIT — FOMOD WORKBENCH SAMPLE\n\nThis is a fictional package for testing the viewer.\nThe ESP, DDS, and NIF files are plain-text simulation fixtures, NOT working game files.\nDo not install this sample in a game or a mod manager.\n\nOpen this whole sample-package folder in FOMOD Workbench.\nTry 2K or 4K, enable weathering to reveal a third page, and set CompanionMod.esp to Active in the simulated environment.\nThe weathering texture supersedes the chosen base color texture because its priority is higher.\nBuilt-in demo file sizes are illustrative; importing this folder shows actual fixture sizes.\n\nAll text and schematic artwork were created for this demo.\n'
};
for (const entry of demo.files) {
  if (!(entry.path in contents)) contents[entry.path] = 'FOMOD WORKBENCH SIMULATION FIXTURE\n' + entry.path + '\nThis is plain text, not a valid game asset. Do not install.\n';
}
for (const [relative, content] of Object.entries(contents)) {
  const target = path.join(sample, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target)) fs.writeFileSync(target, content, { encoding: 'utf8', flag: 'wx' });
}
console.log('Sample package ready:', sample);
