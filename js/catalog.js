(function (root) {
  'use strict';
  const CATEGORY_NAMES = {
    'lesson-planning': '备课教学', 'classroom-management': '班级管理', assessment: '成绩评价', research: '科研辅助',
    'data-processing': '数据处理', 'text-processing': '文本处理', 'ai-assistance': 'AI 辅助', general: '通用工具'
  };
  const SUBJECT_NAMES = {
    general: '通用', language: '语文与语言', mathematics: '数学', science: '科学', humanities: '人文社科',
    arts: '艺术', 'physical-education': '体育与健康', 'information-technology': '信息科技'
  };
  const ICON_LABELS = { 'user-search': '点', users: '组', timer: '时', 'text-clean': '文', chart: '数', handwriting: '写', volume: '音', clock: '钟', document: '档', image: '图', pdf: 'P', video: '视' };
  function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
  function createToolCard(tool, favoriteIds, onToggle, options) {
    const settings = options || {};
    const formatCount = typeof settings.formatCount === 'function' ? settings.formatCount : (value) => String(value);
    const stats = settings.stats ? (settings.stats[tool.id] || { uses: 0, favorites: 0 }) : null;
    const card = element('article', 'tool-card');
    card.setAttribute('data-reveal', '');
    const head = element('div', 'tool-card__head');
    const icon = element('span', 'tool-card__icon', ICON_LABELS[tool.icon] || '工'); icon.setAttribute('aria-hidden', 'true');
    const tools = element('div', 'tool-card__tools');
    const share = element('button', 'tool-card__share', '分享');
    share.type = 'button'; share.setAttribute('aria-label', `分享${tool.name}`);
    share.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); if (!root.OETToolPage) return; root.OETToolPage.openShareDialog({ url: new URL(tool.entry, location.href).href, title: tool.name, description: tool.description, toolId: tool.id }); });
    const favorite = element('button', 'favorite-button', favoriteIds.includes(tool.id) ? '★' : '☆');
    favorite.type = 'button'; favorite.dataset.toolId = tool.id; favorite.setAttribute('aria-pressed', String(favoriteIds.includes(tool.id)));
    favorite.setAttribute('aria-label', favoriteIds.includes(tool.id) ? `取消收藏${tool.name}` : `收藏${tool.name}`);
    favorite.addEventListener('click', () => onToggle(tool.id));
    tools.append(share, favorite);
    head.append(icon, tools);
    const title = element('h3', 'tool-card__title'); const link = element('a', '', tool.name); link.href = tool.entry; link.target = '_blank'; link.rel = 'noopener noreferrer'; title.append(link);
    const description = element('p', 'tool-card__description', tool.description);
    const meta = element('div', 'cluster'); meta.append(element('span', 'badge badge--category', CATEGORY_NAMES[tool.category] || tool.category));
    for (const subject of tool.subjects || []) meta.append(element('span', 'badge badge--subject', SUBJECT_NAMES[subject] || subject));
    for (const tag of tool.tags.slice(0, 3)) meta.append(element('span', 'badge', tag));
    const actions = element('div', 'tool-card__actions');
    const download = element('a', 'tool-card__download', '下载离线包'); download.href = `downloads/${tool.id}.zip`; download.download = `${tool.id}.zip`; download.setAttribute('aria-label', `下载${tool.name}离线包`);
    actions.append(download);
    const parts = [head, title, description, meta];
    if (stats) {
      const metrics = element('div', 'tool-card__metrics');
      const uses = element('span', 'tool-card__metric', `▶ ${formatCount(stats.uses)}`); uses.title = `被使用 ${stats.uses} 次`;
      const favorites = element('span', 'tool-card__metric', `♡ ${formatCount(stats.favorites)}`); favorites.title = `被收藏 ${stats.favorites} 次`;
      metrics.append(uses, favorites);
      parts.push(metrics);
    }
    parts.push(actions);
    card.append(...parts); return card;
  }
  function renderCards(container, tools, favoriteIds, onToggle, options) {
    container.replaceChildren(...tools.map((tool) => createToolCard(tool, favoriteIds, onToggle, options)));
    if (root.OETMotion && typeof root.OETMotion.observe === 'function') root.OETMotion.observe(container);
  }
  function renderPagination(container, view, onSelect) {
    if (!container) return;
    container.replaceChildren();
    container.hidden = !view || view.total === 0;
    if (!view || view.total === 0) return;
    const status = element('p', 'pagination__status', `第 ${view.page} / ${view.pageCount} 页 · 共 ${view.total} 个工具`);
    if (view.pageCount <= 1) { container.append(status); return; }
    const controls = element('div', 'pagination__controls');
    const pageList = root.OETCatalogView && typeof root.OETCatalogView.pageList === 'function' ? root.OETCatalogView.pageList : (page, count) => [page];
    function pageButton(label, page, settings) {
      const options = settings || {};
      const button = element('button', options.current ? 'pagination__button is-current' : 'pagination__button', label);
      button.type = 'button';
      button.disabled = Boolean(options.disabled);
      if (options.label) button.setAttribute('aria-label', options.label);
      if (options.current) button.setAttribute('aria-current', 'page');
      button.addEventListener('click', () => onSelect(page));
      return button;
    }
    controls.append(pageButton('上一页', view.page - 1, { disabled: view.page <= 1, label: '上一页' }));
    for (const item of pageList(view.page, view.pageCount)) {
      if (item === '…') { const gap = element('span', 'pagination__gap', '…'); gap.setAttribute('aria-hidden', 'true'); controls.append(gap); continue; }
      controls.append(pageButton(String(item), item, { current: item === view.page, label: `第 ${item} 页` }));
    }
    controls.append(pageButton('下一页', view.page + 1, { disabled: view.page >= view.pageCount, label: '下一页' }));
    container.append(status, controls);
  }
  const api = { CATEGORY_NAMES, SUBJECT_NAMES, createToolCard, renderCards, renderPagination };
  root.OETCatalog = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
