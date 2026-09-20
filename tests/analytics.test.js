const test = require('node:test');
const assert = require('node:assert/strict');
const analytics = require('../js/analytics.js');

test('tool_id 与 event 校验和 Worker 保持一致', () => {
  for (const value of ['random-group', 'score-statistics', 'a1', 'latex-table']) assert.equal(analytics.isValidToolId(value), true);
  for (const value of ['Random Group', '../x', '<script>', '中文工具', '', 'a', 'random_group', null, 42]) assert.equal(analytics.isValidToolId(value), false);
  for (const event of ['tool_open', 'tool_use', 'favorite_add', 'favorite_remove', 'share']) assert.equal(analytics.isValidEvent(event), true);
  for (const event of ['download', 'error', '', 'TOOL_USE', null]) assert.equal(analytics.isValidEvent(event), false);
});

test('buildPayload 只包含 tool_id 与 event', () => {
  assert.deepEqual(analytics.buildPayload('tool_use', 'random-group'), { tool_id: 'random-group', event: 'tool_use' });
  assert.deepEqual(Object.keys(analytics.buildPayload('share', 'text-cleaner')).sort(), ['event', 'tool_id']);
});

test('tool_open 在同一 Session 的 30 分钟窗口内去重', () => {
  const now = 1000000000000;
  assert.equal(analytics.shouldRecordOpen(null, now), true);
  assert.equal(analytics.shouldRecordOpen('0', now), true);
  assert.equal(analytics.shouldRecordOpen('not-a-number', now), true);
  assert.equal(analytics.shouldRecordOpen(String(now - 1000), now), false);
  assert.equal(analytics.shouldRecordOpen(String(now - analytics.OPEN_DEDUP_MS + 1), now), false);
  assert.equal(analytics.shouldRecordOpen(String(now - analytics.OPEN_DEDUP_MS), now), true);
});

test('没有浏览器环境时统计整体禁用且不抛错', () => {
  assert.equal(analytics.isEnabled(), false);
  assert.equal(analytics.toolOpen('random-group'), false);
  assert.equal(analytics.toolUse('random-group'), false);
  assert.equal(analytics.favoriteAdd('random-group'), false);
  assert.equal(analytics.share('random-group'), false);
});

test('端点与本地去重键前缀稳定', () => {
  assert.match(analytics.ENDPOINT, /^https:\/\/[a-z0-9.-]+\.workers\.dev$/);
  assert.equal(analytics.STORAGE_PREFIX, 'openEduTools:open:');
  assert.equal(analytics.OPEN_DEDUP_MS, 30 * 60 * 1000);
});
