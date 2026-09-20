const test = require('node:test');
const assert = require('node:assert/strict');

test('离线包生成器输出标准 ZIP 并保留可直接预览的目录结构', async () => {
  const { collectToolPackage, createZip } = await import('../scripts/build-tool-downloads.mjs');
  const entries = await collectToolPackage('random-picker'); const names = entries.map((entry) => entry.name);
  assert.ok(names.includes('OpenEduTools-random-picker/index.html'));
  assert.ok(names.includes('OpenEduTools-random-picker/tools/random-picker/index.html'));
  assert.ok(names.includes('OpenEduTools-random-picker/css/tool.css'));
  assert.ok(names.includes('OpenEduTools-random-picker/js/tool-page.js'));
  const zip = createZip(entries); assert.equal(zip.subarray(0, 4).toString('hex'), '504b0304'); assert.ok(zip.includes(Buffer.from('tools/random-picker/index.html')));
});
