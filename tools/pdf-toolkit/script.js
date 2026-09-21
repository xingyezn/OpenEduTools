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

  async function loadDocument(bytes) { return await root.PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true }); }
  async function mergePdfs(sources) {
    const { PDFDocument } = root.PDFLib; const output = await PDFDocument.create();
    for (const bytes of sources) { const source = await loadDocument(bytes); const pages = await output.copyPages(source, source.getPageIndices()); for (const page of pages) output.addPage(page); }
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

  const api = { parsePageRanges, formatBytes, crc32, utf8Bytes, zipStore, hexToRgb, mergePdfs, extractPages, splitToPages };
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;

  const ids = ['fileInput', 'pickBtn', 'dropzone', 'workbar', 'fileChips', 'pdfBody', 'rail', 'prevPage', 'nextPage', 'pageInfo', 'stageHint', 'stageCanvas', 'stageEmpty', 'side', 'sideMerge', 'sideExtract', 'sideEdit', 'mergeCount', 'mergeBtn', 'clearBtn', 'extractCount', 'extractBtn', 'selectAllBtn', 'clearSelBtn', 'splitAllBtn', 'editInfo', 'textContent', 'textSize', 'textColor', 'placeTextBtn', 'imageInput', 'imageWidth', 'placeImageBtn', 'rotateBtn', 'deleteBtn', 'exportBtn', 'resetEditBtn', 'status'];
  const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
  const state = { files: [], fileSeq: 0, mode: 'merge', activeId: null, page: 1, pageCount: 0, selection: new Set(), viewDoc: null, viewport: null, pendingTool: null, editDoc: null, editDocId: null, editPreviewBytes: null, editFont: null, editImage: null, summary: { rotated: 0, removed: 0, texts: 0, images: 0 }, fileDocs: new Map() };

  const pdfjs = root.pdfjsLib;
  if (pdfjs && pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.js', location.href).href;

  function setStatus(message, kind = '') { elements.status.textContent = message; elements.status.dataset.kind = kind; }
  function downloadBytes(filename, bytes, mime) { const blob = new Blob([bytes], { type: mime }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }
  function readFileBytes(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(new Uint8Array(reader.result)); reader.onerror = () => reject(new Error('读取文件失败')); reader.readAsArrayBuffer(file); }); }
  function activeFile() { return state.files.find((file) => file.id === state.activeId) || null; }

  async function loadPdfDoc(bytes) { if (!pdfjs) throw new Error('预览组件未加载'); return await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise; }
  async function getFileDoc(file) { if (state.fileDocs.has(file.id)) return state.fileDocs.get(file.id); const doc = await loadPdfDoc(file.bytes); state.fileDocs.set(file.id, doc); return doc; }
  async function renderPageToCanvas(doc, pageNumber, canvas, maxWidth) {
    const page = await doc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.max(0.05, Math.min(maxWidth / base.width, 2.5));
    const viewport = page.getViewport({ scale });
    canvas.width = Math.max(1, Math.floor(viewport.width)); canvas.height = Math.max(1, Math.floor(viewport.height));
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return { viewport };
  }

  function renderChips() {
    elements.fileChips.replaceChildren(...state.files.map((file) => { const chip = document.createElement('button'); chip.type = 'button'; chip.className = `pdf-chip${file.id === state.activeId ? ' is-active' : ''}`; const span = document.createElement('span'); span.textContent = file.name; chip.append(span); chip.addEventListener('click', () => switchActive(file.id)); return chip; }));
  }
  function renderSide() {
    elements.sideMerge.hidden = state.mode !== 'merge';
    elements.sideExtract.hidden = state.mode !== 'extract';
    elements.sideEdit.hidden = state.mode !== 'edit';
    if (state.mode === 'merge') elements.mergeCount.textContent = `共 ${state.files.length} 个文件`;
    if (state.mode === 'extract') elements.extractCount.textContent = `已选 ${state.selection.size} / ${state.pageCount} 页`;
    if (state.mode === 'edit') updateEditInfo();
  }
  function updateEditInfo() {
    if (!state.editDoc) { elements.editInfo.textContent = '尚未载入'; return; }
    const summary = state.summary; const parts = [`共 ${state.editDoc.getPageCount()} 页`];
    if (summary.rotated) parts.push(`旋转 ${summary.rotated} 页`);
    if (summary.removed) parts.push(`删除 ${summary.removed} 页`);
    if (summary.texts) parts.push(`文字 ${summary.texts} 处`);
    if (summary.images) parts.push(`图片 ${summary.images} 处`);
    elements.editInfo.textContent = parts.join('　·　');
  }
  async function renderStage() {
    if (!state.viewDoc || !state.pageCount) { elements.stageCanvas.hidden = true; elements.stageEmpty.hidden = false; elements.pageInfo.textContent = '—'; return; }
    state.page = Math.min(Math.max(1, state.page), state.pageCount);
    elements.pageInfo.textContent = `${state.page} / ${state.pageCount}`;
    try { const result = await renderPageToCanvas(state.viewDoc, state.page, elements.stageCanvas, 900); state.viewport = result.viewport; elements.stageCanvas.hidden = false; elements.stageEmpty.hidden = true; }
    catch (error) { elements.stageCanvas.hidden = true; elements.stageEmpty.hidden = false; elements.stageEmpty.textContent = `预览失败：${error.message}`; }
  }
  async function renderRail() {
    const file = activeFile();
    elements.rail.replaceChildren();
    if (!file) { elements.rail.append(Object.assign(document.createElement('p'), { className: 'pdf-rail__empty', textContent: '请先添加 PDF' })); return; }
    if (state.mode === 'merge') {
      for (let index = 0; index < state.files.length; index += 1) {
        const entry = state.files[index];
        const card = document.createElement('div'); card.className = `pdf-thumb-card${entry.id === state.activeId ? ' is-active' : ''}`; card.draggable = true; card.dataset.index = String(index);
        const canvas = document.createElement('canvas'); card.append(canvas);
        const label = document.createElement('span'); label.className = 'pdf-thumb-card__label'; label.textContent = entry.name; card.append(label);
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'pdf-thumb-card__remove'; remove.textContent = '×'; remove.title = '移除'; remove.setAttribute('aria-label', '移除'); remove.addEventListener('click', (event) => { event.stopPropagation(); removeFile(entry.id); }); card.append(remove);
        card.addEventListener('click', () => switchActive(entry.id));
        card.addEventListener('dragstart', (event) => { event.dataTransfer.setData('text/plain', String(index)); card.classList.add('is-dragging'); });
        card.addEventListener('dragend', () => card.classList.remove('is-dragging'));
        card.addEventListener('dragover', (event) => event.preventDefault());
        card.addEventListener('drop', (event) => { event.preventDefault(); const from = Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from) && from !== index) { const [moved] = state.files.splice(from, 1); state.files.splice(index, 0, moved); renderChips(); renderRail(); } });
        elements.rail.append(card);
        getFileDoc(entry).then((doc) => renderPageToCanvas(doc, 1, canvas, 80)).catch(() => {});
      }
      return;
    }
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
    if (!hasFiles) { elements.rail.replaceChildren(); elements.stageCanvas.hidden = true; elements.stageEmpty.hidden = false; return; }
    await refreshView();
    await renderStage();
    await renderRail();
  }
  async function ensureEditDoc() {
    const file = activeFile(); if (!file) return;
    if (state.editDoc && state.editDocId === file.id) return;
    state.editDoc = await loadDocument(file.bytes); state.editPreviewBytes = file.bytes; state.editDocId = file.id;
    state.editFont = null; state.summary = { rotated: 0, removed: 0, texts: 0, images: 0 };
  }
  async function applyMode() {
    state.pendingTool = null; elements.stageCanvas.classList.remove('is-placing'); elements.stageHint.textContent = '';
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
    state.files = state.files.filter((file) => file.id !== id); state.fileDocs.delete(id);
    if (state.activeId === id) { state.activeId = state.files[0] ? state.files[0].id : null; state.page = 1; state.selection = new Set(); state.editDoc = null; state.editDocId = null; }
    renderAll();
  }
  async function addFiles(fileList) {
    const files = [...fileList].filter((file) => /\.pdf$/i.test(file.name) || file.type === 'application/pdf');
    if (!files.length) { setStatus('请选择 PDF 文件。', 'error'); return; }
    try {
      for (const file of files) { const bytes = await readFileBytes(file); state.fileSeq += 1; state.files.push({ id: `f${state.fileSeq}`, name: file.name, bytes }); }
      if (!state.activeId) state.activeId = state.files[0].id;
      setStatus(`已添加 ${files.length} 个文件，共 ${state.files.length} 个。`, 'success');
      await renderAll();
    } catch (error) { setStatus(error.message, 'error'); }
  }
  function setPending(tool) {
    state.pendingTool = state.pendingTool === tool ? null : tool;
    elements.stageCanvas.classList.toggle('is-placing', Boolean(state.pendingTool));
    elements.placeTextBtn.classList.toggle('button--cta', state.pendingTool === 'text'); elements.placeTextBtn.classList.toggle('button--secondary', state.pendingTool !== 'text');
    elements.placeImageBtn.classList.toggle('button--cta', state.pendingTool === 'image'); elements.placeImageBtn.classList.toggle('button--secondary', state.pendingTool !== 'image');
    elements.stageHint.textContent = state.pendingTool ? (state.pendingTool === 'text' ? '点击页面放置文字' : '点击页面放置图片') : '';
  }
  async function refreshEditPreview() {
    state.editPreviewBytes = await state.editDoc.save();
    state.viewDoc = await loadPdfDoc(state.editPreviewBytes);
    state.pageCount = state.viewDoc.numPages;
    state.page = Math.min(Math.max(1, state.page), state.pageCount);
    await renderStage(); updateEditInfo();
    const active = elements.rail.querySelector(`.pdf-thumb-card[data-page="${state.page}"] canvas`);
    if (active) renderPageToCanvas(state.viewDoc, state.page, active, 90).catch(() => {});
  }

  elements.pickBtn.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', (event) => { const files = [...event.target.files]; event.target.value = ''; if (files.length) addFiles(files); });
  elements.dropzone.addEventListener('dragover', (event) => { event.preventDefault(); elements.dropzone.classList.add('is-over'); });
  elements.dropzone.addEventListener('dragleave', () => elements.dropzone.classList.remove('is-over'));
  elements.dropzone.addEventListener('drop', (event) => { event.preventDefault(); elements.dropzone.classList.remove('is-over'); if (event.dataTransfer && event.dataTransfer.files.length) addFiles(event.dataTransfer.files); });
  for (const button of elements.workbar.querySelectorAll('.pdf-mode')) button.addEventListener('click', () => { state.mode = button.dataset.mode; for (const other of elements.workbar.querySelectorAll('.pdf-mode')) { const active = other === button; other.classList.toggle('is-active', active); other.setAttribute('aria-selected', String(active)); } applyMode(); });
  elements.prevPage.addEventListener('click', () => { state.page -= 1; renderStage(); renderRail(); });
  elements.nextPage.addEventListener('click', () => { state.page += 1; renderStage(); renderRail(); });
  elements.stageCanvas.addEventListener('click', async (event) => {
    if (state.mode !== 'edit' || !state.pendingTool || !state.viewport || !state.editDoc) return;
    const rect = elements.stageCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (elements.stageCanvas.width / rect.width);
    const y = (event.clientY - rect.top) * (elements.stageCanvas.height / rect.height);
    const point = state.viewport.convertToPdfPoint(x, y);
    const page = state.editDoc.getPages()[state.page - 1]; if (!page) return;
    const px = Math.round(point[0]); const py = Math.round(point[1]);
    try {
      if (state.pendingTool === 'text') {
        const text = elements.textContent.value;
        if (!text) { setStatus('请输入要放置的文字。', 'error'); return; }
        if (!/^[\x20-\x7e]*$/.test(text)) { setStatus('内置字体仅支持英文、数字和常用符号。', 'error'); return; }
        state.editFont ||= await state.editDoc.embedFont(root.PDFLib.StandardFonts.Helvetica);
        page.drawText(text, { x: px, y: py, size: Number(elements.textSize.value), font: state.editFont, color: root.PDFLib.rgb(...hexToRgb(elements.textColor.value)) });
        state.summary.texts += 1;
      } else {
        if (!state.editImage) { setStatus('请先选择图片。', 'error'); return; }
        const image = state.editImage.type === 'image/png' ? await state.editDoc.embedPng(state.editImage.bytes) : await state.editDoc.embedJpg(state.editImage.bytes);
        const width = Number(elements.imageWidth.value); const height = width * image.height / image.width;
        page.drawImage(image, { x: px, y: py, width, height });
        state.summary.images += 1;
      }
      setPending(null); await refreshEditPreview(); setStatus('已放置。', 'success');
    } catch (error) { setStatus(`放置失败：${error.message}`, 'error'); }
  });
  elements.mergeBtn.addEventListener('click', async () => {
    if (!state.files.length) return;
    elements.mergeBtn.disabled = true; setStatus('正在合并…', 'info');
    try { const bytes = await mergePdfs(state.files.map((file) => file.bytes)); downloadBytes('merged.pdf', bytes, 'application/pdf'); root.OpenEduAnalytics?.toolUse?.('pdf-toolkit'); setStatus(`已合并 ${state.files.length} 个文件（${formatBytes(bytes.length)}）。`, 'success'); }
    catch (error) { setStatus(`合并失败：${error.message}`, 'error'); }
    finally { elements.mergeBtn.disabled = false; }
  });
  elements.clearBtn.addEventListener('click', () => { state.files = []; state.fileDocs.clear(); state.activeId = null; state.editDoc = null; state.editDocId = null; state.selection = new Set(); renderAll(); setStatus('已清空。', 'info'); });
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
  elements.placeTextBtn.addEventListener('click', () => setPending('text'));
  elements.placeImageBtn.addEventListener('click', () => setPending('image'));
  elements.imageInput.addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0]; event.target.value = '';
    if (!file) return;
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') { setStatus('仅支持 PNG 或 JPG 图片。', 'error'); return; }
    try { state.editImage = { type: file.type, bytes: await readFileBytes(file) }; setStatus(`已选择图片：${file.name}，点击「放置图片」后在页面上点击定位。`, 'success'); }
    catch (error) { setStatus(error.message, 'error'); }
  });
  elements.rotateBtn.addEventListener('click', async () => {
    if (!state.editDoc) return;
    const page = state.editDoc.getPages()[state.page - 1]; if (!page) return;
    page.setRotation(root.PDFLib.degrees(((page.getRotation().angle || 0) + 90) % 360));
    state.summary.rotated += 1; await refreshEditPreview(); setStatus('已旋转当前页。', 'success');
  });
  elements.deleteBtn.addEventListener('click', async () => {
    if (!state.editDoc) return;
    if (state.editDoc.getPageCount() <= 1) { setStatus('不能删除全部页面。', 'error'); return; }
    state.editDoc.removePage(state.page - 1); state.summary.removed += 1;
    state.page = Math.min(state.page, state.editDoc.getPageCount());
    await refreshEditPreview(); await renderRail(); setStatus('已删除当前页。', 'success');
  });
  elements.exportBtn.addEventListener('click', async () => {
    if (!state.editDoc) return;
    elements.exportBtn.disabled = true; setStatus('正在导出…', 'info');
    try { const bytes = await state.editDoc.save(); downloadBytes('edited.pdf', bytes, 'application/pdf'); root.OpenEduAnalytics?.toolUse?.('pdf-toolkit'); setStatus(`已导出（${formatBytes(bytes.length)}）。`, 'success'); }
    catch (error) { setStatus(`导出失败：${error.message}`, 'error'); }
    finally { elements.exportBtn.disabled = false; }
  });
  elements.resetEditBtn.addEventListener('click', async () => {
    const file = activeFile(); if (!file) return;
    state.editDoc = await loadDocument(file.bytes); state.editPreviewBytes = file.bytes; state.editFont = null; state.summary = { rotated: 0, removed: 0, texts: 0, images: 0 };
    await renderAll(); setStatus('已撤销全部修改。', 'info');
  });

  renderAll();
})(typeof globalThis !== 'undefined' ? globalThis : this);
