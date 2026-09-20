(function (root) {
  'use strict';
  function linesOf(text) { return String(text).replace(/\r\n?/g, '\n').split('\n'); }
  function cleanText(raw, options = {}) {
    const original = String(raw || ''); let lines = linesOf(original);
    if (options.trimLines) lines = lines.map((line) => line.trim());
    if (options.collapseSpaces) lines = lines.map((line) => line.replace(/[ \t]+/g, ' '));
    if (options.collapseBlankLines) lines = lines.filter((line, index) => !(/^\s*$/.test(line) && index > 0 && /^\s*$/.test(lines[index - 1])));
    if (options.removeEmptyLines) lines = lines.filter((line) => !/^\s*$/.test(line));
    if (options.dedupeLines) { const seen = new Set(); lines = lines.filter((line) => { if (seen.has(line)) return false; seen.add(line); return true; }); }
    let output = lines.join('\n');
    if (options.chinesePunctuation) output = output.replace(/,/g, '，').replace(/;/g, '；').replace(/:/g, '：').replace(/\?/g, '？').replace(/!/g, '！').replace(/\.(?=\s|$)/g, '。');
    return output;
  }
  function textStats(text) { const value = String(text || ''); return { characters: Array.from(value).length, lines: value === '' ? 0 : linesOf(value).length }; }
  function differenceSummary(before, after) { const a = textStats(before); const b = textStats(after); return { before: a, after: b, characterDelta: b.characters - a.characters, lineDelta: b.lines - a.lines, changed: before !== after }; }
  const api = { linesOf, cleanText, textStats, differenceSummary };
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;
  const source = document.getElementById('source'); const output = document.getElementById('output'); const summary = document.getElementById('summary'); const status = document.getElementById('status');
  function options() { return Object.fromEntries([...document.querySelectorAll('[data-option]')].map((input) => [input.dataset.option, input.checked])); }
  function signed(value) { return value > 0 ? `+${value}` : String(value); }
  function update() { const result = cleanText(source.value, options()); output.value = result; const diff = differenceSummary(source.value, result); summary.textContent = `输入 ${diff.before.characters} 字符 / ${diff.before.lines} 行；输出 ${diff.after.characters} 字符 / ${diff.after.lines} 行；${diff.changed ? `字符 ${signed(diff.characterDelta)}，行 ${signed(diff.lineDelta)}` : '无变化'}。`; status.textContent = source.value.length > 1000000 ? '文本超过 100 万字符，处理可能变慢。' : ''; status.dataset.kind = source.value.length > 1000000 ? 'error' : ''; }
  source.addEventListener('input', update); document.querySelectorAll('[data-option]').forEach((input) => input.addEventListener('change', update));
  document.getElementById('copy').addEventListener('click', () => { root.OpenEduAnalytics?.toolUse?.('text-cleaner'); root.OETToolPage.copyText(output.value); });
  document.getElementById('download').addEventListener('click', () => { root.OpenEduAnalytics?.toolUse?.('text-cleaner'); root.OETToolPage.downloadText('清洗后的文本.txt', output.value); });
  document.getElementById('undo').addEventListener('click', () => { document.querySelectorAll('[data-option]').forEach((input) => { input.checked = false; }); output.value = source.value; update(); root.OETToolPage.showToast('已恢复原文并取消清理选项'); });
  document.getElementById('clear').addEventListener('click', () => { source.value = ''; output.value = ''; document.querySelectorAll('[data-option]').forEach((input) => { input.checked = false; }); update(); source.focus(); }); update();
})(typeof globalThis !== 'undefined' ? globalThis : this);
