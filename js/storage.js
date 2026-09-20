(function (root) {
  'use strict';
  function createStorage(storage) {
    function read(key, fallback) { try { const raw = storage.getItem(key); return raw === null ? fallback : JSON.parse(raw); } catch { return fallback; } }
    function write(key, value) { try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
    function remove(key) { try { storage.removeItem(key); return true; } catch { return false; } }
    return { read, write, remove };
  }
  const api = { createStorage };
  root.OETStorage = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
