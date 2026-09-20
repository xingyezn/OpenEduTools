(function (root) {
  'use strict';
  function showToast(message) {
    let toast = document.querySelector('[data-toast]');
    if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; toast.dataset.toast = ''; toast.setAttribute('role', 'status'); document.body.append(toast); }
    toast.textContent = message; toast.hidden = false; clearTimeout(showToast.timer); showToast.timer = setTimeout(() => { toast.hidden = true; }, 2600);
  }
  async function copyText(text) {
    try { if (!navigator.clipboard || !window.isSecureContext) throw new Error('clipboard unavailable'); await navigator.clipboard.writeText(text); showToast('已复制到剪贴板'); return true; }
    catch { showToast('无法自动复制，请手动选择并复制'); return false; }
  }
  function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
    const safeName = String(filename).replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '-').slice(0, 80) || 'download.txt';
    const url = URL.createObjectURL(new Blob([text], { type: mime })); const link = document.createElement('a'); link.href = url; link.download = safeName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); showToast('已开始下载');
  }
  function init() {
    const id = document.body.dataset.toolId; if (!id) return;
    const favoriteButton = document.querySelector('[data-tool-favorite]');
    let favorites;
    try { favorites = root.OETFavorites.createFavorites(localStorage); root.OETRecent.createRecent(localStorage).add(id); } catch { showToast('浏览器存储不可用，工具仍可正常使用'); }
    function sync() { if (!favoriteButton || !favorites) return; const active = favorites.get().includes(id); favoriteButton.textContent = active ? '★ 已收藏' : '☆ 收藏'; favoriteButton.setAttribute('aria-pressed', String(active)); }
    if (favoriteButton) favoriteButton.addEventListener('click', () => { const result = favorites?.toggle(id); sync(); showToast(result?.saved === false ? '收藏仅在本页有效，浏览器存储不可用' : (result?.value.includes(id) ? '已收藏' : '已取消收藏')); });
    sync();
  }
  const api = { showToast, copyText, downloadText };
  root.OETToolPage = api;
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init(); }
})(typeof globalThis !== 'undefined' ? globalThis : this);
