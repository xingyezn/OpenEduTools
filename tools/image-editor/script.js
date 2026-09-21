(function (root) {
  'use strict';

  const STANDARD_SIZES = [
    { id: 'one-inch', name: '一寸 25×35mm', px: [295, 413] },
    { id: 'small-one-inch', name: '小一寸 22×32mm', px: [260, 378] },
    { id: 'big-one-inch', name: '大一寸 33×48mm', px: [390, 567] },
    { id: 'two-inch', name: '二寸 35×49mm', px: [413, 579] },
    { id: 'small-two-inch', name: '小二寸 35×45mm', px: [413, 531] },
    { id: 'big-two-inch', name: '大二寸 35×53mm', px: [413, 626] },
    { id: 'passport', name: '护照 33×48mm', px: [390, 567] }
  ];
  const ASPECT_RATIOS = [
    { id: 'free', name: '自由', ratio: null },
    { id: '1:1', name: '1 : 1', ratio: 1 },
    { id: '4:3', name: '4 : 3', ratio: 4 / 3 },
    { id: '3:4', name: '3 : 4', ratio: 3 / 4 },
    { id: '16:9', name: '16 : 9', ratio: 16 / 9 },
    { id: '9:16', name: '9 : 16', ratio: 9 / 16 },
    { id: '3:2', name: '3 : 2', ratio: 3 / 2 },
    { id: '2:3', name: '2 : 3', ratio: 2 / 3 }
  ];
  const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function fitDimensions(width, height, maxWidth, maxHeight) {
    if (!width || !height) return { width: 1, height: 1, scale: 1 };
    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale };
  }
  function buildFilter(adjust) {
    const parts = [];
    const round = (value) => Math.round(value * 1000) / 1000;
    if (adjust.brightness !== 1) parts.push(`brightness(${round(adjust.brightness)})`);
    if (adjust.contrast !== 1) parts.push(`contrast(${round(adjust.contrast)})`);
    if (adjust.saturate !== 1) parts.push(`saturate(${round(adjust.saturate)})`);
    if (adjust.hue) parts.push(`hue-rotate(${Math.round(adjust.hue)}deg)`);
    if (adjust.grayscale) parts.push(`grayscale(${Math.round(adjust.grayscale)}%)`);
    if (adjust.sepia) parts.push(`sepia(${Math.round(adjust.sepia)}%)`);
    return parts.length ? parts.join(' ') : 'none';
  }
  function resolveOutputSize(options) {
    const cropWidth = Math.max(1, options.cropWidth || 1); const cropHeight = Math.max(1, options.cropHeight || 1);
    if (options.mode === 'spec' && Array.isArray(options.specPx) && options.specPx[0] > 0 && options.specPx[1] > 0) return { width: Math.round(options.specPx[0]), height: Math.round(options.specPx[1]) };
    if (options.mode === 'custom') {
      const width = Number(options.customWidth); const height = Number(options.customHeight);
      if (options.keepRatio) {
        if (width > 0) return { width: Math.round(width), height: Math.max(1, Math.round(width * cropHeight / cropWidth)) };
        if (height > 0) return { width: Math.max(1, Math.round(height * cropWidth / cropHeight)), height: Math.round(height) };
      } else if (width > 0 && height > 0) {
        return { width: Math.round(width), height: Math.round(height) };
      }
    }
    return { width: Math.round(cropWidth), height: Math.round(cropHeight) };
  }
  function constrainCrop(rect, aspect, bounds) {
    let width = Math.max(1, rect.width); let height = Math.max(1, rect.height);
    if (aspect) { if (width / height > aspect) width = height * aspect; else height = width / aspect; }
    width = Math.min(width, bounds.width); height = Math.min(height, bounds.height);
    if (aspect) { if (width / height > aspect) width = height * aspect; else height = width / aspect; }
    const x = clamp(rect.x, 0, Math.max(0, bounds.width - width));
    const y = clamp(rect.y, 0, Math.max(0, bounds.height - height));
    return { x, y, width, height };
  }
  function resizeCrop(start, handle, dx, dy, aspect, bounds) {
    const right = start.x + start.width; const bottom = start.y + start.height;
    let x = start.x; let y = start.y; let width = start.width; let height = start.height;
    if (handle.includes('w')) { x = start.x + dx; width = right - x; }
    if (handle.includes('e')) { width = start.width + dx; }
    if (handle.includes('n')) { y = start.y + dy; height = bottom - y; }
    if (handle.includes('s')) { height = start.height + dy; }
    if (width < 1) { x += width - 1; width = 1; }
    if (height < 1) { y += height - 1; height = 1; }
    if (aspect) {
      const corner = handle.length === 2;
      if (corner || handle === 'e' || handle === 'w') {
        height = width / aspect;
        if (!corner) { const center = start.y + start.height / 2; y = center - height / 2; }
        else if (handle.includes('n')) y = bottom - height;
      } else {
        width = height * aspect;
        const center = start.x + start.width / 2; x = center - width / 2;
      }
    }
    if (x < 0) { width += x; if (aspect) height = width / aspect; x = 0; }
    if (y < 0) { height += y; if (aspect) width = height * aspect; y = 0; }
    if (x + width > bounds.width) { width = bounds.width - x; if (aspect) height = width / aspect; }
    if (y + height > bounds.height) { height = bounds.height - y; if (aspect) width = height * aspect; }
    return { x, y, width: Math.max(1, width), height: Math.max(1, height) };
  }
  function formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value < 0) return '';
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1024 / 1024).toFixed(2)} MB`;
  }
  function extensionFor(format) { return format === 'image/jpeg' ? 'jpg' : (format === 'image/webp' ? 'webp' : 'png'); }

  const api = { STANDARD_SIZES, ASPECT_RATIOS, clamp, fitDimensions, buildFilter, resolveOutputSize, constrainCrop, resizeCrop, formatBytes, extensionFor };
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;

  const elements = Object.fromEntries(['loadBtn', 'fileInput', 'rotateLeftBtn', 'rotateRightBtn', 'flipHBtn', 'flipVBtn', 'resetImageBtn', 'stage', 'canvasWrap', 'stageCanvas', 'cropBox', 'stageEmpty', 'imageMeta', 'ratioSelect', 'specSelect', 'brightness', 'brightnessValue', 'contrast', 'contrastValue', 'saturate', 'saturateValue', 'hue', 'hueValue', 'grayscale', 'grayscaleValue', 'sepia', 'sepiaValue', 'resetAdjustBtn', 'formatSelect', 'sizeMode', 'quality', 'qualityValue', 'customWidth', 'customHeight', 'keepRatio', 'fileName', 'previewCanvas', 'outputInfo', 'downloadBtn', 'copyImageBtn', 'status'].map((id) => [id, document.getElementById(id)]));
  const context = elements.stageCanvas.getContext('2d');
  const previewContext = elements.previewCanvas.getContext('2d');
  const state = { image: null, file: null, working: null, workingW: 0, workingH: 0, crop: { x: 0, y: 0, width: 0, height: 0 }, orientation: { rotate: 0, flipH: false, flipV: false }, aspect: null, spec: null, adjust: { brightness: 1, contrast: 1, saturate: 1, hue: 0, grayscale: 0, sepia: 0 } };
  let drag = null; let previewTimer = 0;

  function setStatus(message, kind = '') { elements.status.textContent = message; elements.status.dataset.kind = kind; }
  function setControlsEnabled(enabled) { elements.downloadBtn.disabled = !enabled; elements.copyImageBtn.disabled = !enabled; }
  function populateSelects() {
    elements.ratioSelect.replaceChildren(...ASPECT_RATIOS.map((item) => { const option = document.createElement('option'); option.value = item.id; option.textContent = item.name; return option; }));
    const specOptions = [Object.assign(document.createElement('option'), { value: '', textContent: '不使用' })];
    for (const spec of STANDARD_SIZES) { const option = document.createElement('option'); option.value = spec.id; option.textContent = spec.name; specOptions.push(option); }
    elements.specSelect.replaceChildren(...specOptions);
  }
  function buildWorking() {
    const image = state.image; if (!image) return;
    const rotate = state.orientation.rotate;
    const swap = rotate % 180 !== 0;
    const width = swap ? image.naturalHeight : image.naturalWidth;
    const height = swap ? image.naturalWidth : image.naturalHeight;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.translate(width / 2, height / 2);
    ctx.rotate(rotate * Math.PI / 180);
    ctx.scale(state.orientation.flipH ? -1 : 1, state.orientation.flipV ? -1 : 1);
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    state.working = canvas; state.workingW = width; state.workingH = height;
    elements.stageCanvas.width = width; elements.stageCanvas.height = height;
    context.drawImage(canvas, 0, 0);
  }
  function resetCrop() {
    const bounds = { width: state.workingW, height: state.workingH };
    if (state.aspect) {
      let width = bounds.width; let height = width / state.aspect;
      if (height > bounds.height) { height = bounds.height; width = height * state.aspect; }
      state.crop = { x: (bounds.width - width) / 2, y: (bounds.height - height) / 2, width, height };
    } else {
      state.crop = { x: 0, y: 0, width: bounds.width, height: bounds.height };
    }
  }
  function syncCropBox() {
    if (!state.working) return;
    const rect = elements.stageCanvas.getBoundingClientRect();
    if (!rect.width || !state.workingW) return;
    const scale = rect.width / state.workingW;
    elements.cropBox.style.left = `${state.crop.x * scale}px`;
    elements.cropBox.style.top = `${state.crop.y * scale}px`;
    elements.cropBox.style.width = `${state.crop.width * scale}px`;
    elements.cropBox.style.height = `${state.crop.height * scale}px`;
    elements.stageCanvas.style.filter = buildFilter(state.adjust);
  }
  function updateMeta() {
    if (!state.image) { elements.imageMeta.textContent = ''; return; }
    const parts = [`原图 ${state.image.naturalWidth}×${state.image.naturalHeight}`, `当前 ${state.workingW}×${state.workingH}`];
    if (state.file) parts.push(`${state.file.name} · ${formatBytes(state.file.size)}`);
    elements.imageMeta.textContent = parts.join('　');
  }
  function currentOutput() {
    const spec = state.spec || STANDARD_SIZES.find((item) => item.id === elements.specSelect.value) || null;
    return resolveOutputSize({ cropWidth: state.crop.width, cropHeight: state.crop.height, mode: elements.sizeMode.value, specPx: spec ? spec.px : null, customWidth: elements.customWidth.value, customHeight: elements.customHeight.value, keepRatio: elements.keepRatio.checked });
  }
  function drawCrop(target, targetWidth, targetHeight) {
    target.width = targetWidth; target.height = targetHeight;
    const ctx = target.getContext('2d');
    const format = elements.formatSelect.value;
    if (format === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, targetWidth, targetHeight); }
    const filter = buildFilter(state.adjust);
    if (filter !== 'none' && 'filter' in ctx) ctx.filter = filter;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(state.working, state.crop.x, state.crop.y, state.crop.width, state.crop.height, 0, 0, targetWidth, targetHeight);
    ctx.filter = 'none';
  }
  function renderPreview() {
    if (!state.working) return;
    const output = currentOutput();
    const preview = fitDimensions(output.width, output.height, 480, 480);
    drawCrop(elements.previewCanvas, preview.width, preview.height);
    elements.outputInfo.textContent = `${output.width} × ${output.height} px · ${elements.formatSelect.options[elements.formatSelect.selectedIndex].textContent}`;
  }
  function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(renderPreview, 120); }
  function loadFile(file) {
    if (!file || !/^image\//.test(file.type)) { setStatus('请选择图片文件。', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => loadDataUrl(String(reader.result), file);
    reader.onerror = () => setStatus('无法读取该文件。', 'error');
    reader.readAsDataURL(file);
  }
  function loadDataUrl(url, file) {
    const image = new Image();
    image.onload = () => {
      state.image = image; state.file = file || null; state.orientation = { rotate: 0, flipH: false, flipV: false };
      buildWorking(); resetCrop(); updateMeta(); syncCropBox(); renderPreview(); setControlsEnabled(true);
      elements.canvasWrap.hidden = false; elements.stageEmpty.hidden = true;
      setStatus('图片已载入，可拖动裁切框或调整参数。', 'success');
    };
    image.onerror = () => setStatus('无法解析该图片。', 'error');
    image.src = url;
  }
  function applyOrientation() {
    if (!state.image) return;
    buildWorking(); resetCrop(); updateMeta(); syncCropBox(); renderPreview();
  }
  function resetImage() {
    if (!state.image) return;
    state.orientation = { rotate: 0, flipH: false, flipV: false };
    state.adjust = { brightness: 1, contrast: 1, saturate: 1, hue: 0, grayscale: 0, sepia: 0 };
    elements.brightness.value = '100'; elements.contrast.value = '100'; elements.saturate.value = '100'; elements.hue.value = '0'; elements.grayscale.value = '0'; elements.sepia.value = '0';
    elements.ratioSelect.value = 'free'; elements.specSelect.value = ''; state.aspect = null; state.spec = null;
    elements.sizeMode.value = 'crop'; elements.formatSelect.value = 'image/png';
    applyOrientation(); updateSliderOutputs(); setStatus('已重置。', 'info');
  }
  function updateSliderOutputs() {
    elements.brightnessValue.textContent = elements.brightness.value;
    elements.contrastValue.textContent = elements.contrast.value;
    elements.saturateValue.textContent = elements.saturate.value;
    elements.hueValue.textContent = elements.hue.value;
    elements.grayscaleValue.textContent = elements.grayscale.value;
    elements.sepiaValue.textContent = elements.sepia.value;
    elements.qualityValue.textContent = elements.quality.value;
  }
  function readAdjust() {
    state.adjust = { brightness: Number(elements.brightness.value) / 100, contrast: Number(elements.contrast.value) / 100, saturate: Number(elements.saturate.value) / 100, hue: Number(elements.hue.value), grayscale: Number(elements.grayscale.value), sepia: Number(elements.sepia.value) };
    updateSliderOutputs(); syncCropBox(); schedulePreview();
  }
  function applyRatio() {
    const item = ASPECT_RATIOS.find((entry) => entry.id === elements.ratioSelect.value) || ASPECT_RATIOS[0];
    state.spec = null; elements.specSelect.value = ''; state.aspect = item.ratio;
    if (state.working) { resetCrop(); syncCropBox(); schedulePreview(); }
  }
  function applySpec() {
    const spec = STANDARD_SIZES.find((item) => item.id === elements.specSelect.value);
    if (!spec) { state.spec = null; state.aspect = null; if (state.working) { resetCrop(); syncCropBox(); schedulePreview(); } return; }
    state.spec = spec; state.aspect = spec.px[0] / spec.px[1]; elements.ratioSelect.value = 'free'; elements.sizeMode.value = 'spec';
    if (state.working) { resetCrop(); syncCropBox(); schedulePreview(); }
  }
  async function exportBlob(forcePng) {
    const output = currentOutput();
    const canvas = document.createElement('canvas');
    const format = forcePng ? 'image/png' : elements.formatSelect.value;
    drawCrop(canvas, output.width, output.height);
    const quality = Number(elements.quality.value) / 100;
    return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), format, format === 'image/png' ? undefined : quality));
  }
  async function downloadImage() {
    if (!state.image) return;
    try {
      const format = elements.formatSelect.value;
      const blob = await exportBlob(false); if (!blob) throw new Error('导出失败');
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      const name = (elements.fileName.value.trim() || 'edited-image').replace(/[\\/:*?"<>|]/g, '-');
      link.href = url; link.download = `${name}.${extensionFor(format)}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
      root.OpenEduAnalytics?.toolUse?.('image-editor');
      setStatus(`已导出 ${link.download}（${formatBytes(blob.size)}）。`, 'success');
    } catch (error) { setStatus(`导出失败：${error.message}`, 'error'); }
  }
  async function copyImage() {
    if (!state.image) return;
    try {
      if (!navigator.clipboard || typeof ClipboardItem === 'undefined') throw new Error('当前浏览器不支持复制图片');
      const blob = await exportBlob(true);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setStatus('图片已复制到剪贴板。', 'success');
    } catch (error) { setStatus(`复制失败：${error.message}，可改用下载。`, 'error'); }
  }
  function pointerToWorking(event) {
    const rect = elements.stageCanvas.getBoundingClientRect();
    const scale = rect.width / state.workingW;
    return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale, scale };
  }
  function onCropPointerDown(event) {
    if (!state.working) return;
    const handle = event.target.dataset ? event.target.dataset.handle : null;
    drag = { handle: handle || 'move', startX: event.clientX, startY: event.clientY, startCrop: Object.assign({}, state.crop) };
    elements.cropBox.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }
  function onCropPointerMove(event) {
    if (!drag || !state.working) return;
    const rect = elements.stageCanvas.getBoundingClientRect();
    const scale = rect.width / state.workingW || 1;
    const dx = (event.clientX - drag.startX) / scale; const dy = (event.clientY - drag.startY) / scale;
    const bounds = { width: state.workingW, height: state.workingH };
    if (drag.handle === 'move') {
      state.crop = constrainCrop({ x: drag.startCrop.x + dx, y: drag.startCrop.y + dy, width: drag.startCrop.width, height: drag.startCrop.height }, state.aspect, bounds);
    } else {
      state.crop = resizeCrop(drag.startCrop, drag.handle, dx, dy, state.aspect, bounds);
    }
    syncCropBox(); schedulePreview();
  }
  function endCropDrag() { drag = null; }

  populateSelects();
  elements.loadBtn.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', (event) => { const file = event.target.files && event.target.files[0]; if (file) loadFile(file); event.target.value = ''; });
  elements.rotateLeftBtn.addEventListener('click', () => { state.orientation.rotate = (state.orientation.rotate + 270) % 360; applyOrientation(); });
  elements.rotateRightBtn.addEventListener('click', () => { state.orientation.rotate = (state.orientation.rotate + 90) % 360; applyOrientation(); });
  elements.flipHBtn.addEventListener('click', () => { state.orientation.flipH = !state.orientation.flipH; applyOrientation(); });
  elements.flipVBtn.addEventListener('click', () => { state.orientation.flipV = !state.orientation.flipV; applyOrientation(); });
  elements.resetImageBtn.addEventListener('click', resetImage);
  elements.ratioSelect.addEventListener('change', applyRatio);
  elements.specSelect.addEventListener('change', applySpec);
  for (const id of ['brightness', 'contrast', 'saturate', 'hue', 'grayscale', 'sepia']) elements[id].addEventListener('input', readAdjust);
  elements.resetAdjustBtn.addEventListener('click', () => { state.adjust = { brightness: 1, contrast: 1, saturate: 1, hue: 0, grayscale: 0, sepia: 0 }; elements.brightness.value = '100'; elements.contrast.value = '100'; elements.saturate.value = '100'; elements.hue.value = '0'; elements.grayscale.value = '0'; elements.sepia.value = '0'; readAdjust(); });
  elements.quality.addEventListener('input', updateSliderOutputs);
  for (const id of ['formatSelect', 'sizeMode', 'customWidth', 'customHeight', 'keepRatio']) elements[id].addEventListener('change', schedulePreview);
  elements.downloadBtn.addEventListener('click', downloadImage);
  elements.copyImageBtn.addEventListener('click', copyImage);
  elements.cropBox.addEventListener('pointerdown', onCropPointerDown);
  elements.cropBox.addEventListener('pointermove', onCropPointerMove);
  elements.cropBox.addEventListener('pointerup', endCropDrag);
  elements.cropBox.addEventListener('pointercancel', endCropDrag);
  elements.stage.addEventListener('dragover', (event) => event.preventDefault());
  elements.stage.addEventListener('drop', (event) => { event.preventDefault(); const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]; if (file) loadFile(file); });
  document.addEventListener('paste', (event) => { const items = event.clipboardData && event.clipboardData.items; if (!items) return; for (const item of items) if (/^image\//.test(item.type)) { const file = item.getAsFile(); if (file) { loadFile(file); break; } } });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => syncCropBox()).observe(elements.canvasWrap);
  root.addEventListener('resize', syncCropBox);
  updateSliderOutputs();
})(typeof globalThis !== 'undefined' ? globalThis : this);
