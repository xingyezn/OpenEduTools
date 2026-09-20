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
  function validateDuration(value) {
    if (value === '' || value === null || value === undefined) throw new RangeError('请输入滚动时长');
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 10) throw new RangeError('滚动时长须在 0 到 10 秒之间');
    return Math.round(seconds * 1000);
  }
  const api = { parseNames, unbiasedIndex, drawCandidate, validateDuration };
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;

  const input = document.getElementById('names'); const dedupe = document.getElementById('dedupe'); const remove = document.getElementById('remove-picked'); const sound = document.getElementById('sound');
  const duration = document.getElementById('roll-duration'); const drawButton = document.getElementById('draw'); const status = document.getElementById('status'); const result = document.getElementById('result'); const count = document.getElementById('name-count');
  const controlled = [input, dedupe, remove, sound, duration];
  let pool = []; let sourceKey = ''; let rollTimer = 0; let finishTimer = 0; let audioContext;
  function current() { return parseNames(input.value, dedupe.checked); }
  function key() { return `${dedupe.checked}|${input.value}`; }
  function setStatus(message, kind = '') { status.textContent = message; status.dataset.kind = kind; }
  function updateCount() { count.textContent = `有效人数：${current().length}`; }
  function setBusy(busy) { controlled.forEach((control) => { control.disabled = busy; }); drawButton.disabled = busy; result.classList.toggle('is-rolling', busy); result.setAttribute('aria-busy', String(busy)); }
  function cancelRoll() { clearInterval(rollTimer); clearTimeout(finishTimer); rollTimer = 0; finishTimer = 0; setBusy(false); }
  function resetPool(announce = true) { cancelRoll(); pool = current(); sourceKey = key(); if (announce) setStatus(pool.length ? `候选池已重置，共 ${pool.length} 人。` : '请先输入至少一个姓名。', pool.length ? 'success' : 'error'); }
  function renderRolling(name) { result.replaceChildren(); const label = document.createElement('p'); label.className = 'muted'; label.textContent = '正在随机滚动'; const value = document.createElement('p'); value.className = 'big-result'; value.textContent = name; result.append(label, value); }
  function renderPicked(name) { result.replaceChildren(); const label = document.createElement('p'); label.className = 'reveal-label'; label.textContent = '本次抽中'; const value = document.createElement('p'); value.className = 'big-result'; value.textContent = name; const remaining = document.createElement('p'); remaining.textContent = remove.checked ? `候选池剩余 ${pool.length} 人` : `名单共 ${current().length} 人`; result.append(label, value, remaining); }
  function prepareAudio() {
    if (!sound.checked) return;
    try { const AudioContext = root.AudioContext || root.webkitAudioContext; if (!AudioContext) return; audioContext ||= new AudioContext(); if (audioContext.state === 'suspended') audioContext.resume(); } catch { audioContext = undefined; }
  }
  function playRevealSound() {
    if (!sound.checked || !audioContext) return;
    try {
      const start = audioContext.currentTime; const gain = audioContext.createGain(); gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42); gain.connect(audioContext.destination);
      [659.25, 880].forEach((frequency, index) => { const oscillator = audioContext.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.value = frequency; oscillator.connect(gain); oscillator.start(start + index * 0.1); oscillator.stop(start + 0.42); });
    } catch { /* 音效是可选增强，不影响点名结果。 */ }
  }
  function finishDraw(chosen) {
    clearInterval(rollTimer); rollTimer = 0;
    if (remove.checked) pool.splice(chosen.index, 1);
    setBusy(false); renderPicked(chosen.picked); result.setAttribute('aria-live', 'polite'); setStatus(`已抽中：${chosen.picked}`, 'success'); playRevealSound();
  }
  function startDraw() {
    if (finishTimer) return;
    if (sourceKey !== key()) resetPool(false);
    if (!pool.length) { setStatus(remove.checked && current().length ? '候选池已抽完，请重置候选池。' : '请先输入至少一个姓名。', 'error'); return; }
    let milliseconds;
    try { milliseconds = validateDuration(duration.value); duration.removeAttribute('aria-invalid'); } catch (error) { duration.setAttribute('aria-invalid', 'true'); setStatus(error.message, 'error'); duration.focus(); return; }
    prepareAudio(); const chosen = drawCandidate(pool); result.setAttribute('aria-live', 'off'); setBusy(true); setStatus(milliseconds ? '候选名单正在滚动…' : '正在抽取…'); renderRolling(pool[unbiasedIndex(pool.length)]);
    if (milliseconds === 0) { finishDraw(chosen); return; }
    rollTimer = setInterval(() => renderRolling(pool[unbiasedIndex(pool.length)]), 75);
    finishTimer = setTimeout(() => { finishTimer = 0; finishDraw(chosen); }, milliseconds);
  }
  drawButton.addEventListener('click', startDraw);
  document.getElementById('reset-pool').addEventListener('click', () => resetPool(true));
  document.getElementById('clear').addEventListener('click', () => { cancelRoll(); input.value = ''; pool = []; sourceKey = ''; result.replaceChildren(Object.assign(document.createElement('p'), { className: 'muted', textContent: '准备好名单后，点击“开始点名”。' })); updateCount(); setStatus('已清空，名单未被保存。', 'success'); input.focus(); });
  input.addEventListener('input', updateCount); dedupe.addEventListener('change', updateCount); updateCount();
})(typeof globalThis !== 'undefined' ? globalThis : this);
