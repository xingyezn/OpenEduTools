(function (root) {
  'use strict';
  const CATEGORY_TERMS = {
    'lesson-planning': '备课教学', 'classroom-management': '班级管理', assessment: '成绩评价', research: '科研辅助',
    'data-processing': '数据处理', 'text-processing': '文本处理', 'ai-assistance': 'AI 辅助', general: '通用工具'
  };
  const SUBJECT_TERMS = {
    general: '全学科通用', language: '语文语言', mathematics: '数学', science: '科学理化生', humanities: '历史地理思政',
    arts: '音乐美术艺术', 'physical-education': '体育健康', 'information-technology': '信息科技'
  };
  function normalizeQuery(value) { return String(value || '').normalize('NFKC').trim().toLocaleLowerCase('zh-CN').replace(/\s+/g, ' '); }
  function compact(value) { return normalizeQuery(value).replace(/[\s\p{P}\p{S}]+/gu, ''); }
  function isSubsequence(needle, value) { let index = 0; for (const character of value) if (character === needle[index]) index += 1; return index === needle.length; }
  function editDistance(left, right) {
    const a = Array.from(left); const b = Array.from(right); let previous = b.map((_, index) => index + 1); previous.unshift(0);
    for (let row = 1; row <= a.length; row += 1) { const current = [row]; for (let column = 1; column <= b.length; column += 1) current[column] = Math.min(current[column - 1] + 1, previous[column] + 1, previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1)); previous = current; }
    return previous[b.length];
  }
  function hasApproximateSubstring(value, needle, threshold) {
    const characters = Array.from(value); const wanted = Array.from(needle).length;
    for (let length = Math.max(1, wanted - threshold); length <= wanted + threshold; length += 1) {
      for (let start = 0; start + length <= characters.length; start += 1) if (editDistance(characters.slice(start, start + length).join(''), needle) <= threshold) return true;
    }
    return false;
  }
  function fuzzyMatch(candidate, query) {
    const value = compact(candidate); const needle = compact(query); if (!needle) return true; if (value.includes(needle)) return true;
    if (needle.length >= 2 && isSubsequence(needle, value)) return true;
    const threshold = Array.from(needle).length >= 6 ? 2 : 1; return hasApproximateSubstring(value, needle, threshold);
  }
  function searchableFields(tool) { return [tool.name, tool.description, ...(tool.tags || []), CATEGORY_TERMS[tool.category] || tool.category, ...(tool.subjects || []).flatMap((id) => [id, SUBJECT_TERMS[id] || id])]; }
  function matchesTool(tool, query) { const tokens = normalizeQuery(query).split(' ').filter(Boolean); if (!tokens.length) return true; const fields = searchableFields(tool); return tokens.every((token) => fields.some((field) => fuzzyMatch(field, token))); }
  function filterTools(tools, options = {}) {
    const category = options.category || 'all'; const subject = options.subject || 'all'; const favorites = new Set(options.favorites || []);
    return tools.filter((tool) => matchesTool(tool, options.query) && (category === 'all' || tool.category === category) && (subject === 'all' || (tool.subjects || []).includes(subject)) && (!options.onlyFavorites || favorites.has(tool.id)));
  }
  function categoryCounts(tools) { return tools.reduce((counts, tool) => ({ ...counts, [tool.category]: (counts[tool.category] || 0) + 1 }), { all: tools.length }); }
  function subjectCounts(tools) { return tools.reduce((counts, tool) => { for (const subject of tool.subjects || []) counts[subject] = (counts[subject] || 0) + 1; return counts; }, { all: tools.length }); }
  const api = { CATEGORY_TERMS, SUBJECT_TERMS, normalizeQuery, fuzzyMatch, matchesTool, filterTools, categoryCounts, subjectCounts };
  root.OETSearch = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
