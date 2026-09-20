(function (root) {
  'use strict';
  const CATEGORY_NAMES = {
    'lesson-planning': '备课教学', 'classroom-management': '班级管理', assessment: '成绩评价', research: '科研辅助',
    'data-processing': '数据处理', 'text-processing': '文本处理', 'ai-assistance': 'AI 辅助', general: '通用工具'
  };
  const ICON_LABELS = { 'user-search': '点', users: '组', timer: '时', 'text-clean': '文', chart: '数' };
  function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
  function createToolCard(tool, favoriteIds, onToggle) {
    const card = element('article', 'tool-card');
    const head = element('div', 'tool-card__head');
    const icon = element('span', 'tool-card__icon', ICON_LABELS[tool.icon] || '工'); icon.setAttribute('aria-hidden', 'true');
    const favorite = element('button', 'favorite-button', favoriteIds.includes(tool.id) ? '★' : '☆');
    favorite.type = 'button'; favorite.dataset.toolId = tool.id; favorite.setAttribute('aria-pressed', String(favoriteIds.includes(tool.id)));
    favorite.setAttribute('aria-label', favoriteIds.includes(tool.id) ? `取消收藏${tool.name}` : `收藏${tool.name}`);
    favorite.addEventListener('click', () => onToggle(tool.id));
    head.append(icon, favorite);
    const title = element('h3', 'tool-card__title'); const link = element('a', '', tool.name); link.href = tool.entry; title.append(link);
    const description = element('p', 'tool-card__description', tool.description);
    const meta = element('div', 'cluster'); meta.append(element('span', 'badge', CATEGORY_NAMES[tool.category] || tool.category));
    for (const tag of tool.tags.slice(0, 3)) meta.append(element('span', 'badge', tag));
    card.append(head, title, description, meta); return card;
  }
  function renderCards(container, tools, favoriteIds, onToggle) { container.replaceChildren(...tools.map((tool) => createToolCard(tool, favoriteIds, onToggle))); }
  const api = { CATEGORY_NAMES, createToolCard, renderCards };
  root.OETCatalog = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
