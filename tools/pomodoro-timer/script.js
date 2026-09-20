(function (root) {
  'use strict';
  const KEY = 'openEduTools:tool:pomodoro-timer:settings';

  function pad(value) { return String(value).padStart(2, '0'); }
  function formatClock(milliseconds) {
    const total = Math.max(0, Math.ceil(milliseconds / 1000));
    return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
  }
  function phaseDurationMs(settings, mode) {
    const minutes = mode === 'focus' ? settings.focus : (mode === 'short' ? settings.short : settings.long);
    return Math.max(1, Math.round(Number(minutes) || 1)) * 60000;
  }
  function nextMode(mode, completedFocus, rounds) {
    if (mode !== 'focus') return 'focus';
    const cycle = Math.max(1, Math.round(Number(rounds) || 1));
    return (completedFocus + 1) % cycle === 0 ? 'long' : 'short';
  }
  function remainingAt(state, now) {
    const elapsed = state.accumulated + (state.running ? Math.max(0, now - state.startedAt) : 0);
    return Math.max(0, state.duration - elapsed);
  }
  const api = { pad, formatClock, phaseDurationMs, nextMode, remainingAt };
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;

  const elements = Object.fromEntries(['focusMin', 'shortMin', 'longMin', 'rounds', 'autoStart', 'sound', 'status', 'phaseLabel', 'timerDisplay', 'completedCount', 'startBtn', 'skipBtn', 'resetBtn', 'fullscreenBtn', 'pomodoroStage'].map((id) => [id, document.getElementById(id)]));
  const settings = { focus: 25, short: 5, long: 15, rounds: 4, autoStart: true, sound: true };
  const state = { mode: 'focus', duration: 1500000, accumulated: 0, startedAt: 0, running: false, completed: 0 };
  const PHASE_LABEL = { focus: '专注', short: '短休息', long: '长休息' };
  let timer = 0;
  let audioContext;

  function setStatus(message, kind = '') { elements.status.textContent = message; elements.status.dataset.kind = kind; }
  function clampNumber(value, min, max, fallback) { const number = Math.round(Number(value)); return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback; }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* 存储不可用时忽略 */ } }
  function load() {
    try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && typeof saved === 'object') Object.assign(settings, saved); } catch { /* 忽略损坏数据 */ }
    settings.focus = clampNumber(settings.focus, 1, 180, 25);
    settings.short = clampNumber(settings.short, 1, 60, 5);
    settings.long = clampNumber(settings.long, 1, 120, 15);
    settings.rounds = clampNumber(settings.rounds, 1, 12, 4);
    elements.focusMin.value = String(settings.focus);
    elements.shortMin.value = String(settings.short);
    elements.longMin.value = String(settings.long);
    elements.rounds.value = String(settings.rounds);
    elements.autoStart.checked = settings.autoStart !== false;
    elements.sound.checked = settings.sound !== false;
  }
  function applySettings() {
    settings.focus = clampNumber(elements.focusMin.value, 1, 180, settings.focus);
    settings.short = clampNumber(elements.shortMin.value, 1, 60, settings.short);
    settings.long = clampNumber(elements.longMin.value, 1, 120, settings.long);
    settings.rounds = clampNumber(elements.rounds.value, 1, 12, settings.rounds);
    settings.autoStart = elements.autoStart.checked;
    settings.sound = elements.sound.checked;
    elements.focusMin.value = String(settings.focus);
    elements.shortMin.value = String(settings.short);
    elements.longMin.value = String(settings.long);
    elements.rounds.value = String(settings.rounds);
    persist();
    if (!state.running && state.accumulated === 0) state.duration = phaseDurationMs(settings, state.mode);
    render();
  }
  function render() {
    const remaining = state.running ? remainingAt(state, Date.now()) : Math.max(0, state.duration - state.accumulated);
    elements.timerDisplay.textContent = formatClock(remaining);
    elements.phaseLabel.textContent = PHASE_LABEL[state.mode];
    elements.completedCount.textContent = String(state.completed);
    elements.pomodoroStage.dataset.phase = state.mode;
    elements.startBtn.textContent = state.running ? '暂停' : (state.accumulated > 0 ? '继续' : '开始');
  }
  function playSound() {
    if (!settings.sound) return;
    try {
      const AudioContext = root.AudioContext || root.webkitAudioContext; if (!AudioContext) return;
      audioContext ||= new AudioContext(); if (audioContext.state === 'suspended') audioContext.resume();
      const start = audioContext.currentTime; const gain = audioContext.createGain();
      gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5); gain.connect(audioContext.destination);
      [587.33, 880].forEach((frequency, index) => { const oscillator = audioContext.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.value = frequency; oscillator.connect(gain); oscillator.start(start + index * 0.14); oscillator.stop(start + 0.5); });
    } catch { /* 音效是可选增强 */ }
  }
  function completePhase(skipped = false) {
    const finished = state.mode;
    const next = nextMode(finished, state.completed, settings.rounds);
    if (finished === 'focus' && !skipped) state.completed += 1;
    state.mode = next; state.duration = phaseDurationMs(settings, next); state.accumulated = 0; state.startedAt = Date.now(); state.running = settings.autoStart !== false;
    playSound();
    setStatus(`${PHASE_LABEL[finished]}结束，进入${PHASE_LABEL[next]}。`, 'success');
    render();
  }
  function tick() { if (!state.running) return; if (remainingAt(state, Date.now()) <= 0) { completePhase(); return; } render(); }
  function startPause() {
    if (state.running) {
      state.accumulated += Math.max(0, Date.now() - state.startedAt); state.running = false; setStatus('已暂停。', 'info');
    } else {
      state.startedAt = Date.now(); state.running = true; setStatus(`${PHASE_LABEL[state.mode]}中…`, 'success');
    }
    render();
  }
  function reset(announce = true) { state.completed = 0; state.mode = 'focus'; state.duration = phaseDurationMs(settings, 'focus'); state.accumulated = 0; state.startedAt = 0; state.running = false; if (announce) setStatus('已重置。', 'info'); render(); }
  function toggleFullscreen() {
    const stage = elements.pomodoroStage;
    try {
      if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen().catch(() => {}); }
      else if (stage.requestFullscreen) stage.requestFullscreen().catch(() => root.OETToolPage.showToast('无法进入全屏，可使用浏览器缩放。'));
      else root.OETToolPage.showToast('当前浏览器不支持全屏，可使用浏览器缩放。');
    } catch { root.OETToolPage.showToast('当前浏览器不支持全屏，可使用浏览器缩放。'); }
  }
  elements.startBtn.addEventListener('click', startPause);
  elements.skipBtn.addEventListener('click', () => completePhase(true));
  elements.resetBtn.addEventListener('click', () => reset(true));
  elements.fullscreenBtn.addEventListener('click', toggleFullscreen);
  ['focusMin', 'shortMin', 'longMin', 'rounds', 'autoStart', 'sound'].forEach((id) => elements[id].addEventListener('change', applySettings));
  document.addEventListener('fullscreenchange', () => { elements.fullscreenBtn.textContent = document.fullscreenElement ? '退出全屏' : '全屏'; });
  document.addEventListener('visibilitychange', render);
  load(); reset(false); render();
  timer = root.setInterval(tick, 250);
  root.addEventListener('beforeunload', () => root.clearInterval(timer));
})(typeof globalThis !== 'undefined' ? globalThis : this);
