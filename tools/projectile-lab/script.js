(function (root) {
  'use strict';

  const DEFAULTS = { speed: 20, angleDeg: 45, height: 0, gravity: 9.8 };
  const ANGLE_PRESETS = [15, 30, 45, 60, 75];
  const GRAVITY_PRESETS = [
    { id: 'earth', label: '地球', value: 9.8 },
    { id: 'moon', label: '月球', value: 1.6 },
    { id: 'mars', label: '火星', value: 3.7 }
  ];

  function round(value, digits = 3) {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** digits;
    return Math.round((value + Math.sign(value) * Number.EPSILON) * factor) / factor;
  }

  function toRadians(degrees) { return degrees * Math.PI / 180; }

  function assertRange(value, label, minimum, maximum) {
    if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${label}必须在 ${minimum}–${maximum} 之间`);
    return value;
  }

  function computeProjectile(input = {}) {
    const speed = assertRange(Number(input.speed), '初速度', 0, 100);
    const angleDeg = assertRange(Number(input.angleDeg), '抛射角', 0, 90);
    const height = assertRange(Number(input.height), '初始高度', 0, 200);
    const gravity = assertRange(Number(input.gravity), '重力加速度', 0.1, 50);
    if (speed === 0 && height === 0) throw new Error('初速度和初始高度不能同时为 0');

    const angle = toRadians(angleDeg);
    const vx = speed * Math.cos(angle);
    const vy0 = speed * Math.sin(angle);
    const flightTime = (vy0 + Math.sqrt(vy0 * vy0 + 2 * gravity * height)) / gravity;
    const range = vx * flightTime;
    const apexTime = vy0 > 0 ? vy0 / gravity : 0;
    const maxHeight = height + (vy0 > 0 ? (vy0 * vy0) / (2 * gravity) : 0);
    const landingVy = vy0 - gravity * flightTime;
    const landingSpeed = Math.hypot(vx, landingVy);
    const landingAngle = Math.atan2(Math.abs(landingVy), Math.abs(vx)) * 180 / Math.PI;

    return {
      speed, angleDeg, height, gravity, vx, vy0, flightTime, range,
      apexTime, maxHeight, landingSpeed, landingAngle, landingVy
    };
  }

  function positionAt(result, time) {
    const t = Math.max(0, Number(time) || 0);
    return {
      t,
      x: result.vx * t,
      y: Math.max(0, result.height + result.vy0 * t - 0.5 * result.gravity * t * t),
      vx: result.vx,
      vy: result.vy0 - result.gravity * t
    };
  }

  function sampleTrajectory(result, count = 160) {
    const total = Math.max(2, Math.floor(Number(count) || 160));
    const points = [];
    for (let index = 0; index < total; index += 1) points.push(positionAt(result, result.flightTime * index / (total - 1)));
    points[points.length - 1] = positionAt(result, result.flightTime);
    return points;
  }

  function compareAngles(base, angles = ANGLE_PRESETS) {
    return [...angles].sort((left, right) => left - right).map((angleDeg) => {
      const result = computeProjectile({ ...base, angleDeg });
      return { angleDeg, flightTime: result.flightTime, range: result.range, maxHeight: result.maxHeight, landingSpeed: result.landingSpeed };
    });
  }

  function rangeCurve(base, step = 1) {
    const rows = [];
    const increment = Math.max(1, Number(step) || 1);
    for (let angle = 0; angle <= 90; angle += increment) rows.push({ angleDeg: angle, range: computeProjectile({ ...base, angleDeg: angle }).range });
    return rows;
  }

  function csvCell(value) {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function rowsToCsv(rows) { return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n'); }

  function buildExperimentCsv(result, samples, comparison) {
    const rows = [
      ['抛体运动实验数据'],
      ['初速度 v0 (m/s)', round(result.speed)],
      ['抛射角 (deg)', round(result.angleDeg)],
      ['初始高度 (m)', round(result.height)],
      ['重力加速度 (m/s^2)', round(result.gravity)],
      ['飞行时间 (s)', round(result.flightTime, 4)],
      ['水平射程 (m)', round(result.range, 4)],
      ['最大高度 (m)', round(result.maxHeight, 4)],
      ['落地速度 (m/s)', round(result.landingSpeed, 4)],
      ['落地角 (deg)', round(result.landingAngle, 4)],
      [],
      ['多角度对比'],
      ['角度 (deg)', '飞行时间 (s)', '水平射程 (m)', '最大高度 (m)', '落地速度 (m/s)'],
      ...comparison.map((row) => [round(row.angleDeg), round(row.flightTime, 4), round(row.range, 4), round(row.maxHeight, 4), round(row.landingSpeed, 4)]),
      [],
      ['轨迹采样'],
      ['时间 (s)', '水平位移 (m)', '高度 (m)', '水平速度 (m/s)', '竖直速度 (m/s)'],
      ...samples.map((point) => [round(point.t, 4), round(point.x, 4), round(point.y, 4), round(point.vx, 4), round(point.vy, 4)])
    ];
    return rowsToCsv(rows);
  }

  function formatNumber(value, digits = 2) {
    if (!Number.isFinite(value)) return '—';
    const absolute = Math.abs(value);
    if (absolute >= 1000) return value.toFixed(0);
    if (absolute >= 100) return value.toFixed(1);
    if (absolute > 0 && absolute < 0.01) return Number(value.toPrecision(3)).toString();
    return value.toFixed(digits);
  }

  const api = {
    DEFAULTS, ANGLE_PRESETS, GRAVITY_PRESETS, round, toRadians, computeProjectile, positionAt,
    sampleTrajectory, compareAngles, rangeCurve, buildExperimentCsv, csvCell, formatNumber
  };
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;

  const elements = Object.fromEntries([
    'gravity-preset', 'gravity', 'speed', 'speed-range', 'angle', 'angle-range', 'height', 'height-range',
    'launch', 'reset', 'export', 'status', 'summary', 'trajectory-canvas', 'readout', 'compare-body', 'angle-canvas'
  ].map((id) => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.getElementById(id)]));

  const state = { result: null, samples: [], comparison: [], progress: 1, animationId: 0, reducedMotion: false, readoutRefs: [] };
  const motionQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  state.reducedMotion = Boolean(motionQuery && motionQuery.matches);
  let pendingRefresh = 0;
  let pendingRedraw = 0;

  function setStatus(message, kind = '') { elements.status.textContent = message; elements.status.dataset.kind = kind; }

  function readColors() {
    const styles = getComputedStyle(document.documentElement);
    return {
      text: styles.getPropertyValue('--text').trim() || '#f4f4f8',
      primary: styles.getPropertyValue('--primary').trim() || '#a78bfa',
      secondary: styles.getPropertyValue('--secondary').trim() || '#60a5fa',
      warning: styles.getPropertyValue('--warning').trim() || '#fbbf24'
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

  function drawLabel(context, text, x, y, align = 'center', color = '#fff') {
    context.save();
    context.fillStyle = color;
    context.font = '11px "PingFang SC", "Microsoft YaHei", sans-serif';
    context.textAlign = align;
    context.textBaseline = 'middle';
    context.fillText(text, x, y);
    context.restore();
  }

  function drawTrajectory(result, progress = 1) {
    const { context, width, height } = canvasContext(elements.trajectoryCanvas);
    state.progress = Math.max(0, Math.min(1, progress));
    context.clearRect(0, 0, width, height);
    if (!result) { drawEmpty(context, width, height, '参数有效后显示轨迹'); return; }

    const colors = readColors();
    const padding = { left: 56, right: 24, top: 26, bottom: 46 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    if (plotWidth < 40 || plotHeight < 40) return;

    const maxX = Math.max(result.range * 1.12, result.height * 0.35, 1);
    const maxY = Math.max(result.maxHeight * 1.15, result.height * 1.15, 1);
    const mapX = (value) => padding.left + (value / maxX) * plotWidth;
    const mapY = (value) => padding.top + plotHeight - (value / maxY) * plotHeight;

    context.save();
    context.strokeStyle = colors.text;
    context.lineWidth = 1;
    context.globalAlpha = 0.13;
    for (let index = 0; index <= 4; index += 1) {
      const x = padding.left + plotWidth * index / 4;
      const y = padding.top + plotHeight * index / 4;
      context.beginPath(); context.moveTo(x, padding.top); context.lineTo(x, padding.top + plotHeight); context.stroke();
      context.beginPath(); context.moveTo(padding.left, y); context.lineTo(padding.left + plotWidth, y); context.stroke();
    }
    context.restore();

    context.save();
    context.fillStyle = colors.text;
    context.globalAlpha = 0.62;
    context.font = '11px "PingFang SC", "Microsoft YaHei", sans-serif';
    context.textBaseline = 'middle';
    for (let index = 0; index <= 4; index += 1) {
      const xValue = maxX * index / 4;
      const yValue = maxY * (4 - index) / 4;
      context.textAlign = 'center';
      context.fillText(formatNumber(xValue, 1), padding.left + plotWidth * index / 4, height - padding.bottom + 18);
      context.textAlign = 'right';
      context.fillText(formatNumber(yValue, 1), padding.left - 8, padding.top + plotHeight * index / 4);
    }
    context.textAlign = 'center';
    context.fillText('水平距离 / m', padding.left + plotWidth / 2, height - 10);
    context.save();
    context.translate(15, padding.top + plotHeight / 2);
    context.rotate(-Math.PI / 2);
    context.fillText('高度 / m', 0, 0);
    context.restore();
    context.restore();

    context.save();
    context.strokeStyle = colors.text;
    context.globalAlpha = 0.42;
    context.lineWidth = 1.5;
    context.beginPath(); context.moveTo(padding.left, padding.top + plotHeight); context.lineTo(padding.left + plotWidth, padding.top + plotHeight); context.stroke();
    context.beginPath(); context.moveTo(padding.left, padding.top); context.lineTo(padding.left, padding.top + plotHeight); context.stroke();
    context.restore();

    const points = state.samples.length ? state.samples : sampleTrajectory(result, 160);
    context.save();
    context.strokeStyle = colors.primary;
    context.globalAlpha = 0.24;
    context.lineWidth = 2;
    context.beginPath();
    points.forEach((point, index) => { if (index === 0) context.moveTo(mapX(point.x), mapY(point.y)); else context.lineTo(mapX(point.x), mapY(point.y)); });
    context.stroke();
    context.restore();

    const visible = Math.max(1, Math.round(points.length * state.progress));
    const visiblePoints = points.slice(0, visible);
    if (visiblePoints.length > 1) {
      const gradient = context.createLinearGradient(padding.left, 0, padding.left + plotWidth, 0);
      gradient.addColorStop(0, '#4f7cff');
      gradient.addColorStop(0.55, colors.primary);
      gradient.addColorStop(1, '#ff8a3d');
      context.save();
      context.strokeStyle = gradient;
      context.lineWidth = 2.8;
      context.lineJoin = 'round';
      context.lineCap = 'round';
      context.beginPath();
      visiblePoints.forEach((point, index) => { if (index === 0) context.moveTo(mapX(point.x), mapY(point.y)); else context.lineTo(mapX(point.x), mapY(point.y)); });
      context.stroke();
      context.restore();
    }

    const launchX = mapX(0);
    const launchY = mapY(result.height);
    context.save();
    context.fillStyle = colors.text;
    context.globalAlpha = 0.72;
    context.beginPath(); context.arc(launchX, launchY, 3.5, 0, Math.PI * 2); context.fill();
    context.restore();

    if (result.apexTime > 0.02 && result.maxHeight > result.height + 0.02) {
      const apexX = mapX(result.vx * result.apexTime);
      const apexY = mapY(result.maxHeight);
      context.save();
      context.fillStyle = colors.warning;
      context.beginPath(); context.arc(apexX, apexY, 4, 0, Math.PI * 2); context.fill();
      context.restore();
      drawLabel(context, '最高点', Math.min(width - padding.right - 26, apexX + 8), Math.max(padding.top + 10, apexY - 14), 'center', colors.text);
    }

    const landingX = mapX(result.range);
    const landingY = mapY(0);
    context.save();
    context.strokeStyle = colors.primary;
    context.globalAlpha = state.progress >= 0.999 ? 0.95 : 0.4;
    context.lineWidth = 2;
    context.beginPath(); context.arc(landingX, landingY, 5, 0, Math.PI * 2); context.stroke();
    context.restore();
    if (state.progress >= 0.999) drawLabel(context, '落点', Math.min(width - padding.right - 20, landingX + 10), landingY - 16, 'center', colors.text);

    if (state.progress < 0.999) {
      const current = positionAt(result, result.flightTime * state.progress);
      const currentX = mapX(current.x);
      const currentY = mapY(current.y);
      context.save();
      context.strokeStyle = colors.text;
      context.globalAlpha = 0.18;
      context.setLineDash([4, 5]);
      context.beginPath(); context.moveTo(currentX, currentY); context.lineTo(currentX, landingY); context.stroke();
      context.beginPath(); context.moveTo(currentX, currentY); context.lineTo(padding.left, currentY); context.stroke();
      context.restore();
      context.save();
      context.fillStyle = '#ff8a3d';
      context.shadowColor = 'rgba(255, 138, 61, 0.75)';
      context.shadowBlur = 14;
      context.beginPath(); context.arc(currentX, currentY, 6, 0, Math.PI * 2); context.fill();
      context.restore();
    }
  }

  function drawAngleChart(result) {
    const { context, width, height } = canvasContext(elements.angleCanvas);
    context.clearRect(0, 0, width, height);
    if (!result) { drawEmpty(context, width, height, '参数有效后显示关系图'); return; }

    const colors = readColors();
    const padding = { left: 56, right: 22, top: 24, bottom: 46 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    if (plotWidth < 40 || plotHeight < 40) return;

    const rows = rangeCurve({ speed: result.speed, height: result.height, gravity: result.gravity }, 1);
    const maxRange = Math.max(1, ...rows.map((row) => row.range)) * 1.12;
    const mapX = (angle) => padding.left + (angle / 90) * plotWidth;
    const mapY = (range) => padding.top + plotHeight - (range / maxRange) * plotHeight;

    context.save();
    context.strokeStyle = colors.text;
    context.fillStyle = colors.text;
    context.lineWidth = 1;
    context.globalAlpha = 0.13;
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
      const angle = 90 * index / 4;
      const range = maxRange * (4 - index) / 4;
      context.textAlign = 'center';
      context.fillText(`${angle}°`, padding.left + plotWidth * index / 4, height - padding.bottom + 18);
      context.textAlign = 'right';
      context.fillText(formatNumber(range, 1), padding.left - 8, padding.top + plotHeight * index / 4);
    }
    context.textAlign = 'center';
    context.fillText('抛射角 / °', padding.left + plotWidth / 2, height - 10);
    context.save();
    context.translate(15, padding.top + plotHeight / 2);
    context.rotate(-Math.PI / 2);
    context.fillText('射程 / m', 0, 0);
    context.restore();
    context.restore();

    context.save();
    context.strokeStyle = colors.warning;
    context.globalAlpha = 0.32;
    context.setLineDash([5, 5]);
    context.beginPath(); context.moveTo(mapX(45), padding.top); context.lineTo(mapX(45), padding.top + plotHeight); context.stroke();
    context.restore();
    drawLabel(context, '45°', mapX(45), padding.top + 8, 'center', colors.text);

    const gradient = context.createLinearGradient(padding.left, 0, padding.left + plotWidth, 0);
    gradient.addColorStop(0, '#4f7cff');
    gradient.addColorStop(0.55, colors.primary);
    gradient.addColorStop(1, '#ff8a3d');
    context.save();
    context.strokeStyle = gradient;
    context.lineWidth = 2.6;
    context.lineJoin = 'round';
    context.beginPath();
    rows.forEach((row, index) => { if (index === 0) context.moveTo(mapX(row.angleDeg), mapY(row.range)); else context.lineTo(mapX(row.angleDeg), mapY(row.range)); });
    context.stroke();
    context.restore();

    const pointX = mapX(result.angleDeg);
    const pointY = mapY(result.range);
    context.save();
    context.fillStyle = '#ff8a3d';
    context.shadowColor = 'rgba(255, 138, 61, 0.8)';
    context.shadowBlur = 12;
    context.beginPath(); context.arc(pointX, pointY, 5.5, 0, Math.PI * 2); context.fill();
    context.restore();
    drawLabel(context, `${formatNumber(result.angleDeg, 0)}°`, Math.min(width - padding.right - 20, pointX + 12), Math.max(padding.top + 12, pointY - 14), 'center', colors.text);
  }

  function renderSummary(result) {
    const items = [
      ['飞行时间', `${formatNumber(result.flightTime)} s`],
      ['水平射程', `${formatNumber(result.range)} m`],
      ['最大高度', `${formatNumber(result.maxHeight)} m`],
      ['落地速度', `${formatNumber(result.landingSpeed)} m/s`],
      ['落地角', `${formatNumber(result.landingAngle, 1)}°`]
    ];
    elements.summary.replaceChildren(...items.map(([label, value]) => {
      const box = document.createElement('div'); box.className = 'stat';
      const term = document.createElement('dt'); term.textContent = label;
      const detail = document.createElement('dd'); detail.textContent = value;
      box.append(term, detail);
      return box;
    }));
  }

  function renderComparison(result) {
    const angle = Math.round(result.angleDeg * 10) / 10;
    const angles = [...new Set([...ANGLE_PRESETS, angle])].sort((left, right) => left - right);
    state.comparison = compareAngles({ speed: result.speed, height: result.height, gravity: result.gravity }, angles);
    elements.compareBody.replaceChildren(...state.comparison.map((row) => {
      const tr = document.createElement('tr');
      if (Math.abs(row.angleDeg - angle) < 0.05) tr.dataset.current = 'true';
      [['角度', `${formatNumber(row.angleDeg, 1)}°`], ['飞行时间', `${formatNumber(row.flightTime)} s`], ['水平射程', `${formatNumber(row.range)} m`], ['最大高度', `${formatNumber(row.maxHeight)} m`], ['落地速度', `${formatNumber(row.landingSpeed)} m/s`]].forEach(([label, value]) => {
        const cell = document.createElement('td'); cell.dataset.label = label; cell.textContent = value; tr.append(cell);
      });
      return tr;
    }));
  }

  function initReadout() {
    const labels = ['时间 t', '水平位移 x', '高度 y', '水平速度 vx', '竖直速度 vy'];
    state.readoutRefs = labels.map((label) => {
      const item = document.createElement('div'); item.className = 'readout-item';
      const name = document.createElement('span'); name.textContent = label;
      const value = document.createElement('b'); value.textContent = '—';
      item.append(name, value);
      return value;
    });
    elements.readout.replaceChildren(...state.readoutRefs.map((value) => value.parentElement));
  }

  function updateReadout(result, progress) {
    if (!state.readoutRefs.length) initReadout();
    const point = positionAt(result, result.flightTime * Math.max(0, Math.min(1, progress)));
    const values = [`${formatNumber(point.t)} s`, `${formatNumber(point.x)} m`, `${formatNumber(point.y)} m`, `${formatNumber(point.vx)} m/s`, `${formatNumber(point.vy)} m/s`];
    state.readoutRefs.forEach((node, index) => { node.textContent = values[index]; });
  }

  function renderUnavailable() {
    elements.summary.replaceChildren();
    const row = document.createElement('tr');
    const cell = document.createElement('td'); cell.colSpan = 5; cell.className = 'muted'; cell.textContent = '请先修正实验参数。';
    row.append(cell); elements.compareBody.replaceChildren(row);
    elements.readout.replaceChildren();
    state.readoutRefs = [];
  }

  function syncGravityPreset(gravity) {
    const preset = GRAVITY_PRESETS.find((item) => Math.abs(item.value - gravity) < 0.05);
    elements.gravityPreset.value = preset ? preset.id : 'custom';
  }

  function readInputs() {
    const raw = [elements.speed.value, elements.angle.value, elements.height.value, elements.gravity.value];
    if (raw.some((value) => String(value).trim() === '')) throw new Error('请填写完整的实验参数。');
    return { speed: Number(elements.speed.value), angleDeg: Number(elements.angle.value), height: Number(elements.height.value), gravity: Number(elements.gravity.value) };
  }

  function stopAnimation() {
    if (state.animationId) cancelAnimationFrame(state.animationId);
    state.animationId = 0;
  }

  function refresh(options = {}) {
    stopAnimation();
    try {
      const result = computeProjectile(readInputs());
      state.result = result;
      state.samples = sampleTrajectory(result, 160);
      syncGravityPreset(result.gravity);
      renderSummary(result);
      renderComparison(result);
      drawTrajectory(result, 1);
      drawAngleChart(result);
      updateReadout(result, 1);
      elements.launch.disabled = false;
      elements.export.disabled = false;
      if (options.announce) setStatus('参数已更新。', 'success');
    } catch (error) {
      state.result = null;
      state.samples = [];
      state.comparison = [];
      renderUnavailable();
      drawTrajectory(null, 0);
      drawAngleChart(null);
      elements.launch.disabled = true;
      elements.export.disabled = true;
      setStatus(error.message, 'error');
    }
  }

  function scheduleRefresh() {
    if (pendingRefresh) cancelAnimationFrame(pendingRefresh);
    pendingRefresh = requestAnimationFrame(() => { pendingRefresh = 0; refresh(); });
  }

  function redrawAll() {
    if (!state.result) return;
    drawTrajectory(state.result, state.progress);
    drawAngleChart(state.result);
  }

  function scheduleRedraw() {
    if (pendingRedraw) cancelAnimationFrame(pendingRedraw);
    pendingRedraw = requestAnimationFrame(() => { pendingRedraw = 0; redrawAll(); });
  }

  function launch() {
    if (!state.result) {
      refresh({ announce: true });
      if (!state.result) return;
    }
    stopAnimation();
    const result = state.result;
    root.OpenEduAnalytics?.toolUse?.('projectile-lab');
    if (state.reducedMotion) {
      drawTrajectory(result, 1);
      updateReadout(result, 1);
      setStatus(`已显示完整轨迹：飞行 ${formatNumber(result.flightTime)} s，射程 ${formatNumber(result.range)} m。`, 'success');
      return;
    }
    const duration = Math.min(4500, Math.max(900, result.flightTime * 700));
    const start = performance.now();
    setStatus('演示中…');
    function frame(now) {
      const progress = Math.min(1, (now - start) / duration);
      drawTrajectory(result, progress);
      updateReadout(result, progress);
      if (progress < 1) {
        state.animationId = requestAnimationFrame(frame);
      } else {
        state.animationId = 0;
        setStatus(`演示完成：飞行 ${formatNumber(result.flightTime)} s，射程 ${formatNumber(result.range)} m。`, 'success');
      }
    }
    state.animationId = requestAnimationFrame(frame);
  }

  function exportData() {
    if (!state.result) {
      refresh({ announce: true });
      if (!state.result) return;
    }
    const csv = buildExperimentCsv(state.result, state.samples, state.comparison);
    if (root.OETToolPage && typeof root.OETToolPage.downloadText === 'function') {
      root.OETToolPage.downloadText('抛体运动实验数据.csv', csv, 'text/csv;charset=utf-8');
      setStatus('已导出实验数据。', 'success');
    } else {
      setStatus('当前环境不支持下载，请手动记录结果。', 'error');
    }
  }

  function resetParameters() {
    stopAnimation();
    elements.gravity.value = String(DEFAULTS.gravity);
    elements.speed.value = String(DEFAULTS.speed);
    elements.angle.value = String(DEFAULTS.angleDeg);
    elements.height.value = String(DEFAULTS.height);
    elements.speedRange.value = String(DEFAULTS.speed);
    elements.angleRange.value = String(DEFAULTS.angleDeg);
    elements.heightRange.value = String(DEFAULTS.height);
    elements.gravityPreset.value = 'earth';
    refresh();
    setStatus('已恢复默认参数。', 'success');
  }

  function onParameterInput() {
    const raw = [elements.speed.value, elements.angle.value, elements.height.value, elements.gravity.value];
    if (raw.some((value) => String(value).trim() === '')) {
      setStatus('请填写完整的实验参数。', 'warning');
      return;
    }
    scheduleRefresh();
  }

  function bindPair(numberInput, rangeInput) {
    rangeInput.addEventListener('input', () => { numberInput.value = rangeInput.value; onParameterInput(); });
    numberInput.addEventListener('input', () => { if (numberInput.value !== '') rangeInput.value = numberInput.value; onParameterInput(); });
  }

  bindPair(elements.speed, elements.speedRange);
  bindPair(elements.angle, elements.angleRange);
  bindPair(elements.height, elements.heightRange);
  elements.gravity.addEventListener('input', onParameterInput);
  elements.gravityPreset.addEventListener('change', () => {
    const preset = GRAVITY_PRESETS.find((item) => item.id === elements.gravityPreset.value);
    if (!preset) { elements.gravity.focus(); return; }
    elements.gravity.value = String(preset.value);
    refresh();
  });
  elements.launch.addEventListener('click', launch);
  elements.export.addEventListener('click', exportData);
  elements.reset.addEventListener('click', resetParameters);
  window.addEventListener('resize', scheduleRedraw);
  document.querySelector('[data-theme-select]')?.addEventListener('change', () => setTimeout(redrawAll, 0));
  if (motionQuery) {
    if (typeof motionQuery.addEventListener === 'function') motionQuery.addEventListener('change', (event) => { state.reducedMotion = event.matches; });
    else if (typeof motionQuery.addListener === 'function') motionQuery.addListener((event) => { state.reducedMotion = event.matches; });
  }

  initReadout();
  refresh();
  setStatus('调整参数后点击「发射演示」，观察轨迹与数据的变化。');
})(typeof globalThis !== 'undefined' ? globalThis : this);
