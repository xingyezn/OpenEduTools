(function (root) {
  'use strict';
  function toNumber(value) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : 0; }

  function buildPopularity(stats) {
    const scores = new Map();
    const tools = stats && stats.tools && typeof stats.tools === 'object' ? stats.tools : {};
    for (const [id, entry] of Object.entries(tools)) {
      const uses = toNumber(entry && entry.uses);
      const favorites = toNumber(entry && entry.favorites);
      scores.set(id, uses + favorites * 2);
    }
    const rankings = stats && stats.rankings ? stats.rankings : {};
    const week = rankings.last_7_days && Array.isArray(rankings.last_7_days.most_used) ? rankings.last_7_days.most_used : [];
    week.forEach((id, index) => { if (typeof id === 'string' && id) scores.set(id, (scores.get(id) || 0) + Math.max(1, 10 - index)); });
    return scores;
  }

  function popularityOf(popularity, id) {
    if (!popularity) return 0;
    if (typeof popularity.get === 'function') return toNumber(popularity.get(id));
    return toNumber(popularity[id]);
  }

  function rankTools(tools, popularity) {
    return tools.map((tool, index) => ({ tool, index })).sort((left, right) => {
      const diff = popularityOf(popularity, right.tool.id) - popularityOf(popularity, left.tool.id);
      if (diff) return diff;
      const featured = Number(Boolean(right.tool.featured)) - Number(Boolean(left.tool.featured));
      if (featured) return featured;
      return left.index - right.index;
    }).map((entry) => entry.tool);
  }

  function clampPage(page, pageCount) {
    const count = Math.max(1, Math.floor(Number(pageCount)) || 1);
    const value = Math.floor(Number(page)) || 1;
    return Math.min(Math.max(value, 1), count);
  }

  function paginate(items, page, pageSize) {
    const list = Array.isArray(items) ? items : [];
    const size = Math.max(1, Math.floor(Number(pageSize)) || 1);
    const total = list.length;
    const pageCount = Math.max(1, Math.ceil(total / size));
    const current = clampPage(page, pageCount);
    const start = (current - 1) * size;
    const end = Math.min(start + size, total);
    return { items: list.slice(start, end), page: current, pageCount, total, size, from: total ? start + 1 : 0, to: end };
  }

  function pageList(page, pageCount, span = 1) {
    const count = Math.max(1, Math.floor(Number(pageCount)) || 1);
    const current = clampPage(page, count);
    if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1);
    const numbers = new Set([1, count]);
    for (let offset = -span; offset <= span; offset += 1) numbers.add(current + offset);
    const sorted = [...numbers].filter((value) => value >= 1 && value <= count).sort((left, right) => left - right);
    const result = []; let previous = 0;
    for (const value of sorted) { if (previous && value - previous > 1) result.push('…'); result.push(value); previous = value; }
    return result;
  }

  const api = { buildPopularity, rankTools, clampPage, paginate, pageList };
  root.OETCatalogView = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
