(function (root) {
  'use strict';
  const KEY = 'openEduTools:theme';
  const allowed = new Set(['system', 'light', 'dark']);
  const scriptUrl = typeof document !== 'undefined' ? document.currentScript?.src : '';
  if (scriptUrl && !document.querySelector('link[rel~="icon"]')) { const icon = document.createElement('link'); icon.rel = 'icon'; icon.type = 'image/svg+xml'; icon.href = new URL('../assets/icons/favicon.svg', scriptUrl).href; document.head.append(icon); }
  function safeGet() { try { const value = localStorage.getItem(KEY); return allowed.has(value) ? value : 'dark'; } catch { return 'dark'; } }
  function apply(value) { const theme = allowed.has(value) ? value : 'dark'; if (theme === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = theme; return theme; }
  function save(value) { const theme = apply(value); try { localStorage.setItem(KEY, theme); } catch { /* non-blocking */ } return theme; }
  function init() {
    const value = apply(safeGet());
    document.querySelectorAll('[data-theme-select]').forEach((select) => { select.value = value; select.addEventListener('change', () => save(select.value)); });
    document.querySelectorAll('.site-nav').forEach((nav) => {
      if (nav.querySelector('[data-github-link]')) return;
      const link = document.createElement('a'); link.href = 'https://github.com/xingyezn/OpenEduTools'; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.dataset.githubLink = ''; link.textContent = 'GitHub ↗';
      const themeField = nav.querySelector('.theme-field'); nav.insertBefore(link, themeField || null);
    });
  }
  root.OETTheme = { apply, save, safeGet };
  if (typeof document !== 'undefined') { apply(safeGet()); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init(); }
})(typeof globalThis !== 'undefined' ? globalThis : this);
