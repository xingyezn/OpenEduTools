(function (root) {
  'use strict';
  function normalizeQuery(value) { return String(value || '').trim().toLocaleLowerCase('zh-CN'); }
  function matchesTool(tool, query) { const needle = normalizeQuery(query); if (!needle) return true; return [tool.name, tool.description, ...(tool.tags || [])].some((value) => normalizeQuery(value).includes(needle)); }
  function filterTools(tools, options = {}) {
    const category = options.category || 'all';
    const favorites = new Set(options.favorites || []);
    return tools.filter((tool) => matchesTool(tool, options.query) && (category === 'all' || tool.category === category) && (!options.onlyFavorites || favorites.has(tool.id)));
  }
  function categoryCounts(tools) { return tools.reduce((counts, tool) => ({ ...counts, [tool.category]: (counts[tool.category] || 0) + 1 }), { all: tools.length }); }
  const api = { normalizeQuery, matchesTool, filterTools, categoryCounts };
  root.OETSearch = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
