(function (root) {
  'use strict';
  const state = { tools: [], query: '', category: 'all', subject: 'all', onlyFavorites: false, stats: null };
  function byId(id) { return document.getElementById(id); }
  function setMessage(message, kind = '') { const node = byId('catalog-status'); node.textContent = message; node.dataset.kind = kind; node.hidden = !message; }
  function initCatalog(data, stats) {
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.tools)) throw new Error('工具索引格式无效');
    state.tools = data.tools; state.stats = stats || null; const ids = state.tools.map((tool) => tool.id); let storage; try { storage = localStorage; } catch { storage = undefined; } const favorites = root.OETFavorites.createFavorites(storage); const recent = root.OETRecent.createRecent(storage);
    let favoriteIds = favorites.get(ids);
    const counts = root.OETSearch.categoryCounts(state.tools); const categoryContainer = byId('category-list');
    const categories = [['all', '全部'], ...Object.entries(root.OETCatalog.CATEGORY_NAMES).filter(([id]) => counts[id])];
    for (const [id, name] of categories) { const button = document.createElement('button'); button.type = 'button'; button.className = 'filter-button'; button.dataset.category = id; button.setAttribute('aria-pressed', String(id === 'all')); button.textContent = `${name} ${counts[id] || 0}`; button.addEventListener('click', () => { state.category = id; categoryContainer.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === button))); render(); }); categoryContainer.append(button); }
    const subjectCounts = root.OETSearch.subjectCounts(state.tools); const subjectContainer = byId('subject-list');
    const subjects = [['all', '全部学科'], ...Object.entries(root.OETCatalog.SUBJECT_NAMES).filter(([id]) => subjectCounts[id])];
    for (const [id, name] of subjects) { const button = document.createElement('button'); button.type = 'button'; button.className = 'filter-button filter-button--subject'; button.dataset.subject = id; button.setAttribute('aria-pressed', String(id === 'all')); button.textContent = `${name} ${subjectCounts[id] || 0}`; button.addEventListener('click', () => { state.subject = id; subjectContainer.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === button))); render(); }); subjectContainer.append(button); }
    const favoriteFilter = byId('favorite-filter'); favoriteFilter.addEventListener('click', () => { state.onlyFavorites = !state.onlyFavorites; favoriteFilter.setAttribute('aria-pressed', String(state.onlyFavorites)); favoriteFilter.textContent = state.onlyFavorites ? '★ 仅看收藏' : '☆ 仅看收藏'; render(); });
    function toggleFavorite(id) { const result = favorites.toggle(id, ids); favoriteIds = result.value; if (favoriteIds.includes(id)) root.OpenEduAnalytics?.favoriteAdd?.(id); else root.OpenEduAnalytics?.favoriteRemove?.(id); root.OETToolPage.showToast(result.saved ? (favoriteIds.includes(id) ? '已收藏' : '已取消收藏') : '浏览器存储不可用，未能保存收藏'); render(); }
    function render() {
      const filtered = root.OETSearch.filterTools(state.tools, { query: state.query, category: state.category, subject: state.subject, onlyFavorites: state.onlyFavorites, favorites: favoriteIds });
      root.OETCatalog.renderCards(byId('tool-grid'), filtered, favoriteIds, toggleFavorite, cardOptions()); byId('result-count').textContent = `找到 ${filtered.length} 个工具`;
      byId('catalog-empty').hidden = filtered.length !== 0; setMessage('');
      const recentItems = recent.get(ids).map((item) => state.tools.find((tool) => tool.id === item.id)).filter(Boolean).slice(0, 3); const section = byId('recent-section'); section.hidden = recentItems.length === 0; root.OETCatalog.renderCards(byId('recent-grid'), recentItems, favoriteIds, toggleFavorite, cardOptions());
    }
    byId('tool-search').addEventListener('input', (event) => { state.query = event.target.value; render(); });
    byId('clear-search').addEventListener('click', () => { byId('tool-search').value = ''; state.query = ''; state.category = 'all'; state.subject = 'all'; state.onlyFavorites = false; favoriteFilter.setAttribute('aria-pressed', 'false'); favoriteFilter.textContent = '☆ 仅看收藏'; categoryContainer.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.category === 'all'))); subjectContainer.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.subject === 'all'))); render(); byId('tool-search').focus(); });
    byId('clear-recent').addEventListener('click', () => { recent.clear(); render(); root.OETToolPage.showToast('已清除最近使用'); });
    render();
    renderSiteStats(stats);
    renderRankings(stats);
  }
  function formatCount(value) { return root.OETFormat && root.OETFormat.formatCount ? root.OETFormat.formatCount(value) : String(value); }
  function cardOptions() { return { stats: state.stats && state.stats.tools ? state.stats.tools : null, formatCount }; }
  function renderSiteStats(stats) {
    const section = byId('stats-section'); if (!section) return;
    const toolCount = byId('stat-tools'); if (toolCount) toolCount.textContent = String(state.tools.length);
    const hero = byId('hero-tool-count'); if (hero) hero.textContent = `${state.tools.length} 个教学微工具`;
    const summary = stats && stats.summary ? stats.summary : null;
    if (summary && Number(summary.total_uses) > 0) { byId('stat-uses').textContent = formatCount(summary.total_uses); byId('stat-uses-item').hidden = false; }
    if (summary && Number(summary.total_favorites) > 0) { byId('stat-favorites').textContent = formatCount(summary.total_favorites); byId('stat-favorites-item').hidden = false; }
    section.hidden = false;
  }
  function renderRankings(stats) {
    const section = byId('rankings-section'); if (!section || !stats) return;
    const rankings = stats.rankings || {};
    const week = rankings.last_7_days && Array.isArray(rankings.last_7_days.most_used) ? rankings.last_7_days.most_used : [];
    const favorites = rankings.all_time && Array.isArray(rankings.all_time.most_favorited) ? rankings.all_time.most_favorited : [];
    const byIdMap = new Map(state.tools.map((tool) => [tool.id, tool]));
    const tools = stats.tools || {};
    function fill(listId, ids, metric) {
      const list = byId(listId); if (!list) return;
      const items = ids.map((id) => byIdMap.get(id)).filter(Boolean).slice(0, 5);
      list.replaceChildren(...items.map((tool, index) => {
        const item = document.createElement('li'); item.className = 'ranking-item';
        const rank = document.createElement('span'); rank.className = 'ranking-item__rank'; rank.textContent = String(index + 1);
        const link = document.createElement('a'); link.className = 'ranking-item__name'; link.href = tool.entry; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = tool.name;
        item.append(rank, link);
        const value = metric ? metric(tools[tool.id]) : null;
        if (value !== null && value !== undefined) { const count = document.createElement('span'); count.className = 'ranking-item__count'; count.textContent = formatCount(value); item.append(count); }
        return item;
      }));
    }
    fill('ranking-week', week, null);
    fill('ranking-favorites', favorites, (entry) => (entry ? entry.favorites : 0));
    const updated = byId('stats-updated'); if (updated) { const date = stats.updated_at ? new Date(stats.updated_at) : null; updated.textContent = date && !Number.isNaN(date.valueOf()) ? `更新于 ${date.toLocaleString()}` : ''; }
    section.hidden = week.length === 0 && favorites.length === 0;
  }
  async function loadStats() { try { const response = await fetch('./data/stats.json', { cache: 'no-store' }); if (!response.ok) return null; return await response.json(); } catch { return null; } }
  async function init() {
    if (!byId('tool-grid')) return;
    try { const [toolsResponse, stats] = await Promise.all([fetch('./data/tools.json', { cache: 'no-store' }), loadStats()]); if (!toolsResponse.ok) throw new Error(`HTTP ${toolsResponse.status}`); initCatalog(await toolsResponse.json(), stats); }
    catch (error) { console.warn('无法加载工具索引：', error.message); setMessage(location.protocol === 'file:' ? '直接打开首页时浏览器可能阻止读取目录。请在仓库根目录运行静态服务器（例如 python -m http.server 8000），单个工具仍可直接打开使用。' : '工具目录暂时无法加载，请稍后刷新或从导航访问项目说明。', 'error'); byId('catalog-empty').hidden = true; }
  }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init(); }
})(typeof globalThis !== 'undefined' ? globalThis : this);
