(function (root) {
  'use strict';
  const KEY = 'openEduTools:favorites';
  function normalizeFavorites(value, knownIds) {
    const known = knownIds ? new Set(knownIds) : null;
    return [...new Set(Array.isArray(value) ? value.filter((id) => typeof id === 'string' && (!known || known.has(id))) : [])];
  }
  function createFavorites(storage) {
    const store = root.OETStorage.createStorage(storage);
    function get(knownIds) { const clean = normalizeFavorites(store.read(KEY, []), knownIds); store.write(KEY, clean); return clean; }
    function set(ids) { const clean = normalizeFavorites(ids); return { value: clean, saved: store.write(KEY, clean) }; }
    function toggle(id, knownIds) { const items = get(knownIds); const next = items.includes(id) ? items.filter((item) => item !== id) : [...items, id]; return set(next); }
    return { get, set, toggle };
  }
  const api = { KEY, normalizeFavorites, createFavorites };
  root.OETFavorites = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
