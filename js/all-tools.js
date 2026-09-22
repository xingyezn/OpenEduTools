(function (root) {
  'use strict';
  const state = { tools: [], ranked: [], stats: null, query: '', category: 'all', subject: 'all', onlyFavorites: false, page: 1 };
  const PAGE_SIZE = 9;
  function byId(id) { return document.getElementById(id); }
  function setMessage(message, kind = '') { const node = byId('catalog-status'); if (!node) return; node.textContent = message; node.dataset.kind = kind; node.hidden = !message; }
  function formatCount(value) { return root.OETFormat && root.OETFormat.formatCount ? root.OETFormat.formatCount(value) : String(value); }
  function cardOptions() { return { stats: state.stats && state.stats.tools ? state.stats.tools : null, formatCount }; }
  function initCatalog(data, stats) {
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.tools)) throw new Error('工具索引格式无效');
    state.tools = data.tools; state.stats = stats || null;
    const view = root.OETCatalogView;
    state.ranked = view ? view.rankTools(state.tools, view.buildPopularity(stats)) : state.tools.slice();
    const ids = state.tools.map((tool) => tool.id); let storage; try { storage = localStorage; } catch { storage = undefined; }
    const favorites = root.OETFavorites.createFavorites(storage);
    let favoriteIds = favorites.get(ids);
    const counts = root.OETSearch.categoryCounts(state.tools); const categoryContainer = byId('category-list');
    const categories = [['all', '全部'], ...Object.entries(root.OETCatalog.CATEGORY_NAMES).filter(([id]) => counts[id])];
    for (const [id, name] of categories) { const button = document.createElement('button'); button.type = 'button'; button.className = 'filter-button filter-button--block'; button.dataset.category = id; button.setAttribute('aria-pressed', String(id === 'all')); button.textContent = `${name} ${counts[id] || 0}`; button.addEventListener('click', () => { state.category = id; state.page = 1; categoryContainer.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === button))); render(); }); categoryContainer.append(button); }
    const subjectCounts = root.OETSearch.subjectCounts(state.tools); const subjectContainer = byId('subject-list');
    const subjects = [['all', '全部学科'], ...Object.entries(root.OETCatalog.SUBJECT_NAMES).filter(([id]) => subjectCounts[id])];
    for (const [id, name] of subjects) { const button = document.createElement('button'); button.type = 'button'; button.className = 'filter-button filter-button--subject'; button.dataset.subject = id; button.setAttribute('aria-pressed', String(id === 'all')); button.textContent = `${name} ${subjectCounts[id] || 0}`; button.addEventListener('click', () => { state.subject = id; state.page = 1; subjectContainer.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === button))); render(); }); subjectContainer.append(button); }
    const favoriteFilter = byId('favorite-filter'); favoriteFilter.addEventListener('click', () => { state.onlyFavorites = !state.onlyFavorites; state.page = 1; favoriteFilter.setAttribute('aria-pressed', String(state.onlyFavorites)); favoriteFilter.textContent = state.onlyFavorites ? '★ 仅看收藏' : '☆ 仅看收藏'; render(); });
    function toggleFavorite(id) { const result = favorites.toggle(id, ids); favoriteIds = result.value; if (favoriteIds.includes(id)) root.OpenEduAnalytics?.favoriteAdd?.(id); else root.OpenEduAnalytics?.favoriteRemove?.(id); root.OETToolPage.showToast(result.saved ? (favoriteIds.includes(id) ? '已收藏' : '已取消收藏') : '浏览器存储不可用，未能保存收藏'); render(); }
    function render(options) {
      const settings = options || {};
      const filtered = root.OETSearch.filterTools(state.ranked, { query: state.query, category: state.category, subject: state.subject, onlyFavorites: state.onlyFavorites, favorites: favoriteIds });
      const view = root.OETCatalogView.paginate(filtered, state.page, PAGE_SIZE); state.page = view.page;
      root.OETCatalog.renderCards(byId('tool-grid'), view.items, favoriteIds, toggleFavorite, cardOptions()); byId('result-count').textContent = `找到 ${filtered.length} 个工具`;
      root.OETCatalog.renderPagination(byId('catalog-pagination'), view, (page) => { state.page = page; render({ scroll: true }); });
      byId('catalog-empty').hidden = filtered.length !== 0; setMessage('');
      if (settings.scroll) scrollToCatalog();
    }
    function scrollToCatalog() { const target = byId('catalog-title'); if (!target || typeof target.scrollIntoView !== 'function') return; const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches; target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
    byId('tool-search').addEventListener('input', (event) => { state.query = event.target.value; state.page = 1; render(); });
    byId('clear-search').addEventListener('click', () => { byId('tool-search').value = ''; state.query = ''; state.category = 'all'; state.subject = 'all'; state.onlyFavorites = false; state.page = 1; favoriteFilter.setAttribute('aria-pressed', 'false'); favoriteFilter.textContent = '☆ 仅看收藏'; categoryContainer.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.category === 'all'))); subjectContainer.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.subject === 'all'))); render(); byId('tool-search').focus(); });
    render();
  }
  async function loadStats() { try { const response = await fetch('./data/stats.json', { cache: 'no-store' }); if (!response.ok) return null; return await response.json(); } catch { return null; } }
  async function init() {
    if (!byId('tool-grid')) return;
    try { const [toolsResponse, stats] = await Promise.all([fetch('./data/tools.json', { cache: 'no-store' }), loadStats()]); if (!toolsResponse.ok) throw new Error(`HTTP ${toolsResponse.status}`); initCatalog(await toolsResponse.json(), stats); }
    catch (error) { console.warn('无法加载工具索引：', error.message); setMessage(location.protocol === 'file:' ? '直接打开页面时浏览器可能阻止读取目录。请在仓库根目录运行静态服务器（例如 python -m http.server 8000），单个工具仍可直接打开使用。' : '工具目录暂时无法加载，请稍后刷新。', 'error'); const empty = byId('catalog-empty'); if (empty) empty.hidden = true; }
  }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init(); }
})(typeof globalThis !== 'undefined' ? globalThis : this);
