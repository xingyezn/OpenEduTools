(function (root) {
  'use strict';
  function parseNames(raw, dedupe = true) {
    const names = String(raw || '').split(/[\s,，、;；/]+/).map((name) => name.trim()).filter(Boolean);
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

  const input = document.getElementById('names'); const dedupe = document.getElementById('remove-picked'); const sound = document.getElementById('sound');
  const duration = document.getElementById('roll-duration'); const drawButton = document.getElementById('draw'); const status = document.getElementById('status'); const display = document.getElementById('display');
  const stats = document.getElementById('stats'); const count = document.getElementById('name-count');
  const settingsToggle = document.getElementById('settings-toggle'); const panel = document.getElementById('settings-panel'); const applyButton = document.getElementById('apply-names');
  const controlled = [input, dedupe, sound, duration];
  let pool = []; let picked = []; let sourceKey = ''; let rolling = false; let busy = false; let rollTimer = 0; let finishTimer = 0; let autoTimer = 0; let audioContext;

  function currentNames() { return parseNames(input.value, dedupe.checked); }
  function sourceSignature() { return `${dedupe.checked}|${input.value}`; }
  function getPool() { const names = currentNames(); return dedupe.checked ? names.filter((name) => !picked.includes(name)) : names; }
  function setStatus(message, kind = '') { status.textContent = message; status.dataset.kind = kind; }
  function updateCount() { count.textContent = `有效人数：${currentNames().length}`; }
  function updateStats() {
    const total = currentNames().length;
    if (!total) { stats.textContent = '还没有名单，点击右上角设置'; return; }
    const used = currentNames().filter((name) => picked.includes(name)).length;
    stats.textContent = `共 ${total} 人 ｜ 已点 ${used} 人 ｜ 剩余 ${Math.max(total - used, 0)} 人`;
  }
  function setRollingUI(active) {
    drawButton.textContent = active ? '停 止' : '开 始';
    drawButton.classList.toggle('is-stop', active);
    display.classList.toggle('is-rolling', active);
  }
  function cancelTimers() { clearTimeout(rollTimer); clearTimeout(finishTimer); clearTimeout(autoTimer); rollTimer = 0; finishTimer = 0; autoTimer = 0; }
  function resetPool(announce = true) {
    cancelTimers(); rolling = false; busy = false; picked = []; pool = currentNames(); sourceKey = sourceSignature();
    setRollingUI(false); drawButton.disabled = false; display.textContent = '准备开始'; display.classList.remove('is-result', 'is-rolling');
    updateStats(); updateCount();
    if (announce) setStatus(pool.length ? `候选池已重置，共 ${pool.length} 人。` : '请先点击右上角设置名单。', pool.length ? 'success' : 'error');
  }
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
  function complete(name) {
    if (!picked.includes(name)) picked.push(name);
    cancelTimers(); rolling = false; busy = false;
    display.textContent = name; display.classList.remove('is-rolling', 'is-result'); void display.offsetWidth; display.classList.add('is-result');
    drawButton.disabled = false; setRollingUI(false);
    updateStats();
    setStatus(`已抽中：${name}`, 'success');
    playRevealSound();
    if (dedupe.checked && getPool().length === 0) { setStatus(`已抽中：${name}，全部同学都点过啦，点击「重置」可重新开始。`, 'success'); }
  }
  function stopRoll() {
    if (!rolling) return;
    rolling = false; busy = true; cancelTimers();
    drawButton.disabled = true; display.classList.remove('is-rolling');
    const chosen = drawCandidate(pool.length ? pool : currentNames());
    const delays = [70, 90, 115, 145, 185, 235, 300, 380, 480, 600]; let index = 0;
    const step = () => {
      const candidates = getPool(); const list = candidates.length ? candidates : currentNames();
      display.textContent = list.length ? list[unbiasedIndex(list.length)] : chosen.picked;
      if (index >= delays.length) { complete(chosen.picked); return; }
      const delay = delays[index]; index += 1; finishTimer = setTimeout(step, delay);
    };
    step();
  }
  function startRoll() {
    if (busy) return;
    if (rolling) { stopRoll(); return; }
    if (!currentNames().length) { setStatus('请先点击右上角设置名单。', 'error'); openPanel(true); return; }
    if (sourceKey !== sourceSignature()) resetPool(false);
    const candidates = getPool();
    if (!candidates.length) { setStatus('全部同学都被点过啦，点击「重置」重新开始。', 'error'); return; }
    let milliseconds;
    try { milliseconds = validateDuration(duration.value); duration.removeAttribute('aria-invalid'); } catch (error) { duration.setAttribute('aria-invalid', 'true'); setStatus(error.message, 'error'); duration.focus(); return; }
    prepareAudio();
    const chosen = drawCandidate(candidates);
    if (milliseconds === 0) { complete(chosen.picked); return; }
    rolling = true; setRollingUI(true);
    const loop = () => { if (!rolling) return; const list = getPool(); if (!list.length) { stopRoll(); return; } display.textContent = list[unbiasedIndex(list.length)]; rollTimer = setTimeout(loop, 55); };
    loop();
    autoTimer = setTimeout(stopRoll, milliseconds);
  }
  function openPanel(open) {
    panel.hidden = !open; settingsToggle.setAttribute('aria-expanded', String(open));
    if (open) { updateCount(); input.focus(); }
  }
  drawButton.addEventListener('click', startRoll);
  document.getElementById('reset-pool').addEventListener('click', () => { resetPool(false); setStatus('已重置。', 'success'); });
  settingsToggle.addEventListener('click', () => openPanel(panel.hidden));
  applyButton.addEventListener('click', () => { resetPool(false); setStatus(`名单已应用，共 ${currentNames().length} 人。`, 'success'); openPanel(false); });
  input.addEventListener('input', updateCount);
  dedupe.addEventListener('change', () => { updateCount(); updateStats(); });
  document.addEventListener('keydown', (event) => {
    const tag = (event.target.tagName || '').toUpperCase();
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(tag)) return;
    if (event.code === 'Space' || event.code === 'Enter' || event.keyCode === 32 || event.keyCode === 13) { event.preventDefault(); startRoll(); }
  });
  resetPool(false); updateCount();
})(typeof globalThis !== 'undefined' ? globalThis : this);
