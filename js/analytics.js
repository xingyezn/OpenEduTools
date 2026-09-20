(function (root) {
  'use strict';

  // OpenEduTools 匿名统计客户端。
  //
  // 只发送 { tool_id, event }，不包含任何用户输入、文件、学生数据或账号信息。
  // 任何失败都必须静默处理，统计永远不能影响工具本身。
  //
  // 端点留空即整体禁用；离线包（data-offline-bundle）和本地调试地址永不发送。
  const ENDPOINT = 'https://openedutools-stats.openedutools.workers.dev';
  const EVENT_PATH = '/event';
  const OPEN_DEDUP_MS = 30 * 60 * 1000;
  const STORAGE_PREFIX = 'openEduTools:open:';

  const ALLOWED_EVENTS = new Set(['tool_open', 'tool_use', 'favorite_add', 'favorite_remove', 'share']);
  const TOOL_ID_REGEX = /^[a-z0-9][a-z0-9-]{1,63}$/;

  function isValidToolId(value) {
    return typeof value === 'string' && TOOL_ID_REGEX.test(value);
  }

  function isValidEvent(value) {
    return typeof value === 'string' && ALLOWED_EVENTS.has(value);
  }

  function buildPayload(event, toolId) {
    return { tool_id: toolId, event };
  }

  // 同一浏览器 Session 内，同一工具 30 分钟内只记录一次 tool_open。
  function shouldRecordOpen(last, now, windowMs = OPEN_DEDUP_MS) {
    const previous = Number(last);
    if (!Number.isFinite(previous) || previous <= 0) return true;
    return now - previous >= windowMs;
  }

  function isLocalHost(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
      || hostname === '0.0.0.0' || hostname.endsWith('.local');
  }

  function isEnabled() {
    if (!ENDPOINT) return false;
    if (typeof document === 'undefined' || typeof location === 'undefined') return false;
    if (document.documentElement && document.documentElement.hasAttribute('data-offline-bundle')) return false;
    if (location.protocol !== 'https:' && location.protocol !== 'http:') return false;
    return !isLocalHost(location.hostname || '');
  }

  function send(event, toolId) {
    if (!isEnabled() || !isValidEvent(event) || !isValidToolId(toolId)) return false;
    try {
      const request = root.fetch(`${ENDPOINT}${EVENT_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(event, toolId)),
        keepalive: true
      });
      if (request && typeof request.catch === 'function') request.catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  function toolOpen(toolId) {
    if (!isEnabled() || !isValidToolId(toolId)) return false;
    try {
      const storage = root.sessionStorage;
      const key = `${STORAGE_PREFIX}${toolId}`;
      const now = Date.now();
      if (!shouldRecordOpen(storage.getItem(key), now)) return false;
      storage.setItem(key, String(now));
    } catch {
      // 存储不可用时仍然记录一次，不阻断。
    }
    return send('tool_open', toolId);
  }

  function toolUse(toolId) { return send('tool_use', toolId); }
  function favoriteAdd(toolId) { return send('favorite_add', toolId); }
  function favoriteRemove(toolId) { return send('favorite_remove', toolId); }
  function share(toolId) { return send('share', toolId); }

  const api = {
    ENDPOINT,
    OPEN_DEDUP_MS,
    STORAGE_PREFIX,
    isValidToolId,
    isValidEvent,
    buildPayload,
    shouldRecordOpen,
    isEnabled,
    track: send,
    toolOpen,
    toolUse,
    favoriteAdd,
    favoriteRemove,
    share
  };
  root.OpenEduAnalytics = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
