(function (root) {
  'use strict';
  function durationFromParts(hours, minutes, seconds) {
    const values = [hours, minutes, seconds].map(Number);
    if (values.some((value) => !Number.isInteger(value) || value < 0) || values[0] > 99 || values[1] > 59 || values[2] > 59) throw new Error('请输入有效时间：分钟和秒为 0–59，小时为 0–99。');
    return ((values[0] * 60 + values[1]) * 60 + values[2]) * 1000;
  }
  function displayMilliseconds(milliseconds) { const total = Math.max(0, Math.ceil(milliseconds / 1000)); const hours = Math.floor(total / 3600); const minutes = Math.floor((total % 3600) / 60); const seconds = total % 60; return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':'); }
  function elapsedAt(state, now) { return state.accumulated + (state.running ? Math.max(0, now - state.startedAt) : 0); }
  function valueAt(state, now) { const elapsed = elapsedAt(state, now); return state.mode === 'countdown' ? Math.max(0, state.duration - elapsed) : elapsed; }
  const api = { durationFromParts, displayMilliseconds, elapsedAt, valueAt };
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;
  const elements = Object.fromEntries(['mode','hours','minutes','seconds','sound','status','display','finished','start','pause','reset','fullscreen','timer-stage'].map((id) => [id, document.getElementById(id)]));
  let state = { mode: 'countdown', duration: 300000, accumulated: 0, startedAt: 0, running: false, finished: false }; let ticker = null;
  function setStatus(message, kind = '') { elements.status.textContent = message; elements.status.dataset.kind = kind; }
  function selectedDuration() { return durationFromParts(elements.hours.value, elements.minutes.value, elements.seconds.value); }
  function beep() { if (!elements.sound.checked) return; try { const AudioContext = root.AudioContext || root.webkitAudioContext; const context = new AudioContext(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = 660; gain.gain.value = 0.08; oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.35); oscillator.addEventListener('ended', () => context.close()); } catch { setStatus('时间到；当前浏览器无法播放提示音。', 'error'); } }
  function finish() { state.running = false; state.accumulated = state.duration; state.finished = true; clearInterval(ticker); ticker = null; elements.finished.hidden = false; elements.start.textContent = '重新开始'; elements.start.disabled = false; elements.pause.disabled = true; setStatus('时间到。', 'success'); beep(); }
  function render() { const now = Date.now(); const value = valueAt(state, now); elements.display.value = displayMilliseconds(value); elements.display.textContent = elements.display.value; if (state.running && state.mode === 'countdown' && value <= 0) finish(); }
  function reset() { clearInterval(ticker); ticker = null; state = { mode: elements.mode.value, duration: elements.mode.value === 'countdown' ? selectedDuration() : 0, accumulated: 0, startedAt: 0, running: false, finished: false }; elements.finished.hidden = true; elements.start.textContent = '开始'; elements.pause.textContent = '暂停'; elements.pause.disabled = true; render(); setStatus('已重置。'); }
  function start() { if (state.running) return; try { if (state.finished) reset(); state.mode = elements.mode.value; if (state.mode === 'countdown' && state.accumulated === 0) { state.duration = selectedDuration(); if (state.duration === 0) throw new Error('倒计时不能为 0，请设置时长。'); } state.startedAt = Date.now(); state.running = true; elements.finished.hidden = true; elements.start.disabled = true; elements.pause.disabled = false; elements.pause.textContent = '暂停'; setStatus('计时中。', 'success'); ticker = setInterval(render, 200); render(); } catch (error) { elements.start.disabled = false; setStatus(error.message, 'error'); } }
  function pauseOrResume() { if (state.running) { state.accumulated = elapsedAt(state, Date.now()); state.running = false; clearInterval(ticker); ticker = null; elements.pause.textContent = '继续'; elements.start.disabled = true; setStatus('已暂停。'); render(); } else { state.startedAt = Date.now(); state.running = true; elements.pause.textContent = '暂停'; setStatus('继续计时。', 'success'); ticker = setInterval(render, 200); } }
  function safeReset() { try { elements.start.disabled = false; reset(); } catch (error) { setStatus(error.message, 'error'); } }
  elements.start.addEventListener('click', start); elements.pause.addEventListener('click', pauseOrResume); elements.reset.addEventListener('click', safeReset);
  elements.mode.addEventListener('change', () => { document.querySelectorAll('.countdown-field').forEach((field) => { field.hidden = elements.mode.value !== 'countdown'; }); safeReset(); });
  document.querySelectorAll('[data-minutes]').forEach((button) => button.addEventListener('click', () => { elements.hours.value = 0; elements.minutes.value = button.dataset.minutes; elements.seconds.value = 0; reset(); }));
  elements.fullscreen.addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (elements['timer-stage'].requestFullscreen) await elements['timer-stage'].requestFullscreen(); else throw new Error(); } catch { root.OETToolPage.showToast('当前浏览器不支持全屏，可使用浏览器缩放。'); } });
  document.addEventListener('fullscreenchange', () => { elements.fullscreen.textContent = document.fullscreenElement ? '退出全屏' : '大字全屏'; });
  safeReset();
})(typeof globalThis !== 'undefined' ? globalThis : this);
