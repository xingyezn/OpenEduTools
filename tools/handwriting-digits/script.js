(function (root) {
  'use strict';
  const CONFIG = { CANVAS_SIZE: 400, OUTPUT_SIZE: 50, DEFAULT_COUNT: 100, MIN_COUNT: 1, MAX_COUNT: 999, THRESHOLD: 128, DATA_FOLDER: 'data', STORAGE_KEY: 'openEduTools:tool:handwriting-digits:settings' };

  function binarizePixels(pixels, threshold = CONFIG.THRESHOLD) {
    const binary = new Uint8Array(pixels.length / 4);
    for (let index = 0; index < pixels.length; index += 4) {
      const average = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
      binary[index / 4] = average < threshold ? 1 : 0;
    }
    return binary;
  }
  function formatBinaryGrid(binary, width, height) {
    const rows = [];
    for (let row = 0; row < height; row += 1) rows.push(Array.from(binary.slice(row * width, row * width + width)).join(''));
    return rows.join('\n');
  }
  function binaryToText(binary) { return Array.from(binary).join(''); }
  function sanitizeFilenamePart(value) {
    return String(value || '').trim().replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'student';
  }
  function buildSampleFilename(studentId, index, target) { return `${sanitizeFilenamePart(studentId)}-${String(index).padStart(3, '0')}-${target}`; }
  const api = { binarizePixels, formatBinaryGrid, binaryToText, sanitizeFilenamePart, buildSampleFilename };
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;

  const elements = Object.fromEntries(['studentId', 'maxCount', 'maxCountLabel', 'drawingCanvas', 'previewCanvas', 'targetNumber', 'collectedCount', 'currentIndex', 'binaryData', 'status', 'startHint', 'clearBtn', 'saveBtn', 'startBtn', 'fullscreenBtn', 'collectionStage', 'exportAllBtn', 'clearAllBtn', 'selectFolderBtn', 'folderInfo', 'folderPath', 'remember'].map((id) => [id, document.getElementById(id)]));
  const drawCtx = elements.drawingCanvas.getContext('2d');
  const previewCtx = elements.previewCanvas.getContext('2d');
  const state = { studentId: '', currentIndex: 1, maxCount: CONFIG.DEFAULT_COUNT, collectedData: [], isDrawing: false, collecting: false, currentTarget: 0, directoryHandle: null, useFileSystemAPI: false };
  let resetTimer = 0;

  function setStatus(message, kind = '') { elements.status.textContent = message; elements.status.dataset.kind = kind; }
  function canStart() { return Boolean(state.studentId) && (!state.useFileSystemAPI || Boolean(state.directoryHandle)); }
  function normalizeCount(value) { const count = Number(value); return Number.isInteger(count) && count >= CONFIG.MIN_COUNT && count <= CONFIG.MAX_COUNT ? count : null; }
  function setupCanvas() {
    drawCtx.fillStyle = '#ffffff'; drawCtx.fillRect(0, 0, CONFIG.CANVAS_SIZE, CONFIG.CANVAS_SIZE);
    drawCtx.strokeStyle = '#111111'; drawCtx.lineWidth = 20; drawCtx.lineCap = 'round'; drawCtx.lineJoin = 'round';
  }
  function canvasPoint(event) {
    const rect = elements.drawingCanvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (CONFIG.CANVAS_SIZE / rect.width), y: (event.clientY - rect.top) * (CONFIG.CANVAS_SIZE / rect.height) };
  }
  function startDrawing(event) {
    if (!state.collecting) { setStatus('请先填写学号并选择保存文件夹，然后点击「开始收集」。', 'warning'); return; }
    event.preventDefault(); state.isDrawing = true;
    if (elements.drawingCanvas.setPointerCapture) elements.drawingCanvas.setPointerCapture(event.pointerId);
    const point = canvasPoint(event); drawCtx.beginPath(); drawCtx.moveTo(point.x, point.y);
  }
  function draw(event) {
    if (!state.isDrawing) return;
    event.preventDefault();
    const point = canvasPoint(event); drawCtx.lineTo(point.x, point.y); drawCtx.stroke(); updatePreview();
  }
  function stopDrawing() { if (!state.isDrawing) return; state.isDrawing = false; drawCtx.beginPath(); updatePreview(); }
  function clearCanvas(announce = true) {
    drawCtx.fillStyle = '#ffffff'; drawCtx.fillRect(0, 0, CONFIG.CANVAS_SIZE, CONFIG.CANVAS_SIZE); updatePreview();
    if (announce) setStatus('画布已清空。');
  }
  function updatePreview() {
    const temp = document.createElement('canvas'); temp.width = CONFIG.OUTPUT_SIZE; temp.height = CONFIG.OUTPUT_SIZE;
    const tempCtx = temp.getContext('2d'); tempCtx.drawImage(elements.drawingCanvas, 0, 0, CONFIG.OUTPUT_SIZE, CONFIG.OUTPUT_SIZE);
    const imageData = tempCtx.getImageData(0, 0, CONFIG.OUTPUT_SIZE, CONFIG.OUTPUT_SIZE);
    const binary = binarizePixels(imageData.data);
    for (let index = 0; index < imageData.data.length; index += 4) {
      const value = binary[index / 4] === 1 ? 0 : 255;
      imageData.data[index] = value; imageData.data[index + 1] = value; imageData.data[index + 2] = value; imageData.data[index + 3] = 255;
    }
    previewCtx.putImageData(imageData, 0, 0);
    elements.binaryData.textContent = formatBinaryGrid(binary, CONFIG.OUTPUT_SIZE, CONFIG.OUTPUT_SIZE);
    return binary;
  }
  function generateTargetNumber() { state.currentTarget = Math.floor(Math.random() * 10); elements.targetNumber.textContent = state.currentTarget; }
  function updateUI() {
    elements.collectedCount.textContent = state.collectedData.length;
    elements.currentIndex.textContent = state.currentIndex;
    elements.maxCountLabel.textContent = state.maxCount;
    const done = state.currentIndex > state.maxCount;
    elements.saveBtn.disabled = !state.collecting || done;
    elements.saveBtn.textContent = done ? `已完成 ${state.maxCount} 张` : '保存 / 下一个';
    elements.startBtn.textContent = state.collecting ? '结束收集' : '开始收集';
    elements.startBtn.disabled = false;
    elements.startBtn.title = state.collecting || canStart() ? '' : '请先填写学号并选择保存文件夹';
    elements.startHint.textContent = startHint();
    const hasData = state.collectedData.length > 0;
    elements.exportAllBtn.hidden = !hasData; elements.clearAllBtn.hidden = !hasData;
  }
  function startHint() {
    if (state.collecting) return '收集进行中：书写完成后点击「保存 / 下一个」。';
    if (!state.studentId) return '请先填写学生学号。';
    if (state.useFileSystemAPI && !state.directoryHandle) return '请选择保存文件夹后再开始收集。';
    return '准备就绪，点击「开始收集」。';
  }
  function persistSettings() {
    if (!elements.remember.checked) { try { localStorage.removeItem(CONFIG.STORAGE_KEY); } catch { /* 存储不可用时忽略 */ } return; }
    try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({ studentId: state.studentId, currentIndex: state.currentIndex, maxCount: state.maxCount })); } catch { /* 存储不可用时忽略 */ }
  }
  function loadSettings() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || 'null'); } catch { saved = null; }
    if (!saved || typeof saved !== 'object') return;
    elements.remember.checked = true;
    state.studentId = typeof saved.studentId === 'string' ? saved.studentId : '';
    state.currentIndex = Number.isInteger(saved.currentIndex) && saved.currentIndex > 0 ? saved.currentIndex : 1;
    const savedCount = normalizeCount(saved.maxCount);
    if (savedCount) { state.maxCount = savedCount; elements.maxCount.value = String(savedCount); }
    elements.studentId.value = state.studentId;
  }
  function checkFileSystemSupport() {
    state.useFileSystemAPI = typeof window.showDirectoryPicker === 'function';
    elements.selectFolderBtn.hidden = !state.useFileSystemAPI;
    if (!state.useFileSystemAPI) setStatus('当前浏览器不支持直接保存到文件夹，将使用下载方式。', 'warning');
  }
  async function selectFolder() {
    try {
      let handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      try { handle = await handle.getDirectoryHandle(CONFIG.DATA_FOLDER, { create: true }); } catch { /* 使用所选文件夹本身 */ }
      state.directoryHandle = handle;
      elements.folderPath.textContent = handle.name; elements.folderInfo.hidden = false;
      setStatus(`已选择保存文件夹：${handle.name}`, 'success');
      updateUI();
      return true;
    } catch (error) {
      if (error.name === 'AbortError') setStatus('已取消选择文件夹。', 'warning');
      else setStatus(`选择文件夹失败：${error.message}`, 'error');
      return false;
    }
  }
  async function handleStart() {
    if (state.collecting) { stopCollecting(); return; }
    if (!state.studentId) { setStatus('请先填写学生学号。', 'warning'); elements.studentId.focus(); return; }
    if (state.useFileSystemAPI && !state.directoryHandle) {
      setStatus('请选择保存文件夹后再开始收集。', 'warning');
      if (!(await selectFolder())) return;
    }
    startCollecting();
  }
  function startCollecting() {
    if (!canStart()) { setStatus('请先填写学号并选择保存文件夹。', 'warning'); return; }
    state.collecting = true; updateUI(); setStatus(`开始收集，请书写数字 ${state.currentTarget}。`, 'success');
    try { elements.drawingCanvas.focus(); } catch { /* 画布不可聚焦时忽略 */ }
  }
  function stopCollecting() {
    state.collecting = false;
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    updateUI(); setStatus('已结束收集，可导出或清空数据。', 'info');
  }
  function toggleFullscreen() {
    const stage = elements.collectionStage;
    try {
      if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen().catch(() => {}); }
      else if (stage.requestFullscreen) stage.requestFullscreen().catch(() => root.OETToolPage.showToast('无法进入全屏，可使用浏览器缩放。'));
      else root.OETToolPage.showToast('当前浏览器不支持全屏，可使用浏览器缩放。');
    } catch { root.OETToolPage.showToast('当前浏览器不支持全屏，可使用浏览器缩放。'); }
  }
  function downloadBlob(url, filename) {
    const link = document.createElement('a'); link.href = url; link.download = filename;
    document.body.append(link); link.click(); link.remove();
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  }
  function saveWithDownload(filename, data) {
    downloadBlob(elements.previewCanvas.toDataURL('image/png'), `${filename}.png`);
    const text = binaryToText(data.binaryData);
    downloadBlob(URL.createObjectURL(new Blob([text], { type: 'text/plain' })), `${filename}.txt`);
    setStatus(`已下载 ${filename}.png 与 .txt，请检查下载文件夹。`, 'info');
  }
  function canvasBlob(canvas, type) { return new Promise((resolve) => canvas.toBlob(resolve, type)); }
  async function saveWithFileSystemAPI(filename, data) {
    try {
      const pngHandle = await state.directoryHandle.getFileHandle(`${filename}.png`, { create: true });
      const pngWritable = await pngHandle.createWritable(); await pngWritable.write(await canvasBlob(elements.previewCanvas, 'image/png')); await pngWritable.close();
      const txtHandle = await state.directoryHandle.getFileHandle(`${filename}.txt`, { create: true });
      const txtWritable = await txtHandle.createWritable(); await txtWritable.write(new Blob([binaryToText(data.binaryData)], { type: 'text/plain' })); await txtWritable.close();
      setStatus(`已保存到本地文件夹：${filename}`, 'success');
    } catch (error) {
      setStatus(`保存到文件夹失败：${error.message}，已改用下载方式。`, 'error');
      saveWithDownload(`${filename}_fallback`, data);
    }
  }
  async function saveFiles(data) {
    const filename = buildSampleFilename(data.studentId, data.index, data.target);
    if (state.useFileSystemAPI && state.directoryHandle) await saveWithFileSystemAPI(filename, data);
    else saveWithDownload(filename, data);
  }
  async function saveCurrent() {
    if (!state.collecting) { setStatus('请先点击「开始收集」。', 'warning'); return; }
    if (!state.studentId) { setStatus('请先输入学生学号。', 'error'); elements.studentId.focus(); return; }
    if (state.currentIndex > state.maxCount) { setStatus(`已完成 ${state.maxCount} 张收集。`, 'success'); return; }
    const binary = updatePreview();
    const data = { studentId: state.studentId, index: state.currentIndex, target: state.currentTarget, binaryData: Array.from(binary), timestamp: new Date().toISOString() };
    state.collectedData.push(data);
    elements.saveBtn.disabled = true;
    await saveFiles(data);
    state.currentIndex += 1; updateUI(); persistSettings();
    setStatus(`已保存第 ${data.index} 张，下一个目标数字准备中…`, 'success');
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { clearCanvas(false); generateTargetNumber(); setStatus(`已保存第 ${data.index} 张，请书写数字 ${state.currentTarget}。`, 'success'); }, 450);
  }
  async function exportAllData() {
    if (!state.collectedData.length) { setStatus('暂无数据可导出。', 'error'); return; }
    const payload = { studentId: state.studentId, totalCollected: state.collectedData.length, exportTime: new Date().toISOString(), data: state.collectedData };
    const json = JSON.stringify(payload, null, 2);
    const filename = `${sanitizeFilenamePart(state.studentId)}_all_data.json`;
    if (state.useFileSystemAPI && state.directoryHandle) {
      try {
        const handle = await state.directoryHandle.getFileHandle(filename, { create: true });
        const writable = await handle.createWritable(); await writable.write(new Blob([json], { type: 'application/json' })); await writable.close();
        setStatus(`已导出 ${state.collectedData.length} 条数据到本地文件夹。`, 'success');
      } catch (error) { setStatus(`导出失败：${error.message}`, 'error'); }
    } else {
      root.OETToolPage.downloadText(filename, json, 'application/json');
      setStatus(`已导出 ${state.collectedData.length} 条数据。`, 'success');
    }
  }
  function clearAllData() {
    if (!state.collectedData.length) return;
    if (!root.confirm('确定要清空本次会话已收集的数据吗？已保存到磁盘的文件不受影响。')) return;
    state.collectedData = []; state.currentIndex = 1; updateUI(); persistSettings();
    setStatus('已清空本次会话数据。', 'info');
  }
  function init() {
    setupCanvas(); checkFileSystemSupport(); loadSettings(); elements.maxCount.value = String(state.maxCount); generateTargetNumber(); updateUI(); clearCanvas(false);
    elements.drawingCanvas.addEventListener('pointerdown', startDrawing);
    elements.drawingCanvas.addEventListener('pointermove', draw);
    elements.drawingCanvas.addEventListener('pointerup', stopDrawing);
    elements.drawingCanvas.addEventListener('pointercancel', stopDrawing);
    elements.clearBtn.addEventListener('click', () => clearCanvas(true));
    elements.saveBtn.addEventListener('click', saveCurrent);
    elements.startBtn.addEventListener('click', handleStart);
    elements.fullscreenBtn.addEventListener('click', toggleFullscreen);
    elements.exportAllBtn.addEventListener('click', exportAllData);
    elements.clearAllBtn.addEventListener('click', clearAllData);
    elements.selectFolderBtn.addEventListener('click', selectFolder);
    elements.remember.addEventListener('change', () => { persistSettings(); setStatus(elements.remember.checked ? '已在本机记住学号与进度。' : '已关闭本机记录。', 'info'); });
    elements.studentId.addEventListener('input', (event) => { state.studentId = event.target.value.trim(); updateUI(); });
    elements.studentId.addEventListener('change', persistSettings);
    elements.maxCount.addEventListener('input', (event) => { const count = normalizeCount(event.target.value); if (count) { state.maxCount = count; updateUI(); } });
    elements.maxCount.addEventListener('change', () => { if (!normalizeCount(elements.maxCount.value)) elements.maxCount.value = String(state.maxCount); persistSettings(); });
    document.addEventListener('fullscreenchange', () => { elements.fullscreenBtn.textContent = document.fullscreenElement ? '退出全屏' : '全屏'; });
    document.addEventListener('keydown', (event) => {
      const tag = (event.target.tagName || '').toUpperCase();
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); clearCanvas(true); }
      else if (event.key === 'Enter' || event.code === 'Space') { event.preventDefault(); if (state.collecting) saveCurrent(); else startCollecting(); }
    });
  }
  init();
})(typeof globalThis !== 'undefined' ? globalThis : this);
