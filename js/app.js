(function (root) {
  'use strict';
  const state = { tools: [], query: '', category: 'all', subject: 'all', onlyFavorites: false };
  function byId(id) { return document.getElementById(id); }
  function setMessage(message, kind = '') { const node = byId('catalog-status'); node.textContent = message; node.dataset.kind = kind; node.hidden = !message; }
  function initCatalog(data) {
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.tools)) throw new Error('工具索引格式无效');
    state.tools = data.tools; const ids = state.tools.map((tool) => tool.id); let storage; try { storage = localStorage; } catch { storage = undefined; } const favorites = root.OETFavorites.createFavorites(storage); const recent = root.OETRecent.createRecent(storage);
    let favoriteIds = favorites.get(ids);
    const counts = root.OETSearch.categoryCounts(state.tools); const categoryContainer = byId('category-list');
    const categories = [['all', '全部'], ...Object.entries(root.OETCatalog.CATEGORY_NAMES).filter(([id]) => counts[id])];
    for (const [id, name] of categories) { const button = document.createElement('button'); button.type = 'button'; button.className = 'filter-button'; button.dataset.category = id; button.setAttribute('aria-pressed', String(id === 'all')); button.textContent = `${name} ${counts[id] || 0}`; button.addEventListener('click', () => { state.category = id; categoryContainer.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === button))); render(); }); categoryContainer.append(button); }
    const subjectCounts = root.OETSearch.subjectCounts(state.tools); const subjectContainer = byId('subject-list');
    const subjects = [['all', '全部学科'], ...Object.entries(root.OETCatalog.SUBJECT_NAMES).filter(([id]) => subjectCounts[id])];
    for (const [id, name] of subjects) { const button = document.createElement('button'); button.type = 'button'; button.className = 'filter-button filter-button--subject'; button.dataset.subject = id; button.setAttribute('aria-pressed', String(id === 'all')); button.textContent = `${name} ${subjectCounts[id] || 0}`; button.addEventListener('click', () => { state.subject = id; subjectContainer.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === button))); render(); }); subjectContainer.append(button); }
    const favoriteFilter = byId('favorite-filter'); favoriteFilter.addEventListener('click', () => { state.onlyFavorites = !state.onlyFavorites; favoriteFilter.setAttribute('aria-pressed', String(state.onlyFavorites)); favoriteFilter.textContent = state.onlyFavorites ? '★ 仅看收藏' : '☆ 仅看收藏'; render(); });
    function toggleFavorite(id) { const result = favorites.toggle(id, ids); favoriteIds = result.value; root.OETToolPage.showToast(result.saved ? (favoriteIds.includes(id) ? '已收藏' : '已取消收藏') : '浏览器存储不可用，未能保存收藏'); render(); }
    function render() {
      const filtered = root.OETSearch.filterTools(state.tools, { query: state.query, category: state.category, subject: state.subject, onlyFavorites: state.onlyFavorites, favorites: favoriteIds });
      root.OETCatalog.renderCards(byId('tool-grid'), filtered, favoriteIds, toggleFavorite); byId('result-count').textContent = `找到 ${filtered.length} 个工具`;
      byId('catalog-empty').hidden = filtered.length !== 0; setMessage('');
      const recentItems = recent.get(ids).map((item) => state.tools.find((tool) => tool.id === item.id)).filter(Boolean).slice(0, 3); const section = byId('recent-section'); section.hidden = recentItems.length === 0; root.OETCatalog.renderCards(byId('recent-grid'), recentItems, favoriteIds, toggleFavorite);
    }
    byId('tool-search').addEventListener('input', (event) => { state.query = event.target.value; render(); });
    byId('clear-search').addEventListener('click', () => { byId('tool-search').value = ''; state.query = ''; state.category = 'all'; state.subject = 'all'; state.onlyFavorites = false; favoriteFilter.setAttribute('aria-pressed', 'false'); favoriteFilter.textContent = '☆ 仅看收藏'; categoryContainer.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.category === 'all'))); subjectContainer.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.subject === 'all'))); render(); byId('tool-search').focus(); });
    byId('clear-recent').addEventListener('click', () => { recent.clear(); render(); root.OETToolPage.showToast('已清除最近使用'); });
    render();
  }
  async function init() {
    if (!byId('tool-grid')) return;
    try { const response = await fetch('./data/tools.json', { cache: 'no-store' }); if (!response.ok) throw new Error(`HTTP ${response.status}`); initCatalog(await response.json()); }
    catch (error) { console.warn('无法加载工具索引：', error.message); setMessage(location.protocol === 'file:' ? '直接打开首页时浏览器可能阻止读取目录。请在仓库根目录运行静态服务器（例如 python -m http.server 8000），单个工具仍可直接打开使用。' : '工具目录暂时无法加载，请稍后刷新或从导航访问项目说明。', 'error'); byId('catalog-empty').hidden = true; }
  }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init(); }
})(typeof globalThis !== 'undefined' ? globalThis : this);
