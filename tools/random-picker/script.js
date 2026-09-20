(function (root) {
  'use strict';
  function parseNames(raw, dedupe = true) {
    const names = String(raw || '').split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
    return dedupe ? [...new Set(names)] : names;
  }
  function secureUint32() { if (root.crypto?.getRandomValues) { const values = new Uint32Array(1); root.crypto.getRandomValues(values); return values[0]; } return Math.floor(Math.random() * 0x100000000); }
  function unbiasedIndex(length, randomUint32 = secureUint32) {
    if (!Number.isInteger(length) || length < 1) throw new RangeError('候选人数必须大于 0');
    const range = 0x100000000; const limit = range - (range % length); let value;
    do { value = randomUint32(); } while (!Number.isInteger(value) || value < 0 || value >= limit);
    return value % length;
  }
  function drawCandidate(pool, randomUint32) { if (!Array.isArray(pool) || pool.length === 0) throw new RangeError('候选池为空'); const index = unbiasedIndex(pool.length, randomUint32); return { picked: pool[index], index }; }
  const api = { parseNames, unbiasedIndex, drawCandidate };
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;
  const input = document.getElementById('names'); const dedupe = document.getElementById('dedupe'); const remove = document.getElementById('remove-picked'); const status = document.getElementById('status'); const result = document.getElementById('result'); const count = document.getElementById('name-count');
  let pool = []; let sourceKey = '';
  function current() { return parseNames(input.value, dedupe.checked); }
  function key() { return `${dedupe.checked}|${input.value}`; }
  function setStatus(message, kind = '') { status.textContent = message; status.dataset.kind = kind; }
  function updateCount() { count.textContent = `有效人数：${current().length}`; }
  function resetPool(announce = true) { pool = current(); sourceKey = key(); if (announce) setStatus(pool.length ? `候选池已重置，共 ${pool.length} 人。` : '请先输入至少一个姓名。', pool.length ? 'success' : 'error'); }
  function renderPicked(name) { result.replaceChildren(); const label = document.createElement('p'); label.className = 'muted'; label.textContent = '本次抽中'; const value = document.createElement('p'); value.className = 'big-result'; value.textContent = name; const remaining = document.createElement('p'); remaining.textContent = remove.checked ? `候选池剩余 ${pool.length} 人` : `名单共 ${current().length} 人`; result.append(label, value, remaining); }
  document.getElementById('draw').addEventListener('click', () => {
    if (sourceKey !== key()) resetPool(false); if (!pool.length) { setStatus(remove.checked && current().length ? '候选池已抽完，请重置候选池。' : '请先输入至少一个姓名。', 'error'); return; }
    const chosen = drawCandidate(pool); if (remove.checked) pool.splice(chosen.index, 1); renderPicked(chosen.picked); setStatus(`已抽中：${chosen.picked}`, 'success');
  });
  document.getElementById('reset-pool').addEventListener('click', () => resetPool(true));
  document.getElementById('clear').addEventListener('click', () => { input.value = ''; pool = []; sourceKey = ''; result.replaceChildren(Object.assign(document.createElement('p'), { className: 'muted', textContent: '结果会显示在这里。' })); updateCount(); setStatus('已清空，名单未被保存。', 'success'); input.focus(); });
  input.addEventListener('input', updateCount); dedupe.addEventListener('change', updateCount); updateCount();
})(typeof globalThis !== 'undefined' ? globalThis : this);
