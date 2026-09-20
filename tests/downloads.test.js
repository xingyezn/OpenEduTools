const test = require('node:test');
const assert = require('node:assert/strict');

test('离线包生成器输出标准 ZIP 并保留可直接预览的目录结构', async () => {
  const { collectToolPackage, createZip } = await import('../scripts/build-tool-downloads.mjs');
  const entries = await collectToolPackage('random-picker'); const names = entries.map((entry) => entry.name);
  assert.ok(names.includes('OpenEduTools-random-picker/index.html'));
  assert.ok(names.includes('OpenEduTools-random-picker/tools/random-picker/index.html'));
  assert.ok(names.includes('OpenEduTools-random-picker/css/tool.css'));
  assert.ok(names.includes('OpenEduTools-random-picker/js/tool-page.js'));
  const indexEntry = entries.find((entry) => entry.name === 'OpenEduTools-random-picker/tools/random-picker/index.html');
  assert.ok(indexEntry, '离线包应包含工具入口');
  const offlineHtml = indexEntry.data.toString();
  assert.ok(offlineHtml.includes('data-offline-bundle'), '离线入口应带离线标记');
  assert.ok(!offlineHtml.includes('analytics.js'), '离线包不得引用统计脚本');
  const zip = createZip(entries); assert.equal(zip.subarray(0, 4).toString('hex'), '504b0304'); assert.ok(zip.includes(Buffer.from('tools/random-picker/index.html')));
});
