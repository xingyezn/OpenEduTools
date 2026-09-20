(function (root) {
  'use strict';
  function parseCSV(raw) {
    const text = String(raw || '').replace(/^\uFEFF/, ''); const rows = []; let row = []; let field = ''; let quoted = false; let afterQuote = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (quoted) { if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; } else if (char === '"') { quoted = false; afterQuote = true; } else field += char; continue; }
      if (afterQuote && char !== ',' && char !== '\r' && char !== '\n' && !/\s/.test(char)) throw new Error(`CSV 第 ${rows.length + 1} 行引号后有无效字符`);
      if (char === '"' && field === '') { quoted = true; afterQuote = false; }
      else if (char === ',') { row.push(field); field = ''; afterQuote = false; }
      else if (char === '\n' || char === '\r') { if (char === '\r' && text[index + 1] === '\n') index += 1; row.push(field); rows.push(row); row = []; field = ''; afterQuote = false; }
      else if (!afterQuote) field += char;
    }
    if (quoted) throw new Error('CSV 中存在未闭合的引号');
    if (field !== '' || row.length || text.endsWith(',')) { row.push(field); rows.push(row); }
    return rows;
  }
  function parseScores(raw, minimum = 0, maximum = 100) {
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum) throw new Error('最低分必须小于最高分');
    const text = String(raw || '').trim(); if (!text) throw new Error('请先输入至少一个分数');
    let cells;
    if (/[,\"]/.test(text)) { const rows = parseCSV(text); if (rows.some((row) => row.length !== 1)) throw new Error('仅支持单列 CSV，请移除姓名或其他列'); cells = rows.map((row) => row[0]); }
    else cells = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    cells = cells.map((cell) => cell.trim()); if (/^(分数|成绩|score)$/i.test(cells[0])) cells.shift();
    const emptyAt = cells.findIndex((cell) => cell === ''); if (emptyAt >= 0) throw new Error(`第 ${emptyAt + 1} 个数据为空，请补充分数或删除该行`);
    const scores = cells.map((cell, index) => { const value = Number(cell); if (!Number.isFinite(value)) throw new Error(`第 ${index + 1} 个数据“${cell}”不是有效数字`); if (value < minimum || value > maximum) throw new Error(`第 ${index + 1} 个分数 ${value} 超出 ${minimum}–${maximum}`); return value; });
    if (!scores.length) throw new Error('请先输入至少一个分数'); return scores;
  }
  function parseBands(raw, minimum, maximum) {
    const lines = String(raw || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean); if (!lines.length) throw new Error('请至少设置一个分数段');
    const bands = lines.map((line, index) => { const match = line.match(/^([^:：]+)[:：]\s*(-?(?:\d+\.?\d*|\.\d+))\s*-\s*(-?(?:\d+\.?\d*|\.\d+))$/); if (!match) throw new Error(`第 ${index + 1} 个分数段格式错误`); const band = { label: match[1].trim(), min: Number(match[2]), max: Number(match[3]) }; if (!band.label || band.min >= band.max || band.min < minimum || band.max > maximum) throw new Error(`分数段“${band.label}”范围无效`); return band; });
    const sorted = [...bands].sort((a, b) => a.min - b.min); for (let index = 1; index < sorted.length; index += 1) if (sorted[index - 1].max > sorted[index].min) throw new Error(`分数段“${sorted[index - 1].label}”与“${sorted[index].label}”重叠`);
    return bands;
  }
  function round2(value) { return Math.round((value + Math.sign(value) * Number.EPSILON) * 100) / 100; }
  function calculateStatistics(scores, passLine, bands, maximum) {
    if (!scores.length) throw new Error('没有有效分数'); const sorted = [...scores].sort((a, b) => a - b); const sum = scores.reduce((total, score) => total + score, 0); const middle = Math.floor(sorted.length / 2); const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    const distribution = bands.map((band) => { const count = scores.filter((score) => score >= band.min && (score < band.max || (band.max === maximum && score <= maximum))).length; return { ...band, count, percentage: round2(count / scores.length * 100) }; });
    return { count: scores.length, average: round2(sum / scores.length), median: round2(median), highest: Math.max(...scores), lowest: Math.min(...scores), passRate: round2(scores.filter((score) => score >= passLine).length / scores.length * 100), distribution, unclassified: scores.length - distribution.reduce((sumCount, band) => sumCount + band.count, 0) };
  }
  function csvCell(value) { const text = String(value); return /[\",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
  function exportSummary(stats) { const rows = [['指标','数值'],['有效人数',stats.count],['平均数',stats.average],['中位数',stats.median],['最高分',stats.highest],['最低分',stats.lowest],['及格率',`${stats.passRate}%`],[],['分数段','人数','占比'],...stats.distribution.map((band) => [band.label,band.count,`${band.percentage}%`])]; if (stats.unclassified) rows.push(['未归类',stats.unclassified,`${round2(stats.unclassified / stats.count * 100)}%`]); return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n'); }
  const api = { parseCSV, parseScores, parseBands, round2, calculateStatistics, exportSummary };
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;
  const scoresInput = document.getElementById('scores'); const status = document.getElementById('status'); const result = document.getElementById('result'); const exportButton = document.getElementById('export'); let lastStats = null;
  function setStatus(message, kind = '') { status.textContent = message; status.dataset.kind = kind; }
  function render(stats) {
    const dl = document.createElement('dl'); dl.className = 'stat-grid'; [['有效人数',stats.count],['平均数',stats.average.toFixed(2)],['中位数',stats.median.toFixed(2)],['最高分',stats.highest],['最低分',stats.lowest],['及格率',`${stats.passRate.toFixed(2)}%`]].forEach(([label,value]) => { const box = document.createElement('div'); box.className = 'stat'; const dt = document.createElement('dt'); dt.textContent = label; const dd = document.createElement('dd'); dd.textContent = value; box.append(dt,dd); dl.append(box); });
    const wrap = document.createElement('div'); wrap.className = 'data-table-wrap'; const table = document.createElement('table'); table.className = 'data-table'; const caption = document.createElement('caption'); caption.className = 'visually-hidden'; caption.textContent = '分数段分布'; const head = document.createElement('thead'); const headRow = document.createElement('tr'); ['分数段','人数','占比'].forEach((text) => { const th = document.createElement('th'); th.scope='col'; th.textContent=text; headRow.append(th); }); head.append(headRow); const body = document.createElement('tbody');
    stats.distribution.forEach((band) => { const row = document.createElement('tr'); [band.label,band.count,`${band.percentage.toFixed(2)}%`].forEach((value) => { const cell = document.createElement('td'); cell.textContent=value; row.append(cell); }); body.append(row); });
    if (stats.unclassified) { const row = document.createElement('tr'); ['未归类',stats.unclassified,`${round2(stats.unclassified/stats.count*100).toFixed(2)}%`].forEach((value) => { const cell=document.createElement('td'); cell.textContent=value; row.append(cell); }); body.append(row); }
    table.append(caption,head,body); wrap.append(table); result.replaceChildren(dl,wrap);
  }
  document.getElementById('calculate').addEventListener('click', () => { try { const minimum=Number(document.getElementById('minimum').value); const maximum=Number(document.getElementById('maximum').value); const passLine=Number(document.getElementById('pass-line').value); if (!Number.isFinite(passLine) || passLine < minimum || passLine > maximum) throw new Error('及格线必须在允许分数范围内'); const scores=parseScores(scoresInput.value,minimum,maximum); const bands=parseBands(document.getElementById('bands').value,minimum,maximum); lastStats=calculateStatistics(scores,passLine,bands,maximum); render(lastStats); exportButton.disabled=false; setStatus(`已完成 ${scores.length} 个分数的统计。`, 'success'); root.OpenEduAnalytics?.toolUse?.('score-statistics'); } catch(error) { lastStats=null; exportButton.disabled=true; setStatus(error.message,'error'); } });
  document.getElementById('file').addEventListener('change', async (event) => { const file=event.target.files[0]; if (!file) return; if (file.size > 1024*1024) { setStatus('文件超过 1 MB，请缩小后重试。','error'); event.target.value=''; return; } try { scoresInput.value=await file.text(); setStatus('文件已读取，请检查后点击“计算统计”。','success'); } catch { setStatus('无法读取文件，请确认文件可访问。','error'); } });
  exportButton.addEventListener('click', () => { if (lastStats) root.OETToolPage.downloadText('成绩统计汇总.csv',exportSummary(lastStats),'text/csv;charset=utf-8'); });
  document.getElementById('clear').addEventListener('click', () => { scoresInput.value=''; document.getElementById('file').value=''; lastStats=null; exportButton.disabled=true; result.replaceChildren(Object.assign(document.createElement('p'),{className:'muted',textContent:'统计结果会显示在这里。数值四舍五入保留两位小数。'})); setStatus('已清空，成绩未被保存。','success'); scoresInput.focus(); });
})(typeof globalThis !== 'undefined' ? globalThis : this);
