import test from 'node:test';
import assert from 'node:assert/strict';

import worker, {
  allowedOrigins,
  buildExport,
  corsHeaders,
  cutoffDate,
  eventColumn,
  favoritesOf,
  handleEvent,
  handleExport,
  isValidEvent,
  isValidToolId,
  isoWithOffset,
  timingSafeEqual,
  utcDate
} from '../src/index.js';

function createFakeDb({ allResults = [[]] } = {}) {
  const calls = { run: [], all: [] };
  let allIndex = 0;
  return {
    calls,
    prepare(sql) {
      const statement = {
        sql,
        binds: [],
        bind(...values) {
          statement.binds = values;
          return statement;
        },
        async run() {
          calls.run.push({ sql, binds: statement.binds });
          return { success: true };
        },
        async all() {
          calls.all.push({ sql, binds: statement.binds });
          const results = allResults[allIndex] ?? [];
          allIndex += 1;
          return { results };
        }
      };
      return statement;
    }
  };
}

function eventRequest(body, { origin = 'https://xingyezn.github.io', contentType = 'application/json' } = {}) {
  const headers = {};
  if (contentType !== null) headers['Content-Type'] = contentType;
  if (origin !== null) headers.Origin = origin;
  return new Request('https://stats.example.com/event', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}

test('tool_id 只接受小写 kebab-case', () => {
  for (const value of ['random-group', 'grade-analysis', 'latex-table', 'a1']) assert.equal(isValidToolId(value), true);
  for (const value of ['Random Group', '../../../test', '<script>', '中文工具', '', 'a', 'random_group', 'random group', null, 42]) {
    assert.equal(isValidToolId(value), false);
  }
});

test('event 白名单与列映射稳定', () => {
  const events = ['tool_open', 'tool_use', 'favorite_add', 'favorite_remove', 'share'];
  for (const value of events) assert.equal(isValidEvent(value), true);
  for (const value of ['download', 'error', '', 'TOOL_USE', null]) assert.equal(isValidEvent(value), false);
  assert.equal(eventColumn('tool_open'), 'opens');
  assert.equal(eventColumn('tool_use'), 'uses');
  assert.equal(eventColumn('favorite_add'), 'favorite_adds');
  assert.equal(eventColumn('favorite_remove'), 'favorite_removes');
  assert.equal(eventColumn('share'), 'shares');
  assert.equal(eventColumn('download'), null);
});

test('收藏量不会为负', () => {
  assert.equal(favoritesOf({ favorite_adds: 5, favorite_removes: 2 }), 3);
  assert.equal(favoritesOf({ favorite_adds: 1, favorite_removes: 4 }), 0);
  assert.equal(favoritesOf({}), 0);
});

test('日期与时间窗口按 UTC 计算', () => {
  const now = new Date('2026-09-21T01:00:00Z');
  assert.equal(utcDate(now), '2026-09-21');
  assert.equal(cutoffDate(7, now), '2026-09-15');
  assert.equal(isoWithOffset(now), '2026-09-21T09:00:00+08:00');
});

test('timingSafeEqual 对长度和内容都敏感', () => {
  assert.equal(timingSafeEqual('secret', 'secret'), true);
  assert.equal(timingSafeEqual('secret', 'secreT'), false);
  assert.equal(timingSafeEqual('secret', 'secret '), false);
  assert.equal(timingSafeEqual('', ''), false);
});

test('buildExport 生成 summary、tools 与两组排行', () => {
  const allRows = [
    { tool_id: 'random-group', opens: 10, uses: 8, favorite_adds: 5, favorite_removes: 1, shares: 2 },
    { tool_id: 'grade-analysis', opens: 4, uses: 9, favorite_adds: 3, favorite_removes: 0, shares: 1 }
  ];
  const recentRows = [
    { tool_id: 'grade-analysis', opens: 2, uses: 6, favorite_adds: 1, favorite_removes: 0, shares: 0 },
    { tool_id: 'random-group', opens: 3, uses: 3, favorite_adds: 0, favorite_removes: 0, shares: 1 }
  ];
  const payload = buildExport(allRows, recentRows, new Date('2026-09-21T01:00:00Z'));

  assert.deepEqual(payload.summary, { total_opens: 14, total_uses: 17, total_favorites: 7 });
  assert.deepEqual(payload.tools['random-group'], { opens: 10, uses: 8, favorites: 4, shares: 2 });
  assert.deepEqual(payload.tools['grade-analysis'], { opens: 4, uses: 9, favorites: 3, shares: 1 });
  assert.deepEqual(payload.rankings.all_time.most_used, ['grade-analysis', 'random-group']);
  assert.deepEqual(payload.rankings.all_time.most_favorited, ['random-group', 'grade-analysis']);
  assert.deepEqual(payload.rankings.last_7_days.most_used, ['grade-analysis', 'random-group']);
  assert.equal(payload.updated_at, '2026-09-21T09:00:00+08:00');
});

test('CORS 只放行配置的来源', () => {
  const env = { ALLOWED_ORIGINS: 'https://xingyezn.github.io, http://localhost:8000' };
  assert.deepEqual(allowedOrigins(env), ['https://xingyezn.github.io', 'http://localhost:8000']);
  assert.deepEqual(allowedOrigins({}), ['https://xingyezn.github.io']);

  const allowed = corsHeaders(new Request('https://stats.example.com/event', { headers: { Origin: 'https://xingyezn.github.io' } }), env);
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.headers['Access-Control-Allow-Origin'], 'https://xingyezn.github.io');

  const blocked = corsHeaders(new Request('https://stats.example.com/event', { headers: { Origin: 'https://evil.example.com' } }), env);
  assert.equal(blocked.allowed, false);

  const noOrigin = corsHeaders(new Request('https://stats.example.com/event'), env);
  assert.equal(noOrigin.allowed, true);
  assert.deepEqual(noOrigin.headers, {});
});

test('POST /event 合法请求写入对应列并返回 204', async () => {
  const db = createFakeDb();
  const response = await worker.fetch(eventRequest({ tool_id: 'random-group', event: 'tool_use' }), { DB: db });
  assert.equal(response.status, 204);
  assert.equal(db.calls.run.length, 1);
  assert.match(db.calls.run[0].sql, /INSERT INTO tool_daily_stats/);
  assert.match(db.calls.run[0].sql, /uses = uses \+ 1/);
  assert.deepEqual(db.calls.run[0].binds, [utcDate(), 'random-group']);
});

test('POST /event 拒绝非法输入', async () => {
  const env = { DB: createFakeDb() };
  assert.equal((await worker.fetch(eventRequest({ tool_id: '../x', event: 'tool_use' }), env)).status, 400);
  assert.equal((await worker.fetch(eventRequest({ tool_id: 'random-group', event: 'download' }), env)).status, 400);
  assert.equal((await worker.fetch(eventRequest({ tool_id: 'random-group' }), env)).status, 400);
  assert.equal((await worker.fetch(eventRequest('not-json'), env)).status, 400);
  assert.equal((await worker.fetch(eventRequest({ tool_id: 'random-group', event: 'share' }, { contentType: 'text/plain' }), env)).status, 415);
  assert.equal((await worker.fetch(eventRequest(JSON.stringify({ tool_id: 'a'.repeat(2000), event: 'share' })), env)).status, 413);
  assert.equal(env.DB.calls.run.length, 0);
});

test('GET /admin/export 需要正确的 Bearer Token', async () => {
  const allRows = [{ tool_id: 'random-group', opens: 2, uses: 2, favorite_adds: 1, favorite_removes: 0, shares: 0 }];
  const env = { ADMIN_TOKEN: 'top-secret', DB: createFakeDb({ allResults: [allRows, allRows] }) };

  const missing = await handleExport(new Request('https://stats.example.com/admin/export'), env);
  assert.equal(missing.status, 401);

  const wrong = await handleExport(new Request('https://stats.example.com/admin/export', { headers: { Authorization: 'Bearer nope' } }), env);
  assert.equal(wrong.status, 401);

  const ok = await handleExport(new Request('https://stats.example.com/admin/export', { headers: { Authorization: 'Bearer top-secret' } }), env);
  assert.equal(ok.status, 200);
  const payload = await ok.json();
  assert.equal(payload.summary.total_uses, 2);
  assert.equal(payload.tools['random-group'].favorites, 1);
  assert.deepEqual(payload.rankings.all_time.most_used, ['random-group']);
});

test('缺少 ADMIN_TOKEN 时导出返回 500 而非泄漏数据', async () => {
  const response = await handleExport(new Request('https://stats.example.com/admin/export'), { DB: createFakeDb() });
  assert.equal(response.status, 500);
});

test('OPTIONS 预检、未知路径与方法错误', async () => {
  const env = { DB: createFakeDb() };
  const preflight = await worker.fetch(new Request('https://stats.example.com/event', { method: 'OPTIONS', headers: { Origin: 'https://xingyezn.github.io' } }), env);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://xingyezn.github.io');

  const notFound = await worker.fetch(new Request('https://stats.example.com/nope'), env);
  assert.equal(notFound.status, 404);

  const wrongMethod = await worker.fetch(new Request('https://stats.example.com/event', { method: 'GET' }), env);
  assert.equal(wrongMethod.status, 405);

  const blocked = await worker.fetch(new Request('https://stats.example.com/event', { method: 'POST', headers: { Origin: 'https://evil.example.com' } }), env);
  assert.equal(blocked.status, 403);
});

test('handleEvent 在存储失败时返回 500 且不抛出', async () => {
  const env = { DB: { prepare: () => ({ bind() { return this; }, run: async () => { throw new Error('d1 down'); } }) } };
  const response = await handleEvent(eventRequest({ tool_id: 'random-group', event: 'tool_open' }), env);
  assert.equal(response.status, 500);
});
