// OpenEduTools 匿名使用统计 Worker。
//
// 只接收 { tool_id, event }，按 UTC 日期聚合计数。
// 不保存原始事件、IP、账号、输入内容、文件名或任何学生数据。
// 统计失败不得影响工具使用，因此客户端始终 fail-silent。

const TOOL_ID_REGEX = /^[a-z0-9][a-z0-9-]{1,63}$/;

const ALLOWED_EVENTS = new Set([
  'tool_open',
  'tool_use',
  'favorite_add',
  'favorite_remove',
  'share'
]);

const EVENT_COLUMNS = {
  tool_open: 'opens',
  tool_use: 'uses',
  favorite_add: 'favorite_adds',
  favorite_remove: 'favorite_removes',
  share: 'shares'
};

const MAX_BODY_BYTES = 1024;
const RANKING_LIMIT = 10;
const RECENT_WINDOW_DAYS = 7;
const DEFAULT_ALLOWED_ORIGINS = ['https://xingyezn.github.io'];

function aggregateSql(whereClause = '') {
  return `SELECT
    tool_id,
    SUM(opens) AS opens,
    SUM(uses) AS uses,
    SUM(favorite_adds) AS favorite_adds,
    SUM(favorite_removes) AS favorite_removes,
    SUM(shares) AS shares
  FROM tool_daily_stats
  ${whereClause}
  GROUP BY tool_id`;
}

export function isValidToolId(value) {
  return typeof value === 'string' && TOOL_ID_REGEX.test(value);
}

export function isValidEvent(value) {
  return typeof value === 'string' && ALLOWED_EVENTS.has(value);
}

export function eventColumn(event) {
  return Object.hasOwn(EVENT_COLUMNS, event) ? EVENT_COLUMNS[event] : null;
}

export function favoritesOf(row) {
  return Math.max(0, Number(row?.favorite_adds || 0) - Number(row?.favorite_removes || 0));
}

export function utcDate(now = new Date()) {
  return new Date(now).toISOString().slice(0, 10);
}

export function cutoffDate(days, now = new Date()) {
  const span = Math.max(1, Number(days) || 1);
  return utcDate(new Date(new Date(now).getTime() - (span - 1) * 86400000));
}

export function isoWithOffset(now = new Date(), offsetHours = 8) {
  const shifted = new Date(new Date(now).getTime() + offsetHours * 3600000);
  return shifted.toISOString().replace(/\.\d{3}Z$/, `+${String(offsetHours).padStart(2, '0')}:00`);
}

export function timingSafeEqual(left, right) {
  const a = String(left ?? '');
  const b = String(right ?? '');
  if (a.length !== b.length || a.length === 0) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}

function rankBy(rows, score, limit = RANKING_LIMIT) {
  return [...rows]
    .filter((row) => score(row) > 0)
    .sort((a, b) => score(b) - score(a) || String(a.tool_id).localeCompare(String(b.tool_id), 'en'))
    .slice(0, limit)
    .map((row) => row.tool_id);
}

export function buildExport(allRows = [], recentRows = [], now = new Date()) {
  const tools = {};
  let totalOpens = 0;
  let totalUses = 0;
  let totalFavorites = 0;

  for (const row of allRows) {
    const opens = Number(row.opens || 0);
    const uses = Number(row.uses || 0);
    const favorites = favoritesOf(row);
    const shares = Number(row.shares || 0);
    tools[row.tool_id] = { opens, uses, favorites, shares };
    totalOpens += opens;
    totalUses += uses;
    totalFavorites += favorites;
  }

  return {
    updated_at: isoWithOffset(now),
    summary: {
      total_opens: totalOpens,
      total_uses: totalUses,
      total_favorites: totalFavorites
    },
    tools,
    rankings: {
      all_time: {
        most_used: rankBy(allRows, (row) => Number(row.uses || 0)),
        most_favorited: rankBy(allRows, (row) => favoritesOf(row))
      },
      last_7_days: {
        most_used: rankBy(recentRows, (row) => Number(row.uses || 0)),
        most_favorited: rankBy(recentRows, (row) => favoritesOf(row))
      }
    }
  };
}

export function allowedOrigins(env) {
  const configured = String(env?.ALLOWED_ORIGINS || '').trim();
  return (configured ? configured.split(',') : DEFAULT_ALLOWED_ORIGINS)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return { allowed: true, headers: {} };
  if (!allowedOrigins(env).includes(origin)) return { allowed: false, headers: {} };
  return {
    allowed: true,
    headers: {
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  };
}

function jsonResponse(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
  });
}

export async function handleEvent(request, env, headers = {}) {
  const contentType = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return jsonResponse({ ok: false, error: 'unsupported_media_type' }, 415, headers);
  }

  const declared = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: 'payload_too_large' }, 413, headers);
  }

  let text;
  try {
    text = await request.text();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_body' }, 400, headers);
  }
  if (text.length > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: 'payload_too_large' }, 413, headers);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400, headers);
  }

  const toolId = payload && payload.tool_id;
  const event = payload && payload.event;
  const column = eventColumn(event);
  if (!isValidToolId(toolId) || !column) {
    return jsonResponse({ ok: false, error: 'invalid_event' }, 400, headers);
  }

  try {
    await env.DB
      .prepare(
        `INSERT INTO tool_daily_stats (date, tool_id, ${column}) VALUES (?, ?, 1)
         ON CONFLICT(date, tool_id) DO UPDATE SET ${column} = ${column} + 1`
      )
      .bind(utcDate(), toolId)
      .run();
  } catch {
    return jsonResponse({ ok: false, error: 'storage_failed' }, 500, headers);
  }

  return new Response(null, { status: 204, headers });
}

export async function handleExport(request, env, headers = {}) {
  const expected = env?.ADMIN_TOKEN;
  if (!expected) return jsonResponse({ ok: false, error: 'not_configured' }, 500, headers);

  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!timingSafeEqual(token, expected)) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401, headers);
  }

  try {
    const allRows = (await env.DB.prepare(aggregateSql()).all()).results || [];
    const recentRows = (
      await env.DB
        .prepare(aggregateSql('WHERE date >= ?'))
        .bind(cutoffDate(RECENT_WINDOW_DAYS))
        .all()
    ).results || [];
    return jsonResponse(buildExport(allRows, recentRows), 200, headers);
  } catch {
    return jsonResponse({ ok: false, error: 'storage_failed' }, 500, headers);
  }
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (!cors.allowed) return new Response('Origin not allowed', { status: 403 });

    const { pathname } = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors.headers });
    if (pathname === '/event' && request.method === 'POST') return handleEvent(request, env, cors.headers);
    if (pathname === '/admin/export' && request.method === 'GET') return handleExport(request, env, cors.headers);
    if (pathname === '/event' || pathname === '/admin/export') {
      return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, cors.headers);
    }
    return jsonResponse({ ok: false, error: 'not_found' }, 404, cors.headers);
  }
};
