(function (root) {
  'use strict';
  const KEY = 'openEduTools:tool:fullscreen-clock:settings';

  function pad(value) { return String(value).padStart(2, '0'); }
  function formatTime(date, options = {}) {
    const use24 = options.use24 !== false;
    const showSeconds = options.showSeconds !== false;
    let hours = date.getHours();
    let suffix = '';
    if (!use24) { suffix = hours < 12 ? ' AM' : ' PM'; hours = hours % 12 || 12; }
    return `${pad(hours)}:${pad(date.getMinutes())}${showSeconds ? `:${pad(date.getSeconds())}` : ''}${suffix}`;
  }
  function formatDate(date) {
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日 · 星期${weekdays[date.getDay()]}`;
  }
  function formatCountdown(milliseconds) {
    const total = Math.max(0, Math.ceil(milliseconds / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  }
  function parseEndTime(now, value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
    if (!match) return null;
    const hours = Number(match[1]); const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
    if (end.getTime() <= now.getTime()) end.setDate(end.getDate() + 1);
    return end;
  }
  const api = { pad, formatTime, formatDate, formatCountdown, parseEndTime };
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;

  const elements = Object.fromEntries(['use24', 'showSeconds', 'showDate', 'endTime', 'status', 'clockTime', 'clockDate', 'clockCountdown', 'fullscreenBtn', 'clockStage'].map((id) => [id, document.getElementById(id)]));
  const settings = { use24: true, showSeconds: true, showDate: true, endTime: '' };
  let timer = 0;

  function setStatus(message, kind = '') { elements.status.textContent = message; elements.status.dataset.kind = kind; }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* 存储不可用时忽略 */ } }
  function load() {
    try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && typeof saved === 'object') Object.assign(settings, saved); } catch { /* 忽略损坏数据 */ }
    elements.use24.checked = settings.use24 !== false;
    elements.showSeconds.checked = settings.showSeconds !== false;
    elements.showDate.checked = settings.showDate !== false;
    elements.endTime.value = typeof settings.endTime === 'string' ? settings.endTime : '';
  }
  function render() {
    const now = new Date();
    elements.clockTime.textContent = formatTime(now, { use24: settings.use24, showSeconds: settings.showSeconds });
    elements.clockDate.textContent = settings.showDate ? formatDate(now) : '';
    elements.clockDate.hidden = !settings.showDate;
    const end = parseEndTime(now, settings.endTime);
    if (end) {
      const remaining = end.getTime() - now.getTime();
      elements.clockCountdown.hidden = false;
      elements.clockCountdown.classList.toggle('is-done', remaining <= 0);
      elements.clockCountdown.innerHTML = '';
      if (remaining <= 0) { elements.clockCountdown.textContent = '时间到'; }
      else {
        elements.clockCountdown.append('距结束 ');
        const value = document.createElement('b'); value.textContent = formatCountdown(remaining);
        elements.clockCountdown.append(value);
      }
    } else {
      elements.clockCountdown.hidden = true;
    }
  }
  function toggleFullscreen() {
    const stage = elements.clockStage;
    try {
      if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen().catch(() => {}); }
      else if (stage.requestFullscreen) { root.OpenEduAnalytics?.toolUse?.('fullscreen-clock'); stage.requestFullscreen().catch(() => root.OETToolPage.showToast('无法进入全屏，可使用浏览器缩放。')); }
      else root.OETToolPage.showToast('当前浏览器不支持全屏，可使用浏览器缩放。');
    } catch { root.OETToolPage.showToast('当前浏览器不支持全屏，可使用浏览器缩放。'); }
  }
  function syncSetting(event) {
    const target = event.currentTarget;
    settings[target.id] = target.type === 'checkbox' ? target.checked : target.value;
    persist(); render();
  }
  elements.use24.addEventListener('change', syncSetting);
  elements.showSeconds.addEventListener('change', syncSetting);
  elements.showDate.addEventListener('change', syncSetting);
  elements.endTime.addEventListener('change', syncSetting);
  elements.endTime.addEventListener('input', syncSetting);
  elements.fullscreenBtn.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => { elements.fullscreenBtn.textContent = document.fullscreenElement ? '退出全屏' : '全屏'; });
  document.addEventListener('visibilitychange', render);
  load(); render();
  timer = root.setInterval(render, 250);
  root.addEventListener('beforeunload', () => root.clearInterval(timer));
})(typeof globalThis !== 'undefined' ? globalThis : this);
