const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPopularity, rankTools, clampPage, paginate, pageList } = require('../js/catalog-view.js');

const tools = [
  { id: 'a', name: 'A', featured: false },
  { id: 'b', name: 'B', featured: true },
  { id: 'c', name: 'C', featured: false },
  { id: 'd', name: 'D', featured: true }
];

test('无统计时按 featured 优先、其余保持原顺序', () => {
  assert.deepEqual(rankTools(tools, buildPopularity(null)).map((tool) => tool.id), ['b', 'd', 'a', 'c']);
});

test('有统计时按热度降序，收藏权重高于使用', () => {
  const stats = { tools: { a: { uses: 5, favorites: 0 }, c: { uses: 0, favorites: 3 }, b: { uses: 1, favorites: 0 } } };
  assert.deepEqual(rankTools(tools, buildPopularity(stats)).map((tool) => tool.id), ['c', 'a', 'b', 'd']);
});

test('最近七日排行会为工具加权', () => {
  const stats = { tools: { a: { uses: 2 }, c: { uses: 2 } }, rankings: { last_7_days: { most_used: ['c'] } } };
  assert.deepEqual(rankTools(tools, buildPopularity(stats)).map((tool) => tool.id)[0], 'c');
});

test('排名不修改原数组', () => {
  const snapshot = tools.map((tool) => tool.id);
  rankTools(tools, buildPopularity(null));
  assert.deepEqual(tools.map((tool) => tool.id), snapshot);
});

test('clampPage 将页码限制在有效范围', () => {
  assert.equal(clampPage(0, 3), 1);
  assert.equal(clampPage(2, 3), 2);
  assert.equal(clampPage(9, 3), 3);
  assert.equal(clampPage('x', 0), 1);
});

test('paginate 正确切分并计算边界', () => {
  const items = Array.from({ length: 22 }, (_, index) => index + 1);
  const first = paginate(items, 1, 9);
  assert.deepEqual(first.items, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual([first.page, first.pageCount, first.total, first.from, first.to], [1, 3, 22, 1, 9]);
  const last = paginate(items, 3, 9);
  assert.deepEqual(last.items, [19, 20, 21, 22]);
  assert.deepEqual([last.from, last.to], [19, 22]);
  assert.equal(paginate(items, 99, 9).page, 3);
  assert.deepEqual(paginate([], 1, 9), { items: [], page: 1, pageCount: 1, total: 0, size: 9, from: 0, to: 0 });
});

test('pageList 生成带省略号的页码序列', () => {
  assert.deepEqual(pageList(1, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(pageList(5, 10), [1, '…', 4, 5, 6, '…', 10]);
  assert.deepEqual(pageList(1, 10), [1, 2, '…', 10]);
  assert.deepEqual(pageList(10, 10), [1, '…', 9, 10]);
});
