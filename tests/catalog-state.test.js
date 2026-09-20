const test = require('node:test');
const assert = require('node:assert/strict');
require('../js/storage.js');
const { normalizeFavorites, createFavorites } = require('../js/favorites.js');
const { normalizeRecent, createRecent } = require('../js/recent.js');
const { normalizeQuery, filterTools, categoryCounts, subjectCounts, fuzzyMatch } = require('../js/search.js');

function memoryStorage(initial = {}) { const values = new Map(Object.entries(initial)); return { getItem: (key) => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key), values }; }
const tools = [
  { id: 'a', name: '随机点名', description: '课堂抽取学生并滚动揭晓', tags: ['随机', '名单'], category: 'classroom-management', subjects: ['general'] },
  { id: 'b', name: '成绩统计', description: '计算平均分和及格率', tags: ['成绩', '数据'], category: 'assessment', subjects: ['mathematics', 'general'] }
];

test('搜索会归一化首尾空格和大小写，并覆盖名称、描述、标签', () => {
  assert.equal(normalizeQuery('  SCORE  '), 'score');
  assert.deepEqual(filterTools(tools, { query: ' 课堂 ' }).map((tool) => tool.id), ['a']);
  assert.deepEqual(filterTools(tools, { query: '数据' }).map((tool) => tool.id), ['b']);
  assert.deepEqual(filterTools(tools, { query: '揭晓' }).map((tool) => tool.id), ['a']);
  assert.deepEqual(filterTools(tools, { query: '揭小' }).map((tool) => tool.id), ['a']);
  assert.deepEqual(filterTools(tools, { query: '成统计' }).map((tool) => tool.id), ['b']);
  assert.equal(fuzzyMatch('成绩统计', '成绩统记'), true);
  assert.deepEqual(filterTools(tools, { query: '' }).map((tool) => tool.id), ['a','b']);
});
test('分类、搜索和收藏筛选可组合', () => {
  assert.deepEqual(filterTools(tools, { query: '统计', category: 'assessment', onlyFavorites: true, favorites: ['b'] }).map((tool) => tool.id), ['b']);
  assert.deepEqual(filterTools(tools, { category: 'missing' }), []);
  assert.deepEqual(categoryCounts(tools), { all: 2, 'classroom-management': 1, assessment: 1 });
  assert.deepEqual(filterTools(tools, { subject: 'mathematics' }).map((tool) => tool.id), ['b']);
  assert.deepEqual(subjectCounts(tools), { all: 2, general: 2, mathematics: 1 });
});
test('收藏去重并忽略未知 ID，损坏存储可降级', () => {
  assert.deepEqual(normalizeFavorites(['a','a','missing'], ['a','b']), ['a']);
  const storage = memoryStorage({ 'openEduTools:favorites': '{bad json' }); const favorites = createFavorites(storage);
  assert.deepEqual(favorites.get(['a']), []); assert.deepEqual(favorites.toggle('a',['a']).value, ['a']); assert.deepEqual(favorites.toggle('a',['a']).value, []);
});
test('最近使用去重、按时间排序、限制十项并可清除', () => {
  const raw = [{id:'a',visitedAt:1},{id:'a',visitedAt:3},{id:'b',visitedAt:2},{id:'x',visitedAt:9},null];
  assert.deepEqual(normalizeRecent(raw,['a','b']), [{id:'a',visitedAt:3},{id:'b',visitedAt:2}]);
  assert.equal(normalizeRecent(Array.from({length:12},(_,i)=>({id:String(i),visitedAt:i}))).length,10);
  const storage=memoryStorage(); const recent=createRecent(storage); recent.add('a',10); recent.add('b',20); recent.add('a',30); assert.deepEqual(recent.get(),[{id:'a',visitedAt:30},{id:'b',visitedAt:20}]); assert.equal(recent.clear(),true); assert.deepEqual(recent.get(),[]);
});
