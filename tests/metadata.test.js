const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('有效与无效元数据夹具按 JSON Schema 规则校验', async () => {
  const { validateMetadata } = await import('../scripts/tool-metadata.mjs');
  const read = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
  assert.deepEqual(validateMetadata(read('valid-tool.json'), { directoryName: 'sample-tool' }), []);
  const errors = validateMetadata(read('invalid-tool.json'), { directoryName: 'invalid-tool' });
  assert.ok(errors.length >= 10);
  assert.ok(errors.some((error) => error.includes('缺少字段 description')));
  assert.ok(errors.some((error) => error.includes('重复项')));
  assert.ok(errors.some((error) => error.includes('offline')));
});
