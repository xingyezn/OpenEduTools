const test = require('node:test');
const assert = require('node:assert/strict');
const { formatCount } = require('../js/format.js');

test('formatCount 按约定压缩计数', () => {
  assert.equal(formatCount(0), '0');
  assert.equal(formatCount(1), '1');
  assert.equal(formatCount(982), '982');
  assert.equal(formatCount(999), '999');
  assert.equal(formatCount(1000), '1k');
  assert.equal(formatCount(1230), '1.2k');
  assert.equal(formatCount(12830), '12.8k');
  assert.equal(formatCount(100000), '100k');
  assert.equal(formatCount(1000000), '1M');
  assert.equal(formatCount(1250000), '1.3M');
});

test('formatCount 对非法或负值回退为 0', () => {
  assert.equal(formatCount(-5), '0');
  assert.equal(formatCount(undefined), '0');
  assert.equal(formatCount(null), '0');
  assert.equal(formatCount('abc'), '0');
  assert.equal(formatCount(NaN), '0');
});
