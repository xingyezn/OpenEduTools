(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  const input = document.getElementById('sample-input'); const status = document.getElementById('status'); const result = document.getElementById('result');
  document.getElementById('run').addEventListener('click', () => { const value = input.value.trim(); if (!value) { status.textContent = '请先输入内容。'; status.dataset.kind = 'error'; return; } const output = document.createElement('p'); output.textContent = value; result.replaceChildren(output); status.textContent = '处理完成。'; status.dataset.kind = 'success'; });
  document.getElementById('reset').addEventListener('click', () => { input.value = ''; result.replaceChildren(Object.assign(document.createElement('p'), { className: 'muted', textContent: '结果会显示在这里。' })); status.textContent = '已重置。'; status.dataset.kind = ''; input.focus(); });
})();
