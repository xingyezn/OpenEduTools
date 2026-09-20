(function (root) {
  'use strict';
  const KEY = 'openEduTools:recent';
  function normalizeRecent(value, knownIds) {
    const known = knownIds ? new Set(knownIds) : null;
    const latest = new Map();
    if (Array.isArray(value)) for (const item of value) {
      if (!item || typeof item.id !== 'string' || !Number.isFinite(item.visitedAt) || (known && !known.has(item.id))) continue;
      if (!latest.has(item.id) || latest.get(item.id).visitedAt < item.visitedAt) latest.set(item.id, { id: item.id, visitedAt: item.visitedAt });
    }
    return [...latest.values()].sort((a, b) => b.visitedAt - a.visitedAt).slice(0, 10);
  }
  function createRecent(storage) {
    const store = root.OETStorage.createStorage(storage);
    function get(knownIds) { const clean = normalizeRecent(store.read(KEY, []), knownIds); store.write(KEY, clean); return clean; }
    function add(id, visitedAt = Date.now()) { const next = normalizeRecent([{ id, visitedAt }, ...get()]); return { value: next, saved: store.write(KEY, next) }; }
    function clear() { return store.remove(KEY); }
    return { get, add, clear };
  }
  const api = { KEY, normalizeRecent, createRecent };
  root.OETRecent = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
