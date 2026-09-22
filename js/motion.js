(function (root) {
  'use strict';
  const REVEAL_SELECTOR = '[data-reveal]';
  let observer = null;

  function reducedMotion() {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function observe(scope) {
    if (!observer || typeof document === 'undefined') return;
    const parent = scope && scope.querySelectorAll ? scope : document;
    parent.querySelectorAll(`${REVEAL_SELECTOR}:not(.is-visible)`).forEach((node, index) => {
      if (!node.style.transitionDelay) node.style.transitionDelay = `${Math.min(index, 8) * 45}ms`;
      observer.observe(node);
    });
  }

  function watchScroll(update) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => { update(); ticking = false; });
    }, { passive: true });
    update();
  }

  function initHeader() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    watchScroll(() => { header.classList.toggle('is-scrolled', window.scrollY > 8); });
  }

  function initBackToTop() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'back-to-top';
    button.dataset.backToTop = '';
    button.setAttribute('aria-label', '返回顶部');
    button.textContent = '↑';
    button.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }); });
    document.body.append(button);
    watchScroll(() => { button.classList.toggle('is-visible', window.scrollY > 480); });
  }

  function init() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (!('IntersectionObserver' in window)) return;
    initHeader();
    initBackToTop();
    if (reducedMotion()) return;
    document.documentElement.classList.add('motion-ready');
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    observe(document);
  }

  const api = { observe, init, reducedMotion };
  root.OETMotion = api;
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init(); }
})(typeof globalThis !== 'undefined' ? globalThis : this);
