(function (root) {
  'use strict';

  const MODES = ['series', 'parallel'];
  const DEFAULTS = { mode: 'series', voltage: 6, resistors: [10, 20] };
  const LIMITS = { voltage: { min: 0, max: 24 }, resistance: { min: 1, max: 1000 }, maxResistors: 4, maxRecords: 50 };

  function round(value, digits = 3) {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** digits;
    return Math.round((value + Math.sign(value) * Number.EPSILON) * factor) / factor;
  }

  function validateVoltage(value) {
    const voltage = Number(value);
    if (!Number.isFinite(voltage) || voltage < LIMITS.voltage.min || voltage > LIMITS.voltage.max) throw new Error(`电源电压必须在 ${LIMITS.voltage.min}–${LIMITS.voltage.max} V 之间`);
    return voltage;
  }

  function validateResistors(resistors) {
    if (!Array.isArray(resistors) || resistors.length < 1) throw new Error('请至少设置一个电阻');
    if (resistors.length > LIMITS.maxResistors) throw new Error(`最多支持 ${LIMITS.maxResistors} 个电阻`);
    return resistors.map((value, index) => {
      const resistance = Number(value);
      if (!Number.isFinite(resistance) || resistance < LIMITS.resistance.min || resistance > LIMITS.resistance.max) throw new Error(`第 ${index + 1} 个电阻必须在 ${LIMITS.resistance.min}–${LIMITS.resistance.max} Ω 之间`);
      return resistance;
    });
  }

  function equivalentResistance(mode, resistors) {
    const values = validateResistors(resistors);
    if (mode === 'series') return values.reduce((total, value) => total + value, 0);
    if (mode === 'parallel') return 1 / values.reduce((total, value) => total + 1 / value, 0);
    throw new Error('电路连接方式无效');
  }

  function solveCircuit(input = {}) {
    const mode = input.mode;
    if (!MODES.includes(mode)) throw new Error('电路连接方式无效');
    const voltage = validateVoltage(input.voltage);
    const resistors = validateResistors(input.resistors);
    const resistance = equivalentResistance(mode, resistors);
    const totalCurrent = voltage / resistance;
    const totalPower = voltage * totalCurrent;
    const branches = resistors.map((branchResistance, index) => {
      const branchVoltage = mode === 'series' ? totalCurrent * branchResistance : voltage;
      const branchCurrent = mode === 'series' ? totalCurrent : voltage / branchResistance;
      return { index: index + 1, resistance: branchResistance, voltage: branchVoltage, current: branchCurrent, power: branchVoltage * branchCurrent };
    });
    return { mode, voltage, resistors, equivalentResistance: resistance, totalCurrent, totalPower, branches };
  }

  function csvCell(value) {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function exportCircuitCsv(records) {
    if (!Array.isArray(records) || records.length === 0) throw new Error('没有可导出的实验记录');
    const rows = [['序号', '连接方式', '电源电压 (V)', '电阻 (Ω)', '等效电阻 (Ω)', '总电流 (A)', '总功率 (W)']];
    records.forEach((record, index) => {
      rows.push([
        index + 1,
        record.mode === 'series' ? '串联' : '并联',
        round(record.voltage, 3),
        record.resistors.join(record.mode === 'series' ? ' + ' : ' ∥ '),
        round(record.equivalentResistance, 4),
        round(record.totalCurrent, 4),
        round(record.totalPower, 4)
      ]);
    });
    return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  }

  function formatNumber(value, digits = 2) {
    if (!Number.isFinite(value)) return '—';
    const absolute = Math.abs(value);
    if (absolute >= 1000) return value.toFixed(0);
    if (absolute >= 100) return value.toFixed(1);
    if (absolute > 0 && absolute < 1) return String(Number(value.toPrecision(3)));
    return value.toFixed(digits);
  }

  const api = {
    MODES, DEFAULTS, LIMITS, round, validateVoltage, validateResistors, equivalentResistance, solveCircuit,
    exportCircuitCsv, csvCell, formatNumber
  };
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;

  const elements = Object.fromEntries([
    'resistor-list', 'add-resistor', 'voltage', 'voltage-range', 'record', 'reset', 'status', 'summary',
    'formula', 'branch-body', 'circuit-svg', 'circuit-caption', 'ohm-canvas', 'records-section',
    'records-count', 'records-body', 'export-records', 'clear-records'
  ].map((id) => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.getElementById(id)]));

  const state = { mode: DEFAULTS.mode, resistors: DEFAULTS.resistors.map(String), solution: null, records: [] };
  let pendingRefresh = 0;
  let pendingRedraw = 0;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function setStatus(message, kind = '') { elements.status.textContent = message; elements.status.dataset.kind = kind; }

  function readColors() {
    const styles = getComputedStyle(document.documentElement);
    return {
      text: styles.getPropertyValue('--text').trim() || '#f4f4f8',
      primary: styles.getPropertyValue('--primary').trim() || '#a78bfa'
    };
  }

  function canvasContext(canvas) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(280, Math.round(rect.width || canvas.width));
    const height = Math.max(200, Math.round(rect.height || canvas.height));
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { context, width, height };
  }

  function drawEmpty(context, width, height, message) {
    const colors = readColors();
    context.clearRect(0, 0, width, height);
    context.save();
    context.fillStyle = colors.text;
    context.globalAlpha = 0.5;
    context.font = '14px "PingFang SC", "Microsoft YaHei", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(message, width / 2, height / 2);
    context.restore();
  }

  function svgNode(tag, attributes, text) {
    const node = document.createElementNS(SVG_NS, tag);
    if (attributes) Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svgLine(parent, x1, y1, x2, y2, className = 'wire') {
    parent.append(svgNode('line', { x1, y1, x2, y2, class: className }));
  }

  function svgText(parent, x, y, content, className = 'label', anchor = 'middle') {
    parent.append(svgNode('text', { x, y, class: className, 'text-anchor': anchor, 'dominant-baseline': 'middle' }, content));
  }

  function drawArrow(parent, x, y) {
    parent.append(svgNode('path', { d: `M ${x} ${y} l -12 -6 l 0 12 z`, class: 'arrow' }));
  }

  function drawBattery(parent, x, topY, bottomY, voltage) {
    const centerY = (topY + bottomY) / 2;
    svgLine(parent, x, topY, x, centerY - 12);
    svgLine(parent, x - 22, centerY - 12, x + 22, centerY - 12, 'battery');
    svgLine(parent, x - 12, centerY + 12, x + 12, centerY + 12, 'battery');
    svgLine(parent, x, centerY + 12, x, bottomY);
    svgText(parent, x + 30, centerY - 2, `U = ${formatNumber(voltage)} V`, 'annotation', 'start');
  }

  function renderDiagram(solution) {
    const svg = elements.circuitSvg;
    svg.replaceChildren();
    if (!solution) {
      svg.append(svgNode('title', null, '电路图'), svgNode('desc', null, '参数无效，无法显示电路图'), svgNode('text', { x: 360, y: 180, class: 'empty', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, '参数有效后显示电路图'));
      svg.setAttribute('aria-label', '电路图：参数无效');
      return;
    }

    const isSeries = solution.mode === 'series';
    const description = `${isSeries ? '串联' : '并联'}电路，电源电压 ${formatNumber(solution.voltage)} 伏，共 ${solution.resistors.length} 个电阻，等效电阻 ${formatNumber(solution.equivalentResistance, 3)} 欧姆，总电流 ${formatNumber(solution.totalCurrent, 3)} 安培。`;
    svg.append(svgNode('title', null, isSeries ? '串联电路图' : '并联电路图'), svgNode('desc', null, description));
    svg.setAttribute('aria-label', description);

    const x0 = 100;
    const x1 = 640;

    if (isSeries) {
      const topY = 90;
      const bottomY = 280;
      svgLine(svg, x0, topY, x1, topY);
      svgLine(svg, x1, topY, x1, bottomY);
      svgLine(svg, x1, bottomY, x0, bottomY);
      drawBattery(svg, x0, topY, bottomY, solution.voltage);
      drawArrow(svg, x0 + 36, topY);
      svgText(svg, x0 + 24, topY - 30, `I = ${formatNumber(solution.totalCurrent, 3)} A`, 'current', 'start');

      const count = solution.resistors.length;
      const boxWidth = 86;
      const gap = 34;
      const totalWidth = count * boxWidth + (count - 1) * gap;
      const start = 380 - totalWidth / 2;
      solution.branches.forEach((branch, index) => {
        const center = start + boxWidth / 2 + index * (boxWidth + gap);
        svg.append(svgNode('rect', { x: center - boxWidth / 2, y: topY - 25, width: boxWidth, height: 50, rx: 12, class: 'component' }));
        svgText(svg, center, topY + 1, `R${index + 1}  ${formatNumber(branch.resistance)} Ω`, 'label');
        svgText(svg, center, topY + 44, `${formatNumber(branch.voltage)} V · ${formatNumber(branch.current, 3)} A`, 'annotation');
      });
    } else {
      const topY = 96;
      const bottomY = 286;
      svgLine(svg, x0, topY, x1, topY);
      svgLine(svg, x0, bottomY, x1, bottomY);
      drawBattery(svg, x0, topY, bottomY, solution.voltage);
      drawArrow(svg, x0 + 36, topY);
      svgText(svg, x0 + 24, topY - 16, `I总 = ${formatNumber(solution.totalCurrent, 3)} A`, 'current', 'start');

      const count = solution.branches.length;
      const left = 210;
      const right = 610;
      const centers = count === 1 ? [410] : Array.from({ length: count }, (_, index) => left + index * (right - left) / (count - 1));
      solution.branches.forEach((branch, index) => {
        const center = centers[index];
        svgLine(svg, center, topY, center, 150);
        svg.append(svgNode('rect', { x: center - 24, y: 150, width: 48, height: 72, rx: 10, class: 'component' }));
        svgLine(svg, center, 222, center, bottomY);
        svgText(svg, center + 28, 138, `R${index + 1}  ${formatNumber(branch.resistance)} Ω`, 'label', 'start');
        svgText(svg, center + 28, 244, `${formatNumber(branch.voltage)} V · ${formatNumber(branch.current, 3)} A`, 'annotation', 'start');
      });
    }
  }

  function drawOhmChart(solution) {
    const { context, width, height } = canvasContext(elements.ohmCanvas);
    context.clearRect(0, 0, width, height);
    if (!solution) { drawEmpty(context, width, height, '参数有效后显示伏安特性'); return; }

    const colors = readColors();
    const padding = { left: 60, right: 24, top: 26, bottom: 48 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    if (plotWidth < 40 || plotHeight < 40) return;

    const maxVoltage = Math.max(solution.voltage * 1.25, 1);
    const maxCurrent = Math.max(solution.totalCurrent * 1.25, ...solution.branches.map((branch) => maxVoltage / branch.resistance), 0.1);
    const mapX = (voltage) => padding.left + (voltage / maxVoltage) * plotWidth;
    const mapY = (current) => padding.top + plotHeight - (current / maxCurrent) * plotHeight;

    context.save();
    context.strokeStyle = colors.text;
    context.fillStyle = colors.text;
    context.lineWidth = 1;
    context.globalAlpha = 0.12;
    for (let index = 0; index <= 4; index += 1) {
      const x = padding.left + plotWidth * index / 4;
      const y = padding.top + plotHeight * index / 4;
      context.beginPath(); context.moveTo(x, padding.top); context.lineTo(x, padding.top + plotHeight); context.stroke();
      context.beginPath(); context.moveTo(padding.left, y); context.lineTo(padding.left + plotWidth, y); context.stroke();
    }
    context.globalAlpha = 0.62;
    context.font = '11px "PingFang SC", "Microsoft YaHei", sans-serif';
    context.textBaseline = 'middle';
    for (let index = 0; index <= 4; index += 1) {
      const voltage = maxVoltage * index / 4;
      const current = maxCurrent * (4 - index) / 4;
      context.textAlign = 'center';
      context.fillText(formatNumber(voltage, 1), padding.left + plotWidth * index / 4, height - padding.bottom + 18);
      context.textAlign = 'right';
      context.fillText(formatNumber(current, 2), padding.left - 8, padding.top + plotHeight * index / 4);
    }
    context.textAlign = 'center';
    context.fillText('电压 U / V', padding.left + plotWidth / 2, height - 10);
    context.save();
    context.translate(15, padding.top + plotHeight / 2);
    context.rotate(-Math.PI / 2);
    context.fillText('电流 I / A', 0, 0);
    context.restore();
    context.restore();

    context.save();
    context.strokeStyle = colors.text;
    context.globalAlpha = 0.42;
    context.lineWidth = 1.5;
    context.beginPath(); context.moveTo(padding.left, padding.top + plotHeight); context.lineTo(padding.left + plotWidth, padding.top + plotHeight); context.stroke();
    context.beginPath(); context.moveTo(padding.left, padding.top); context.lineTo(padding.left, padding.top + plotHeight); context.stroke();
    context.restore();

    const branchColors = ['#60a5fa', '#a78bfa', '#fbbf24', '#34d399'];
    solution.branches.forEach((branch, index) => {
      context.save();
      context.strokeStyle = branchColors[index % branchColors.length];
      context.globalAlpha = 0.42;
      context.lineWidth = 1.6;
      context.setLineDash([5, 5]);
      context.beginPath(); context.moveTo(mapX(0), mapY(0)); context.lineTo(mapX(maxVoltage), mapY(maxVoltage / branch.resistance)); context.stroke();
      context.restore();
    });

    const gradient = context.createLinearGradient(padding.left, 0, padding.left + plotWidth, 0);
    gradient.addColorStop(0, '#4f7cff');
    gradient.addColorStop(1, colors.primary);
    context.save();
    context.strokeStyle = gradient;
    context.lineWidth = 2.8;
    context.lineCap = 'round';
    context.beginPath(); context.moveTo(mapX(0), mapY(0)); context.lineTo(mapX(maxVoltage), mapY(maxVoltage / solution.equivalentResistance)); context.stroke();
    context.restore();

    const pointX = mapX(solution.voltage);
    const pointY = mapY(solution.totalCurrent);
    context.save();
    context.fillStyle = '#ff8a3d';
    context.shadowColor = 'rgba(255, 138, 61, 0.8)';
    context.shadowBlur = 12;
    context.beginPath(); context.arc(pointX, pointY, 5.5, 0, Math.PI * 2); context.fill();
    context.restore();
    context.save();
    context.fillStyle = colors.text;
    context.globalAlpha = 0.8;
    context.font = '11px "PingFang SC", "Microsoft YaHei", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('工作点', Math.min(width - padding.right - 24, pointX + 30), Math.max(padding.top + 12, pointY - 14));
    context.restore();
  }

  function renderStats(items) {
    elements.summary.replaceChildren(...items.map(([label, value]) => {
      const box = document.createElement('div'); box.className = 'stat';
      const term = document.createElement('dt'); term.textContent = label;
      const detail = document.createElement('dd'); detail.textContent = value;
      box.append(term, detail);
      return box;
    }));
  }

  function formulaText(solution) {
    const labels = solution.resistors.map((_, index) => `R${index + 1}`);
    const values = solution.resistors.map((value) => formatNumber(value));
    if (solution.mode === 'series') {
      return `R_eq = ${labels.join(' + ')}\n     = ${values.join(' + ')}\n     = ${formatNumber(solution.equivalentResistance, 3)} Ω\nI = U / R_eq = ${formatNumber(solution.voltage)} / ${formatNumber(solution.equivalentResistance, 3)} = ${formatNumber(solution.totalCurrent, 3)} A`;
    }
    return `1/R_eq = ${labels.map((label) => `1/${label}`).join(' + ')}\nR_eq = ${formatNumber(solution.equivalentResistance, 3)} Ω\nI = U / R_eq = ${formatNumber(solution.voltage)} / ${formatNumber(solution.equivalentResistance, 3)} = ${formatNumber(solution.totalCurrent, 3)} A`;
  }

  function renderSolution(solution) {
    renderStats([
      ['等效电阻 R_eq', `${formatNumber(solution.equivalentResistance, 3)} Ω`],
      ['总电流 I', `${formatNumber(solution.totalCurrent, 3)} A`],
      ['电源电压 U', `${formatNumber(solution.voltage)} V`],
      ['总功率 P', `${formatNumber(solution.totalPower, 3)} W`]
    ]);
    elements.formula.textContent = formulaText(solution);
    elements.branchBody.replaceChildren(...solution.branches.map((branch) => {
      const row = document.createElement('tr');
      [`R${branch.index}`, `${formatNumber(branch.resistance)} Ω`, `${formatNumber(branch.voltage)} V`, `${formatNumber(branch.current, 3)} A`, `${formatNumber(branch.power, 3)} W`].forEach((value) => {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      });
      return row;
    }));
    elements.circuitCaption.textContent = solution.mode === 'series'
      ? `串联电路：${solution.branches.length} 个电阻依次连接，电流处处相等，总电压等于各电阻电压之和。`
      : `并联电路：${solution.branches.length} 个电阻并列连接，各支路电压相等，总电流等于各支路电流之和。`;
    renderDiagram(solution);
    drawOhmChart(solution);
  }

  function renderUnavailable() {
    renderStats([['状态', '参数无效']]);
    elements.formula.textContent = '参数有效后显示计算公式。';
    const row = document.createElement('tr');
    const cell = document.createElement('td'); cell.colSpan = 5; cell.className = 'muted'; cell.textContent = '请先修正电源电压或电阻值。';
    row.append(cell); elements.branchBody.replaceChildren(row);
    elements.circuitCaption.textContent = '电路图会随连接方式和电阻数量更新。';
    renderDiagram(null);
    drawOhmChart(null);
  }

  function readCircuitInput() {
    if (String(elements.voltage.value).trim() === '') throw new Error('请填写电源电压。');
    if (state.resistors.some((value) => String(value).trim() === '')) throw new Error('请填写所有电阻的阻值。');
    return { mode: state.mode, voltage: Number(elements.voltage.value), resistors: state.resistors.map(Number) };
  }

  function refresh(options = {}) {
    try {
      const solution = solveCircuit(readCircuitInput());
      state.solution = solution;
      renderSolution(solution);
      elements.record.disabled = false;
      if (options.announce) setStatus(`已更新：等效电阻 ${formatNumber(solution.equivalentResistance, 3)} Ω，总电流 ${formatNumber(solution.totalCurrent, 3)} A。`, 'success');
      return true;
    } catch (error) {
      state.solution = null;
      elements.record.disabled = true;
      renderUnavailable();
      setStatus(error.message, 'error');
      return false;
    }
  }

  function scheduleRefresh() {
    if (pendingRefresh) cancelAnimationFrame(pendingRefresh);
    pendingRefresh = requestAnimationFrame(() => { pendingRefresh = 0; refresh(); });
  }

  function scheduleRedraw() {
    if (pendingRedraw) cancelAnimationFrame(pendingRedraw);
    pendingRedraw = requestAnimationFrame(() => { pendingRedraw = 0; if (state.solution) drawOhmChart(state.solution); });
  }

  function renderResistorList() {
    elements.resistorList.replaceChildren(...state.resistors.map((value, index) => {
      const row = document.createElement('div'); row.className = 'resistor-row';
      const label = document.createElement('span'); label.className = 'resistor-row__index'; label.textContent = `R${index + 1}`;
      const input = document.createElement('input'); input.type = 'number'; input.min = '1'; input.max = '1000'; input.step = '1'; input.value = value; input.inputMode = 'decimal';
      input.setAttribute('aria-label', `R${index + 1} 的阻值（欧姆）`);
      input.addEventListener('input', () => { state.resistors[index] = input.value; scheduleRefresh(); });
      const unit = document.createElement('span'); unit.className = 'resistor-row__unit'; unit.textContent = 'Ω';
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'icon-btn'; remove.textContent = '×';
      remove.setAttribute('aria-label', `删除 R${index + 1}`); remove.disabled = state.resistors.length <= 1;
      remove.addEventListener('click', () => {
        state.resistors.splice(index, 1);
        renderResistorList();
        refresh();
        setStatus(`已删除 R${index + 1}。`, 'success');
      });
      row.append(label, input, unit, remove);
      return row;
    }));
    elements.addResistor.disabled = state.resistors.length >= LIMITS.maxResistors;
  }

  function setMode(mode) {
    if (!MODES.includes(mode)) return;
    state.mode = mode;
    document.querySelectorAll('[data-mode]').forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    refresh();
  }

  function renderRecords() {
    const hasRecords = state.records.length > 0;
    elements.recordsSection.hidden = !hasRecords;
    elements.recordsCount.textContent = hasRecords ? `共 ${state.records.length} 组` : '';
    elements.exportRecords.disabled = !hasRecords;
    elements.clearRecords.disabled = !hasRecords;
    elements.recordsBody.replaceChildren(...state.records.map((record, index) => {
      const row = document.createElement('tr');
      [
        String(index + 1),
        record.mode === 'series' ? '串联' : '并联',
        `${formatNumber(record.voltage)} V`,
        record.resistors.map((value) => `${formatNumber(value)} Ω`).join(record.mode === 'series' ? ' + ' : ' ∥ '),
        `${formatNumber(record.equivalentResistance, 3)} Ω`,
        `${formatNumber(record.totalCurrent, 3)} A`,
        `${formatNumber(record.totalPower, 3)} W`
      ].forEach((value) => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); });
      return row;
    }));
  }

  function addRecord() {
    refresh();
    if (!state.solution) { setStatus('参数无效，无法记录。', 'error'); return; }
    if (state.records.length >= LIMITS.maxRecords) { setStatus(`最多记录 ${LIMITS.maxRecords} 组数据，请先清空记录。`, 'warning'); return; }
    const solution = state.solution;
    state.records.push({
      mode: solution.mode,
      voltage: solution.voltage,
      resistors: [...solution.resistors],
      equivalentResistance: solution.equivalentResistance,
      totalCurrent: solution.totalCurrent,
      totalPower: solution.totalPower
    });
    renderRecords();
    setStatus(`已记录第 ${state.records.length} 组数据。`, 'success');
    root.OpenEduAnalytics?.toolUse?.('circuit-lab');
  }

  function exportRecords() {
    if (!state.records.length) { setStatus('还没有可导出的实验记录。', 'warning'); return; }
    const csv = exportCircuitCsv(state.records);
    if (root.OETToolPage && typeof root.OETToolPage.downloadText === 'function') {
      root.OETToolPage.downloadText('电路实验记录.csv', csv, 'text/csv;charset=utf-8');
      setStatus('已导出实验记录。', 'success');
    } else {
      setStatus('当前环境不支持下载，请手动记录结果。', 'error');
    }
  }

  function clearRecords() {
    state.records = [];
    renderRecords();
    setStatus('已清空实验记录。', 'success');
  }

  function resetExperiment() {
    state.mode = DEFAULTS.mode;
    state.resistors = DEFAULTS.resistors.map(String);
    state.records = [];
    elements.voltage.value = String(DEFAULTS.voltage);
    elements.voltageRange.value = String(DEFAULTS.voltage);
    document.querySelectorAll('[data-mode]').forEach((button) => {
      const active = button.dataset.mode === DEFAULTS.mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    renderResistorList();
    renderRecords();
    refresh();
    setStatus('已恢复默认电路，实验记录已清空。', 'success');
  }

  document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
  elements.voltageRange.addEventListener('input', () => { elements.voltage.value = elements.voltageRange.value; scheduleRefresh(); });
  elements.voltage.addEventListener('input', () => { if (elements.voltage.value !== '') elements.voltageRange.value = elements.voltage.value; scheduleRefresh(); });
  elements.addResistor.addEventListener('click', () => {
    if (state.resistors.length >= LIMITS.maxResistors) return;
    state.resistors.push('10');
    renderResistorList();
    refresh();
    const inputs = elements.resistorList.querySelectorAll('input');
    const last = inputs[inputs.length - 1];
    if (last) { last.focus(); last.select(); }
    setStatus(`已添加 R${state.resistors.length}。`, 'success');
  });
  elements.record.addEventListener('click', addRecord);
  elements.exportRecords.addEventListener('click', exportRecords);
  elements.clearRecords.addEventListener('click', clearRecords);
  elements.reset.addEventListener('click', resetExperiment);
  window.addEventListener('resize', scheduleRedraw);
  document.querySelector('[data-theme-select]')?.addEventListener('change', () => setTimeout(scheduleRedraw, 0));

  renderResistorList();
  renderRecords();
  refresh();
  setStatus('调整电压或电阻，读数会实时更新；改变参数后点击「记录本次数据」保存一组结果。');
})(typeof globalThis !== 'undefined' ? globalThis : this);
