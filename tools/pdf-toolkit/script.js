(function (root) {
  'use strict';

  function parsePageRanges(spec, pageCount) {
    const text = String(spec || '').trim();
    if (!text) throw new Error('请输入页码范围');
    const indices = new Set();
    for (const part of text.split(/[,，、\s]+/).filter(Boolean)) {
      const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
      if (!match) throw new Error(`无法识别的范围：${part}`);
      let start = Number(match[1]); let end = match[2] ? Number(match[2]) : start;
      if (start < 1 || end < 1 || start > pageCount || end > pageCount) throw new Error(`页码超出范围（1-${pageCount}）：${part}`);
      if (start > end) { const swap = start; start = end; end = swap; }
      for (let page = start; page <= end; page += 1) indices.add(page - 1);
    }
    return [...indices].sort((a, b) => a - b);
  }
  function formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value < 0) return '';
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1024 / 1024).toFixed(2)} MB`;
  }
  const CRC_TABLE = (() => { const table = new Uint32Array(256); for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); table[n] = c >>> 0; } return table; })();
  function crc32(bytes) { let crc = -1; for (let index = 0; index < bytes.length; index += 1) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[index]) & 0xff]; return (crc ^ -1) >>> 0; }
  function utf8Bytes(value) {
    const bytes = []; const text = String(value);
    for (let index = 0; index < text.length; index += 1) { const code = text.codePointAt(index); if (code > 0xffff) index += 1; if (code < 0x80) bytes.push(code); else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f)); else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f)); else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f)); }
    return bytes;
  }
  function zipStore(files) {
    const localChunks = []; const central = []; let offset = 0;
    const u16 = (value) => [value & 0xff, (value >>> 8) & 0xff];
    const u32 = (value) => [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
    for (const file of files) {
      const nameBytes = utf8Bytes(file.name); const data = file.data; const crc = crc32(data); const size = data.length;
      const local = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0));
      localChunks.push(new Uint8Array(local), new Uint8Array(nameBytes), data);
      central.push({ nameBytes, crc, size, offset }); offset += local.length + nameBytes.length + size;
    }
    const centralChunks = []; let centralSize = 0;
    for (const entry of central) { const header = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(entry.crc), u32(entry.size), u32(entry.size), u16(entry.nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(entry.offset)); centralChunks.push(new Uint8Array(header), new Uint8Array(entry.nameBytes)); centralSize += header.length + entry.nameBytes.length; }
    const end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(centralSize), u32(offset), u16(0)));
    const all = [...localChunks, ...centralChunks, end]; let total = 0; for (const chunk of all) total += chunk.length;
    const output = new Uint8Array(total); let pointer = 0; for (const chunk of all) { output.set(chunk, pointer); pointer += chunk.length; }
    return output;
  }
  function hexToRgb(hex) { const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || '')); if (!match) return [0, 0, 0]; const value = parseInt(match[1], 16); return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255]; }
  const FONTS = { helvetica: { pdf: 'Helvetica', css: '"Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif' }, times: { pdf: 'TimesRoman', css: '"Times New Roman", Times, serif' }, courier: { pdf: 'Courier', css: '"Courier New", Courier, monospace' } };
  const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
  function matMul(m1, m2) { return [m1[0] * m2[0] + m1[2] * m2[1], m1[1] * m2[0] + m1[3] * m2[1], m1[0] * m2[2] + m1[2] * m2[3], m1[1] * m2[2] + m1[3] * m2[3], m1[0] * m2[4] + m1[2] * m2[5] + m1[4], m1[1] * m2[4] + m1[3] * m2[5] + m1[5]]; }
  function canvasToBytes(canvas, type, quality) { return new Promise((resolve) => canvas.toBlob((blob) => { if (!blob) { resolve(null); return; } blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer))); }, type, quality)); }
  async function renderTextImage(text, sizePt, colorCss, fontCss) {
    const k = 4;
    const fontPx = Math.max(4, sizePt * k);
    const measure = document.createElement('canvas').getContext('2d');
    measure.font = `${fontPx}px ${fontCss}`;
    const metrics = measure.measureText(text);
    const ascent = metrics.actualBoundingBoxAscent || fontPx * 0.8;
    const descent = metrics.actualBoundingBoxDescent || fontPx * 0.25;
    const pad = Math.max(1, Math.ceil(fontPx * 0.12));
    const width = Math.max(1, Math.ceil(metrics.width) + pad * 2);
    const height = Math.max(1, Math.ceil(ascent + descent) + pad * 2);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    context.font = `${fontPx}px ${fontCss}`;
    context.textBaseline = 'alphabetic';
    context.fillStyle = colorCss;
    context.fillText(text, pad, pad + ascent);
    const bytes = await canvasToBytes(canvas, 'image/png');
    return { bytes, width: width / k, height: height / k, bottomFromBaseline: (pad + descent) / k };
  }

  async function loadDocument(bytes) { return await root.PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true }); }
  async function mergePageList(entries, getBytes) {
    const { PDFDocument } = root.PDFLib; const output = await PDFDocument.create(); const cache = new Map();
    for (const entry of entries) { let doc = cache.get(entry.fileId); if (!doc) { doc = await loadDocument(getBytes(entry.fileId)); cache.set(entry.fileId, doc); } const [page] = await output.copyPages(doc, [entry.pageIndex]); output.addPage(page); }
    return await output.save();
  }
  async function extractPages(bytes, indices) {
    const { PDFDocument } = root.PDFLib; const source = await loadDocument(bytes); const output = await PDFDocument.create();
    const pages = await output.copyPages(source, indices); for (const page of pages) output.addPage(page);
    return await output.save();
  }
  async function splitToPages(bytes) {
    const { PDFDocument } = root.PDFLib; const source = await loadDocument(bytes); const count = source.getPageCount(); const results = [];
    for (let index = 0; index < count; index += 1) { const output = await PDFDocument.create(); const [page] = await output.copyPages(source, [index]); output.addPage(page); results.push(await output.save()); }
    return results;
  }

  const api = { parsePageRanges, formatBytes, crc32, utf8Bytes, zipStore, hexToRgb, matMul, mergePageList, extractPages, splitToPages };
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;

  const ids = ['fileInput', 'pickBtn', 'dropzone', 'workbar', 'fullscreenBtn', 'fileChips', 'pdfBody', 'rail', 'prevPage', 'nextPage', 'pageInfo', 'stageHint', 'stageCanvas', 'overlayLayer', 'stageEmpty', 'zoomOut', 'zoomIn', 'zoomFit', 'zoomInfo', 'side', 'sideMerge', 'sideExtract', 'sideEdit', 'mergeCount', 'mergeBtn', 'clearBtn', 'extractCount', 'extractBtn', 'selectAllBtn', 'clearSelBtn', 'splitAllBtn', 'editInfo', 'textToolBtn', 'imageToolBtn', 'textSize', 'textColor', 'fontSelect', 'imageInput', 'editTextToggle', 'imageList', 'replaceImageInput', 'rotateBtn', 'deleteBtn', 'exportBtn', 'resetEditBtn', 'status'];
  const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
  const state = { files: [], fileSeq: 0, mode: 'merge', activeId: null, page: 1, pageCount: 0, pageSize: { width: 595, height: 842 }, selection: new Set(), viewDoc: null, viewport: null, zoom: 1, pendingTool: null, editImage: null, mergePages: [], mergeSeq: 0, editDoc: null, editDocId: null, editPreviewBytes: null, editFont: null, overlays: [], overlaySeq: 0, textPages: new Map(), imagesByPage: new Map(), editTextMode: false, replaceTarget: null, summary: { rotated: 0, removed: 0 }, fileDocs: new Map() };

  const pdfjs = root.pdfjsLib;
  if (pdfjs && pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.js', location.href).href;

  function setStatus(message, kind = '') { elements.status.textContent = message; elements.status.dataset.kind = kind; }
  function selectedFont() { return FONTS[(elements.fontSelect && elements.fontSelect.value) || 'helvetica'] || FONTS.helvetica; }
  function downloadBytes(filename, bytes, mime) { const blob = new Blob([bytes], { type: mime }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }
  function readFileBytes(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(new Uint8Array(reader.result)); reader.onerror = () => reject(new Error('读取文件失败')); reader.readAsArrayBuffer(file); }); }
  function activeFile() { return state.files.find((file) => file.id === state.activeId) || null; }
  function fileById(id) { return state.files.find((file) => file.id === id) || null; }

  async function loadPdfDoc(bytes) { if (!pdfjs) throw new Error('预览组件未加载'); return await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise; }
  async function getFileDoc(file) { if (state.fileDocs.has(file.id)) return state.fileDocs.get(file.id); const doc = await loadPdfDoc(file.bytes); state.fileDocs.set(file.id, doc); return doc; }
  async function renderPageToCanvas(doc, pageNumber, canvas, maxWidth) {
    const page = await doc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.max(0.05, Math.min(maxWidth / base.width, 2.5));
    const viewport = page.getViewport({ scale });
    canvas.width = Math.max(1, Math.floor(viewport.width)); canvas.height = Math.max(1, Math.floor(viewport.height));
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return { viewport, width: base.width, height: base.height };
  }
  async function extractTextItems(page) {
    const content = await page.getTextContent();
    return content.items.filter((item) => item.str && item.str.trim()).map((item) => { const transform = item.transform; const size = item.height || Math.hypot(transform[1], transform[3]) || 10; return { str: item.str, x: transform[4], y: transform[5], width: item.width || 0, height: size, size, newStr: undefined }; });
  }
  function imageSourceToCanvas(source) {
    const canvas = document.createElement('canvas');
    if (!source) return canvas;
    const width = source.width || (source.bitmap && source.bitmap.width) || 0;
    const height = source.height || (source.bitmap && source.bitmap.height) || 0;
    canvas.width = Math.max(1, width); canvas.height = Math.max(1, height);
    const context = canvas.getContext('2d');
    try {
      if (source.data) context.putImageData(new ImageData(new Uint8ClampedArray(source.data), width, height), 0, 0);
      else if (source.bitmap) context.drawImage(source.bitmap, 0, 0);
      else context.drawImage(source, 0, 0);
    } catch { /* 无法绘制时返回空白画布 */ }
    return canvas;
  }
  async function extractImages(page) {
    const operatorList = await page.getOperatorList();
    const images = []; let ctm = [1, 0, 0, 1, 0, 0]; const stack = [];
    const OPS = pdfjs.OPS;
    for (let index = 0; index < operatorList.fnArray.length; index += 1) {
      const fn = operatorList.fnArray[index]; const args = operatorList.argsArray[index];
      if (fn === OPS.save) stack.push(ctm.slice());
      else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
      else if (fn === OPS.transform) ctm = matMul(ctm, args);
      else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject || fn === OPS.paintImageMaskXObject) {
        const name = args[0]; let source = null;
        try { source = page.objs.get(name); } catch { source = null; }
        if (!source) { try { source = page.commonObjs.get(name); } catch { source = null; } }
        const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]]);
        const xs = corners.map((point) => point[0]); const ys = corners.map((point) => point[1]);
        const rect = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
        if (rect.width < 1 || rect.height < 1) continue;
        const canvas = imageSourceToCanvas(source);
        images.push({ id: `img${index}`, rect, canvas, url: canvas.toDataURL('image/png'), deleted: false, replacement: null });
      }
    }
    return images;
  }
  async function ensurePageExtracts() {
    if (state.mode !== 'edit' || !state.viewDoc) return;
    const pageNumber = state.page;
    if (!state.imagesByPage.has(pageNumber)) { try { const page = await state.viewDoc.getPage(pageNumber); state.imagesByPage.set(pageNumber, await extractImages(page)); } catch { state.imagesByPage.set(pageNumber, []); } }
    if (state.editTextMode && !state.textPages.has(pageNumber)) { try { const page = await state.viewDoc.getPage(pageNumber); state.textPages.set(pageNumber, await extractTextItems(page)); } catch { state.textPages.set(pageNumber, []); } }
  }

  function renderChips() {
    elements.fileChips.replaceChildren(...state.files.map((file) => { const chip = document.createElement('button'); chip.type = 'button'; chip.className = `pdf-chip${file.id === state.activeId ? ' is-active' : ''}`; const span = document.createElement('span'); span.textContent = file.name; chip.append(span); chip.addEventListener('click', () => switchActive(file.id)); return chip; }));
  }
  function renderSide() {
    elements.sideMerge.hidden = state.mode !== 'merge';
    elements.sideExtract.hidden = state.mode !== 'extract';
    elements.sideEdit.hidden = state.mode !== 'edit';
    if (state.mode === 'merge') elements.mergeCount.textContent = `共 ${state.mergePages.length} 页（${state.files.length} 个文件）`;
    if (state.mode === 'extract') elements.extractCount.textContent = `已选 ${state.selection.size} / ${state.pageCount} 页`;
    if (state.mode === 'edit') { updateEditInfo(); renderImageList(); }
  }
  function updateEditInfo() {
    if (!state.editDoc) { elements.editInfo.textContent = '尚未载入'; return; }
    const parts = [`共 ${state.editDoc.getPageCount()} 页`];
    if (state.summary.rotated) parts.push(`旋转 ${state.summary.rotated} 页`);
    if (state.summary.removed) parts.push(`删除 ${state.summary.removed} 页`);
    if (state.overlays.length) parts.push(`新增 ${state.overlays.length} 处`);
    const edited = [...state.textPages.values()].reduce((sum, items) => sum + items.filter((item) => item.newStr !== undefined && item.newStr !== item.str).length, 0);
    if (edited) parts.push(`改字 ${edited} 处`);
    elements.editInfo.textContent = parts.join('　·　');
  }
  function renderImageList() {
    const images = state.imagesByPage.get(state.page) || [];
    if (!images.length) { const note = document.createElement('p'); note.className = 'pdf-image-empty'; note.textContent = '本页未检测到可提取的图片'; elements.imageList.replaceChildren(note); return; }
    elements.imageList.replaceChildren(...images.map((image) => {
      const item = document.createElement('div'); item.className = 'pdf-image-item';
      const img = document.createElement('img'); img.src = image.url; img.alt = ''; item.append(img);
      const body = document.createElement('div');
      const meta = document.createElement('div'); meta.className = 'pdf-image-item__meta'; meta.textContent = `${image.canvas.width}×${image.canvas.height}${image.deleted ? ' · 已标记删除' : image.replacement ? ' · 已替换' : ''}`; body.append(meta);
      const actions = document.createElement('div'); actions.className = 'pdf-image-item__actions';
      const download = document.createElement('button'); download.type = 'button'; download.textContent = '下载'; download.addEventListener('click', () => { const link = document.createElement('a'); link.href = image.url; link.download = `image-${image.id}.png`; link.click(); });
      const replace = document.createElement('button'); replace.type = 'button'; replace.textContent = '替换'; replace.addEventListener('click', () => { state.replaceTarget = image; elements.replaceImageInput.click(); });
      const toggle = document.createElement('button'); toggle.type = 'button'; toggle.textContent = image.deleted ? '取消删除' : '删除'; toggle.addEventListener('click', () => { image.deleted = !image.deleted; if (image.deleted) image.replacement = null; renderImageList(); });
      actions.append(download, replace, toggle); body.append(actions); item.append(body);
      return item;
    }));
  }
  async function renderStage() {
    if (!state.viewDoc || !state.pageCount) { elements.stageCanvas.hidden = true; elements.stageEmpty.hidden = false; elements.pageInfo.textContent = '—'; elements.overlayLayer.replaceChildren(); return; }
    state.page = Math.min(Math.max(1, state.page), state.pageCount);
    elements.pageInfo.textContent = `${state.page} / ${state.pageCount}`;
    elements.zoomInfo.textContent = `${Math.round(state.zoom * 100)}%`;
    try {
      const page = await state.viewDoc.getPage(state.page);
      const base = page.getViewport({ scale: 1 });
      const wrap = elements.stageCanvas.closest('.pdf-canvas-wrap');
      const availableWidth = Math.max(240, (wrap ? wrap.clientWidth : 900) - 24);
      const availableHeight = Math.max(240, window.innerHeight * (document.fullscreenElement ? 0.86 : 0.74));
      const fitScale = Math.min(availableWidth / base.width, availableHeight / base.height, 3);
      const viewport = page.getViewport({ scale: fitScale * state.zoom });
      const canvas = elements.stageCanvas;
      canvas.width = Math.max(1, Math.floor(viewport.width)); canvas.height = Math.max(1, Math.floor(viewport.height));
      canvas.style.width = `${canvas.width}px`; canvas.style.height = `${canvas.height}px`;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      state.viewport = viewport; state.pageSize = { width: base.width, height: base.height };
      canvas.hidden = false; elements.stageEmpty.hidden = true;
      await ensurePageExtracts(); renderOverlays(); renderImageList();
    } catch (error) { elements.stageCanvas.hidden = true; elements.stageEmpty.hidden = false; elements.stageEmpty.textContent = `预览失败：${error.message}`; }
  }
  async function renderRail() {
    const file = activeFile();
    elements.rail.replaceChildren();
    if (state.mode === 'merge') {
      if (!state.mergePages.length) { elements.rail.append(Object.assign(document.createElement('p'), { className: 'pdf-rail__empty', textContent: '请先添加 PDF' })); return; }
      for (let index = 0; index < state.mergePages.length; index += 1) {
        const entry = state.mergePages[index]; const source = fileById(entry.fileId); if (!source) continue;
        const card = document.createElement('div'); card.className = 'pdf-thumb-card'; card.draggable = true; card.dataset.index = String(index);
        if (entry.fileId === state.activeId && entry.pageIndex + 1 === state.page) card.classList.add('is-active');
        const canvas = document.createElement('canvas'); card.append(canvas);
        const label = document.createElement('span'); label.className = 'pdf-thumb-card__label'; label.textContent = `第 ${index + 1} 页`; card.append(label);
        const sourceLabel = document.createElement('span'); sourceLabel.className = 'pdf-thumb-card__source'; sourceLabel.textContent = source.name; sourceLabel.title = source.name; card.append(sourceLabel);
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'pdf-thumb-card__remove'; remove.textContent = '×'; remove.title = '删除该页'; remove.setAttribute('aria-label', '删除该页'); remove.addEventListener('click', (event) => { event.stopPropagation(); state.mergePages.splice(index, 1); renderRail(); renderSide(); });
        card.append(remove);
        card.addEventListener('click', () => { state.activeId = entry.fileId; state.page = entry.pageIndex + 1; renderChips(); renderStage(); renderRail(); });
        card.addEventListener('dragstart', (event) => { event.dataTransfer.setData('text/plain', String(index)); card.classList.add('is-dragging'); });
        card.addEventListener('dragend', () => card.classList.remove('is-dragging'));
        card.addEventListener('dragover', (event) => event.preventDefault());
        card.addEventListener('drop', (event) => { event.preventDefault(); const from = Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from) && from !== index) { const [moved] = state.mergePages.splice(from, 1); state.mergePages.splice(index, 0, moved); renderRail(); } });
        elements.rail.append(card);
        getFileDoc(source).then((doc) => renderPageToCanvas(doc, entry.pageIndex + 1, canvas, 90)).catch(() => {});
      }
      return;
    }
    if (!file) { elements.rail.append(Object.assign(document.createElement('p'), { className: 'pdf-rail__empty', textContent: '请先添加 PDF' })); return; }
    for (let index = 1; index <= state.pageCount; index += 1) {
      const card = document.createElement('div'); card.className = 'pdf-thumb-card'; card.dataset.page = String(index);
      if (state.mode === 'edit' && index === state.page) card.classList.add('is-active');
      if (state.mode === 'extract' && state.selection.has(index - 1)) card.classList.add('is-selected');
      const canvas = document.createElement('canvas'); card.append(canvas);
      const label = document.createElement('span'); label.className = 'pdf-thumb-card__label'; label.textContent = `第 ${index} 页`; card.append(label);
      card.addEventListener('click', () => { if (state.mode === 'extract') { if (state.selection.has(index - 1)) state.selection.delete(index - 1); else state.selection.add(index - 1); card.classList.toggle('is-selected'); renderSide(); } else { state.page = index; renderStage(); renderRail(); } });
      elements.rail.append(card);
      try { await renderPageToCanvas(state.viewDoc, index, canvas, 90); } catch { /* 忽略单页缩略图失败 */ }
    }
  }
  async function refreshView() {
    const file = activeFile();
    if (!file) { state.viewDoc = null; state.pageCount = 0; state.page = 1; return; }
    if (state.mode === 'edit') { state.viewDoc = await loadPdfDoc(state.editPreviewBytes); }
    else { state.viewDoc = await getFileDoc(file); }
    state.pageCount = state.viewDoc.numPages;
    state.page = Math.min(Math.max(1, state.page), state.pageCount);
  }
  async function renderAll() {
    const hasFiles = state.files.length > 0;
    elements.workbar.hidden = !hasFiles;
    elements.pdfBody.hidden = !hasFiles;
    renderChips(); renderSide();
    if (!hasFiles) { elements.rail.replaceChildren(); elements.stageCanvas.hidden = true; elements.stageEmpty.hidden = false; elements.overlayLayer.replaceChildren(); return; }
    await refreshView();
    await renderStage();
    await renderRail();
  }
  async function ensureEditDoc() {
    const file = activeFile(); if (!file) return;
    if (state.editDoc && state.editDocId === file.id) return;
    state.editDoc = await loadDocument(file.bytes); state.editPreviewBytes = file.bytes; state.editDocId = file.id;
    state.editFont = null; state.overlays = []; state.textPages = new Map(); state.imagesByPage = new Map(); state.summary = { rotated: 0, removed: 0 };
  }
  async function applyMode() {
    state.pendingTool = null; updateToolButtons();
    if (state.mode === 'edit') await ensureEditDoc();
    if (state.mode === 'extract') state.selection = new Set();
    await renderAll();
  }
  async function switchActive(id) {
    if (state.activeId === id) return;
    state.activeId = id; state.page = 1; state.selection = new Set();
    if (state.mode === 'edit') { state.editDoc = null; state.editDocId = null; await ensureEditDoc(); }
    await renderAll();
  }
  function removeFile(id) {
    state.files = state.files.filter((file) => file.id !== id); state.fileDocs.delete(id); state.mergePages = state.mergePages.filter((entry) => entry.fileId !== id);
    if (state.activeId === id) { state.activeId = state.files[0] ? state.files[0].id : null; state.page = 1; state.selection = new Set(); state.editDoc = null; state.editDocId = null; }
    renderAll();
  }
  async function addFiles(fileList) {
    const files = [...fileList].filter((file) => /\.pdf$/i.test(file.name) || file.type === 'application/pdf');
    if (!files.length) { setStatus('请选择 PDF 文件。', 'error'); return; }
    try {
      for (const file of files) {
        const bytes = await readFileBytes(file); state.fileSeq += 1; const id = `f${state.fileSeq}`; state.files.push({ id, name: file.name, bytes });
        const doc = await getFileDoc({ id, bytes });
        for (let pageIndex = 0; pageIndex < doc.numPages; pageIndex += 1) { state.mergeSeq += 1; state.mergePages.push({ id: `m${state.mergeSeq}`, fileId: id, pageIndex }); }
      }
      if (!state.activeId) state.activeId = state.files[0].id;
      setStatus(`已添加 ${files.length} 个文件，共 ${state.files.length} 个、${state.mergePages.length} 页。`, 'success');
      await renderAll();
    } catch (error) { setStatus(error.message, 'error'); }
  }
  function updateToolButtons() {
    elements.textToolBtn.classList.toggle('button--cta', state.pendingTool === 'text'); elements.textToolBtn.classList.toggle('button--secondary', state.pendingTool !== 'text');
    elements.imageToolBtn.classList.toggle('button--cta', state.pendingTool === 'image'); elements.imageToolBtn.classList.toggle('button--secondary', state.pendingTool !== 'image');
    elements.stageCanvas.classList.toggle('is-placing', Boolean(state.pendingTool));
    elements.stageHint.textContent = state.pendingTool ? (state.pendingTool === 'text' ? '点击页面放置文字' : '点击页面放置图片') : '';
  }
  function setPending(tool) { state.pendingTool = state.pendingTool === tool ? null : tool; updateToolButtons(); }

  function overlayScale() { const rect = elements.stageCanvas.getBoundingClientRect(); return { x: rect.width / elements.stageCanvas.width || 1, y: rect.height / elements.stageCanvas.height || 1 }; }
  function positionOverlay(overlay, node, scale) {
    const unit = state.viewport ? state.viewport.scale : 1;
    const point = state.viewport.convertToViewportPoint(overlay.x, overlay.y);
    node.style.left = `${point[0] * scale.x}px`;
    if (overlay.type === 'text') { const fontPx = overlay.size * unit * scale.y; node.style.fontSize = `${fontPx}px`; node.style.top = `${point[1] * scale.y - fontPx}px`; }
    else { node.style.top = `${(point[1] - overlay.height * unit) * scale.y}px`; const img = node.querySelector('img'); if (img) { img.style.width = `${overlay.width * unit * scale.x}px`; img.style.height = `${overlay.height * unit * scale.y}px`; } }
  }
  function createOverlayNode(overlay, scale) {
    const node = document.createElement('div'); node.className = `pdf-overlay pdf-overlay--${overlay.type}`; node.dataset.id = overlay.id;
    if (overlay.type === 'text') { const span = document.createElement('span'); span.className = 'pdf-overlay__text'; span.textContent = overlay.text; node.append(span); node.style.color = overlay.color; node.style.fontFamily = selectedFont().css; node.style.fontSize = `${overlay.size * scale.y}px`; node.addEventListener('dblclick', (event) => { event.stopPropagation(); startEditText(overlay, node); }); }
    else { const img = document.createElement('img'); img.src = overlay.url; img.alt = ''; img.draggable = false; node.append(img); const handle = document.createElement('span'); handle.className = 'pdf-overlay__resize'; handle.title = '拖动缩放'; handle.addEventListener('pointerdown', (event) => startResize(overlay, event)); node.append(handle); }
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'pdf-overlay__remove'; remove.textContent = '×'; remove.setAttribute('aria-label', '删除'); remove.addEventListener('pointerdown', (event) => event.stopPropagation()); remove.addEventListener('click', (event) => { event.stopPropagation(); state.overlays = state.overlays.filter((item) => item !== overlay); renderOverlays(); updateEditInfo(); });
    node.append(remove);
    node.addEventListener('pointerdown', (event) => startDrag(overlay, node, event));
    positionOverlay(overlay, node, scale);
    return node;
  }
  function createExistingTextNode(item, scale) {
    const node = document.createElement('div'); node.className = `pdf-overlay pdf-overlay--existing${item.newStr !== undefined && item.newStr !== item.str ? ' is-edited' : ''}`;
    node.textContent = item.newStr !== undefined ? item.newStr : item.str;
    const unit = state.viewport ? state.viewport.scale : 1;
    const point = state.viewport.convertToViewportPoint(item.x, item.y);
    node.style.fontFamily = selectedFont().css;
    node.style.fontSize = `${item.size * unit * scale.y}px`;
    node.style.left = `${point[0] * scale.x}px`;
    node.style.top = `${point[1] * scale.y - item.size * unit * scale.y * 0.95}px`;
    node.style.minWidth = `${Math.max(12, item.width * unit * scale.x)}px`;
    node.style.minHeight = `${Math.max(12, item.size * unit * scale.y * 1.2)}px`;
    node.addEventListener('dblclick', (event) => { event.stopPropagation(); startEditExistingText(item, node); });
    return node;
  }
  function createCoverNode(item, scale) {
    const coverWidth = Math.max(item.width, (item.newStr ? item.newStr.length * item.size * 0.55 : 0)) + item.size * 0.2;
    const x0 = item.x - item.size * 0.1;
    const y0 = item.y - item.height * 0.35;
    const x1 = x0 + coverWidth;
    const y1 = item.y + item.height * 1.15;
    const topLeft = state.viewport.convertToViewportPoint(x0, y1);
    const bottomRight = state.viewport.convertToViewportPoint(x1, y0);
    const node = document.createElement('div'); node.className = 'pdf-cover';
    node.style.left = `${Math.min(topLeft[0], bottomRight[0]) * scale.x}px`;
    node.style.top = `${Math.min(topLeft[1], bottomRight[1]) * scale.y}px`;
    node.style.width = `${Math.abs(bottomRight[0] - topLeft[0]) * scale.x}px`;
    node.style.height = `${Math.abs(bottomRight[1] - topLeft[1]) * scale.y}px`;
    return node;
  }
  function renderOverlays() {
    elements.overlayLayer.replaceChildren();
    if (state.mode !== 'edit' || !state.viewport) return;
    const scale = overlayScale();
    if (state.editTextMode) for (const item of state.textPages.get(state.page) || []) {
      if (item.newStr !== undefined && item.newStr !== item.str) elements.overlayLayer.append(createCoverNode(item, scale));
      elements.overlayLayer.append(createExistingTextNode(item, scale));
    }
    for (const overlay of state.overlays) if (overlay.page === state.page) elements.overlayLayer.append(createOverlayNode(overlay, scale));
  }
  function startDrag(overlay, node, event) {
    if (event.button !== 0 || node.querySelector('[contenteditable="true"]')) return;
    event.preventDefault();
    const rect = elements.stageCanvas.getBoundingClientRect(); const scale = overlayScale();
    const start = state.viewport.convertToPdfPoint((event.clientX - rect.left) / scale.x, (event.clientY - rect.top) / scale.y);
    const offset = { x: overlay.x - start[0], y: overlay.y - start[1] };
    const move = (moveEvent) => { const point = state.viewport.convertToPdfPoint((moveEvent.clientX - rect.left) / scale.x, (moveEvent.clientY - rect.top) / scale.y); overlay.x = point[0] + offset.x; overlay.y = point[1] + offset.y; positionOverlay(overlay, node, scale); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  function startResize(overlay, event) {
    event.preventDefault(); event.stopPropagation();
    const rect = elements.stageCanvas.getBoundingClientRect(); const scale = overlayScale();
    const aspect = overlay.height / overlay.width;
    const move = (moveEvent) => { const point = state.viewport.convertToPdfPoint((moveEvent.clientX - rect.left) / scale.x, (moveEvent.clientY - rect.top) / scale.y); const width = Math.max(10, point[0] - overlay.x); overlay.width = width; overlay.height = width * aspect; const node = elements.overlayLayer.querySelector(`[data-id="${overlay.id}"]`); if (node) positionOverlay(overlay, node, scale); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  function startEditText(overlay, node) {
    const span = node.querySelector('.pdf-overlay__text') || node;
    span.setAttribute('contenteditable', 'true'); span.focus();
    const range = document.createRange(); range.selectNodeContents(span); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    const commit = () => { span.removeAttribute('contenteditable'); overlay.text = span.textContent.trim(); span.removeEventListener('blur', commit); span.removeEventListener('keydown', onKey); if (!overlay.text) { state.overlays = state.overlays.filter((item) => item !== overlay); renderOverlays(); } updateEditInfo(); };
    const onKey = (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); span.blur(); } };
    span.addEventListener('blur', commit); span.addEventListener('keydown', onKey);
  }
  function startEditExistingText(item, node) {
    node.setAttribute('contenteditable', 'true'); node.focus();
    const range = document.createRange(); range.selectNodeContents(node); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    const commit = () => { node.removeAttribute('contenteditable'); const value = node.textContent.trim(); item.newStr = value === item.str ? undefined : value; node.removeEventListener('blur', commit); node.removeEventListener('keydown', onKey); renderOverlays(); updateEditInfo(); };
    const onKey = (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); node.blur(); } };
    node.addEventListener('blur', commit); node.addEventListener('keydown', onKey);
  }

  elements.pickBtn.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', (event) => { const files = [...event.target.files]; event.target.value = ''; if (files.length) addFiles(files); });
  elements.dropzone.addEventListener('dragover', (event) => { event.preventDefault(); elements.dropzone.classList.add('is-over'); });
  elements.dropzone.addEventListener('dragleave', () => elements.dropzone.classList.remove('is-over'));
  elements.dropzone.addEventListener('drop', (event) => { event.preventDefault(); elements.dropzone.classList.remove('is-over'); if (event.dataTransfer && event.dataTransfer.files.length) addFiles(event.dataTransfer.files); });
  for (const button of elements.workbar.querySelectorAll('.pdf-mode')) button.addEventListener('click', () => { state.mode = button.dataset.mode; for (const other of elements.workbar.querySelectorAll('.pdf-mode')) { const active = other === button; other.classList.toggle('is-active', active); other.setAttribute('aria-selected', String(active)); } applyMode(); });
  elements.fullscreenBtn.addEventListener('click', () => { const body = elements.pdfBody; try { if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen().catch(() => {}); } else if (body.requestFullscreen) body.requestFullscreen().catch(() => root.OETToolPage.showToast('无法进入全屏，可使用浏览器缩放。')); else root.OETToolPage.showToast('当前浏览器不支持全屏，可使用浏览器缩放。'); } catch { root.OETToolPage.showToast('当前浏览器不支持全屏，可使用浏览器缩放。'); } });
  document.addEventListener('fullscreenchange', () => { elements.fullscreenBtn.textContent = document.fullscreenElement ? '退出全屏' : '全屏'; if (state.viewDoc) renderStage(); });
  elements.fontSelect.addEventListener('change', renderOverlays);
  function nextZoom(direction) { const index = ZOOM_STEPS.findIndex((value) => value >= state.zoom - 0.001); const current = index < 0 ? ZOOM_STEPS.length - 1 : index; return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, current + direction))]; }
  function setZoom(value) { state.zoom = Math.min(3, Math.max(0.5, value)); renderStage(); }
  elements.zoomIn.addEventListener('click', () => setZoom(nextZoom(1)));
  elements.zoomOut.addEventListener('click', () => setZoom(nextZoom(-1)));
  elements.zoomFit.addEventListener('click', () => setZoom(1));
  window.addEventListener('resize', () => { if (state.viewDoc) renderStage(); });
  elements.prevPage.addEventListener('click', () => { state.page -= 1; renderStage(); renderRail(); });
  elements.nextPage.addEventListener('click', () => { state.page += 1; renderStage(); renderRail(); });
  elements.stageCanvas.addEventListener('click', (event) => {
    if (state.mode !== 'edit' || !state.pendingTool || !state.viewport || !state.editDoc) return;
    const rect = elements.stageCanvas.getBoundingClientRect(); const scale = overlayScale();
    const point = state.viewport.convertToPdfPoint((event.clientX - rect.left) / scale.x, (event.clientY - rect.top) / scale.y);
    state.overlaySeq += 1; const id = `o${state.overlaySeq}`;
    if (state.pendingTool === 'text') {
      const overlay = { id, type: 'text', page: state.page, x: point[0], y: point[1], text: '', size: Number(elements.textSize.value) || 18, color: elements.textColor.value };
      state.overlays.push(overlay); renderOverlays(); const node = elements.overlayLayer.querySelector(`[data-id="${id}"]`); if (node) startEditText(overlay, node); setPending(null); updateEditInfo();
    } else if (state.pendingTool === 'image') {
      if (!state.editImage) { setStatus('请先选择图片。', 'error'); return; }
      const width = Math.min(state.editImage.width, state.pageSize.width * 0.5); const height = width * state.editImage.height / state.editImage.width;
      const overlay = { id, type: 'image', page: state.page, x: point[0], y: point[1], width, height, bytes: state.editImage.bytes, imageType: state.editImage.type, url: state.editImage.url };
      state.overlays.push(overlay); renderOverlays(); setPending(null); updateEditInfo(); setStatus('已放置图片，可拖动调整位置。', 'success');
    }
  });
  elements.mergeBtn.addEventListener('click', async () => {
    if (!state.mergePages.length) return;
    elements.mergeBtn.disabled = true; setStatus('正在合并…', 'info');
    try { const bytes = await mergePageList(state.mergePages, (id) => fileById(id).bytes); downloadBytes('merged.pdf', bytes, 'application/pdf'); root.OpenEduAnalytics?.toolUse?.('pdf-toolkit'); setStatus(`已合并 ${state.mergePages.length} 页（${formatBytes(bytes.length)}）。`, 'success'); }
    catch (error) { setStatus(`合并失败：${error.message}`, 'error'); }
    finally { elements.mergeBtn.disabled = false; }
  });
  elements.clearBtn.addEventListener('click', () => { state.files = []; state.fileDocs.clear(); state.mergePages = []; state.activeId = null; state.editDoc = null; state.editDocId = null; state.selection = new Set(); state.overlays = []; state.textPages = new Map(); state.imagesByPage = new Map(); renderAll(); setStatus('已清空。', 'info'); });
  elements.extractBtn.addEventListener('click', async () => {
    const file = activeFile(); if (!file) return;
    if (!state.selection.size) { setStatus('请先点击缩略图选择页面。', 'error'); return; }
    try { const indices = [...state.selection].sort((a, b) => a - b); const bytes = await extractPages(file.bytes, indices); downloadBytes('extracted.pdf', bytes, 'application/pdf'); root.OpenEduAnalytics?.toolUse?.('pdf-toolkit'); setStatus(`已提取 ${indices.length} 页（${formatBytes(bytes.length)}）。`, 'success'); }
    catch (error) { setStatus(`提取失败：${error.message}`, 'error'); }
  });
  elements.selectAllBtn.addEventListener('click', () => { for (let index = 0; index < state.pageCount; index += 1) state.selection.add(index); renderRail(); renderSide(); });
  elements.clearSelBtn.addEventListener('click', () => { state.selection = new Set(); renderRail(); renderSide(); });
  elements.splitAllBtn.addEventListener('click', async () => {
    const file = activeFile(); if (!file) return;
    elements.splitAllBtn.disabled = true; setStatus('正在拆分…', 'info');
    try { const pages = await splitToPages(file.bytes); const files = pages.map((bytes, index) => ({ name: `page-${String(index + 1).padStart(3, '0')}.pdf`, data: bytes })); downloadBytes('pdf-pages.zip', zipStore(files), 'application/zip'); root.OpenEduAnalytics?.toolUse?.('pdf-toolkit'); setStatus(`已拆分为 ${pages.length} 个文件并打包下载。`, 'success'); }
    catch (error) { setStatus(`拆分失败：${error.message}`, 'error'); }
    finally { elements.splitAllBtn.disabled = false; }
  });
  elements.textToolBtn.addEventListener('click', () => setPending('text'));
  elements.imageToolBtn.addEventListener('click', () => setPending('image'));
  elements.editTextToggle.addEventListener('change', async () => {
    state.editTextMode = elements.editTextToggle.checked;
    if (state.editTextMode) await ensurePageExtracts();
    renderOverlays();
    setStatus(state.editTextMode ? '已显示本页文字，双击可修改。' : '已隐藏文字。', 'info');
  });
  elements.imageInput.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0]; event.target.value = '';
    if (!file) return;
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') { setStatus('仅支持 PNG 或 JPG 图片。', 'error'); return; }
    readFileBytes(file).then((bytes) => { const url = URL.createObjectURL(file); const image = new Image(); image.onload = () => { state.editImage = { type: file.type, bytes, url, width: image.naturalWidth, height: image.naturalHeight }; setStatus(`已选择图片：${file.name}。点击页面放置。`, 'success'); }; image.src = url; }).catch((error) => setStatus(error.message, 'error'));
  });
  elements.replaceImageInput.addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0]; event.target.value = '';
    if (!file || !state.replaceTarget) return;
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') { setStatus('仅支持 PNG 或 JPG 图片。', 'error'); return; }
    try { const bytes = await readFileBytes(file); state.replaceTarget.replacement = { bytes, type: file.type }; state.replaceTarget.deleted = false; renderImageList(); setStatus('已设置替换图片，导出时生效。', 'success'); }
    catch (error) { setStatus(error.message, 'error'); }
    finally { state.replaceTarget = null; }
  });
  elements.rotateBtn.addEventListener('click', async () => {
    if (!state.editDoc) return;
    const page = state.editDoc.getPages()[state.page - 1]; if (!page) return;
    page.setRotation(root.PDFLib.degrees(((page.getRotation().angle || 0) + 90) % 360));
    state.summary.rotated += 1; state.editPreviewBytes = await state.editDoc.save(); state.viewDoc = await loadPdfDoc(state.editPreviewBytes); await renderStage(); updateEditInfo(); setStatus('已旋转当前页。', 'success');
  });
  elements.deleteBtn.addEventListener('click', async () => {
    if (!state.editDoc) return;
    if (state.editDoc.getPageCount() <= 1) { setStatus('不能删除全部页面。', 'error'); return; }
    const removedPage = state.page;
    state.editDoc.removePage(removedPage - 1); state.summary.removed += 1;
    state.overlays = state.overlays.filter((overlay) => overlay.page !== removedPage).map((overlay) => overlay.page > removedPage ? Object.assign({}, overlay, { page: overlay.page - 1 }) : overlay);
    state.textPages = new Map([...state.textPages].filter(([page]) => page !== removedPage).map(([page, items]) => [page > removedPage ? page - 1 : page, items]));
    state.imagesByPage = new Map([...state.imagesByPage].filter(([page]) => page !== removedPage).map(([page, items]) => [page > removedPage ? page - 1 : page, items]));
    state.editPreviewBytes = await state.editDoc.save(); state.viewDoc = await loadPdfDoc(state.editPreviewBytes);
    state.page = Math.min(removedPage, state.editDoc.getPageCount());
    await renderStage(); await renderRail(); updateEditInfo(); setStatus('已删除当前页。', 'success');
  });
  elements.exportBtn.addEventListener('click', async () => {
    if (!state.editDoc) return;
    elements.exportBtn.disabled = true; setStatus('正在导出…', 'info');
    try {
      const { PDFDocument } = root.PDFLib;
      const exportDoc = await PDFDocument.load(await state.editDoc.save(), { ignoreEncryption: true });
      const pages = exportDoc.getPages();
      for (const [pageNumber, items] of state.textPages) {
        const page = pages[pageNumber - 1]; if (!page) continue;
        for (const item of items) {
          if (item.newStr === undefined || item.newStr === item.str) continue;
          page.drawRectangle({ x: item.x - item.size * 0.1, y: item.y - item.height * 0.35, width: Math.max(item.width, item.newStr.length * item.size * 0.6) + item.size * 0.2, height: item.height * 1.5, color: root.PDFLib.rgb(1, 1, 1) });
          if (item.newStr.trim()) { const textImage = await renderTextImage(item.newStr, item.size, '#000000', selectedFont().css); const embedded = await exportDoc.embedPng(textImage.bytes); page.drawImage(embedded, { x: item.x, y: item.y - textImage.bottomFromBaseline, width: textImage.width, height: textImage.height }); }
        }
      }
      for (const [pageNumber, images] of state.imagesByPage) {
        const page = pages[pageNumber - 1]; if (!page) continue;
        for (const image of images) {
          if (image.deleted) page.drawRectangle({ x: image.rect.x, y: image.rect.y, width: image.rect.width, height: image.rect.height, color: root.PDFLib.rgb(1, 1, 1) });
          else if (image.replacement) { page.drawRectangle({ x: image.rect.x, y: image.rect.y, width: image.rect.width, height: image.rect.height, color: root.PDFLib.rgb(1, 1, 1) }); const embedded = image.replacement.type === 'image/png' ? await exportDoc.embedPng(image.replacement.bytes) : await exportDoc.embedJpg(image.replacement.bytes); page.drawImage(embedded, { x: image.rect.x, y: image.rect.y, width: image.rect.width, height: image.rect.height }); }
        }
      }
      for (const overlay of state.overlays) {
        const page = pages[overlay.page - 1]; if (!page) continue;
        if (overlay.type === 'text') { if (!overlay.text) continue; const textImage = await renderTextImage(overlay.text, overlay.size, overlay.color, selectedFont().css); const embedded = await exportDoc.embedPng(textImage.bytes); page.drawImage(embedded, { x: overlay.x, y: overlay.y - textImage.bottomFromBaseline, width: textImage.width, height: textImage.height }); }
        else { const image = overlay.imageType === 'image/png' ? await exportDoc.embedPng(overlay.bytes) : await exportDoc.embedJpg(overlay.bytes); page.drawImage(image, { x: overlay.x, y: overlay.y, width: overlay.width, height: overlay.height }); }
      }
      const bytes = await exportDoc.save(); downloadBytes('edited.pdf', bytes, 'application/pdf'); root.OpenEduAnalytics?.toolUse?.('pdf-toolkit'); setStatus(`已导出（${formatBytes(bytes.length)}）。`, 'success');
    } catch (error) { setStatus(`导出失败：${error.message}`, 'error'); }
    finally { elements.exportBtn.disabled = false; }
  });
  elements.resetEditBtn.addEventListener('click', async () => {
    const file = activeFile(); if (!file) return;
    state.editDoc = await loadDocument(file.bytes); state.editPreviewBytes = file.bytes; state.editFont = null; state.overlays = []; state.textPages = new Map(); state.imagesByPage = new Map(); state.summary = { rotated: 0, removed: 0 };
    await renderAll(); setStatus('已撤销全部修改。', 'info');
  });

  renderAll();
})(typeof globalThis !== 'undefined' ? globalThis : this);
