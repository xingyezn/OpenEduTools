(function (root) {
  'use strict';
  const KEY = 'openEduTools:tool:noise-meter:settings';

  function computeRms(bytes) {
    if (!bytes || !bytes.length) return 0;
    let sum = 0;
    for (let index = 0; index < bytes.length; index += 1) { const sample = (bytes[index] - 128) / 128; sum += sample * sample; }
    return Math.sqrt(sum / bytes.length);
  }
  function rmsToLevel(rms) {
    if (!(rms > 0)) return 0;
    const decibels = 20 * Math.log10(Math.min(rms, 1));
    return Math.max(0, Math.min(100, Math.round(((decibels + 60) / 60) * 100)));
  }
  const api = { computeRms, rmsToLevel };
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;

  const elements = Object.fromEntries(['threshold', 'startBtn', 'stopBtn', 'resetPeakBtn', 'status', 'levelValue', 'meterFill', 'thresholdMark', 'peakValue', 'noiseState', 'fullscreenBtn', 'meterStage'].map((id) => [id, document.getElementById(id)]));
  const state = { running: false, audioContext: null, analyser: null, stream: null, raf: 0, buffer: null, peak: 0, smooth: 0, threshold: 60, loud: false };

  function setStatus(message, kind = '') { elements.status.textContent = message; elements.status.dataset.kind = kind; }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify({ threshold: state.threshold })); } catch { /* 存储不可用时忽略 */ } }
  function load() {
    try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && Number.isFinite(saved.threshold)) state.threshold = Math.max(1, Math.min(100, Math.round(saved.threshold))); } catch { /* 忽略损坏数据 */ }
    elements.threshold.value = String(state.threshold); updateThresholdUI();
  }
  function updateThresholdUI() { elements.thresholdMark.style.left = `${state.threshold}%`; }
  function zone(level) { if (level >= state.threshold) return 'loud'; if (level >= state.threshold * 0.66) return 'warn'; return 'quiet'; }
  function render(level) {
    elements.levelValue.textContent = String(level);
    elements.meterFill.style.width = `${level}%`;
    elements.noiseState.textContent = state.loud ? '太吵了' : (state.running ? '测量中' : '待机');
    elements.meterStage.dataset.state = state.loud ? 'loud' : (state.running ? zone(level) : 'idle');
  }
  function loop() {
    if (!state.running) return;
    state.analyser.getByteTimeDomainData(state.buffer);
    const level = rmsToLevel(computeRms(state.buffer));
    state.smooth = state.smooth * 0.75 + level * 0.25;
    const shown = Math.round(state.smooth);
    state.peak = Math.max(state.peak, shown);
    elements.peakValue.textContent = String(state.peak);
    state.loud = shown >= state.threshold;
    render(shown);
    state.raf = root.requestAnimationFrame(loop);
  }
  async function start() {
    if (state.running) return;
    if (!root.isSecureContext) { setStatus('麦克风需要 https 或 localhost 环境；请通过线上地址或本地服务器打开。', 'error'); return; }
    if (!root.navigator?.mediaDevices?.getUserMedia) { setStatus('当前浏览器不支持麦克风采集。', 'error'); return; }
    try {
      state.stream = await root.navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const AudioContext = root.AudioContext || root.webkitAudioContext;
      state.audioContext = new AudioContext();
      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = 2048;
      state.buffer = new Uint8Array(state.analyser.fftSize);
      state.audioContext.createMediaStreamSource(state.stream).connect(state.analyser);
      state.running = true; state.smooth = 0; state.peak = 0; state.loud = false;
      elements.startBtn.disabled = true; elements.stopBtn.disabled = false; elements.peakValue.textContent = '0';
      setStatus('测量中：请保持环境自然，数值会随音量变化。', 'success');
      render(0); loop();
    } catch (error) {
      const messages = { NotAllowedError: '麦克风权限被拒绝，请在浏览器地址栏允许后重试。', NotFoundError: '没有找到可用的麦克风设备。', NotReadableError: '麦克风被其他程序占用，请关闭后重试。' };
      setStatus(messages[error.name] || `无法开始测量：${error.message}`, 'error');
    }
  }
  function stop() {
    state.running = false;
    if (state.raf) root.cancelAnimationFrame(state.raf); state.raf = 0;
    if (state.stream) state.stream.getTracks().forEach((track) => track.stop());
    if (state.audioContext) state.audioContext.close();
    state.stream = null; state.audioContext = null; state.analyser = null;
    elements.startBtn.disabled = false; elements.stopBtn.disabled = true;
    setStatus('已停止测量，麦克风已释放。', 'info');
    state.loud = false; render(0);
  }
  function toggleFullscreen() {
    const stage = elements.meterStage;
    try {
      if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen().catch(() => {}); }
      else if (stage.requestFullscreen) stage.requestFullscreen().catch(() => root.OETToolPage.showToast('无法进入全屏，可使用浏览器缩放。'));
      else root.OETToolPage.showToast('当前浏览器不支持全屏，可使用浏览器缩放。');
    } catch { root.OETToolPage.showToast('当前浏览器不支持全屏，可使用浏览器缩放。'); }
  }
  elements.startBtn.addEventListener('click', start);
  elements.stopBtn.addEventListener('click', stop);
  elements.resetPeakBtn.addEventListener('click', () => { state.peak = 0; elements.peakValue.textContent = '0'; setStatus('峰值已重置。', 'info'); });
  elements.threshold.addEventListener('input', (event) => { const value = Number(event.target.value); if (Number.isFinite(value)) { state.threshold = Math.max(1, Math.min(100, Math.round(value))); updateThresholdUI(); persist(); } });
  elements.threshold.addEventListener('change', () => { elements.threshold.value = String(state.threshold); });
  elements.fullscreenBtn.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => { elements.fullscreenBtn.textContent = document.fullscreenElement ? '退出全屏' : '全屏'; });
  root.addEventListener('beforeunload', () => { if (state.running) stop(); });
  load(); render(0);
})(typeof globalThis !== 'undefined' ? globalThis : this);
