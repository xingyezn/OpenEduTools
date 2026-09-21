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

  const ids = ['tabMerge', 'tabSplit', 'tabEdit', 'panelMerge', 'panelSplit', 'panelEdit', 'mergeInput', 'mergeList', 'mergeBtn', 'mergeClear', 'mergeStatus', 'splitInput', 'splitInfo', 'splitRange', 'extractBtn', 'splitAllBtn', 'splitStatus', 'editInput', 'editInfo', 'rotateRange', 'rotateAngle', 'rotateBtn', 'removeRange', 'removeBtn', 'textContent', 'textPage', 'textSize', 'textX', 'textY', 'textColor', 'addTextBtn', 'imageInput', 'imagePage', 'imageWidth', 'imageX', 'imageY', 'addImageBtn', 'exportBtn', 'resetEditBtn', 'editStatus'];
  const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
  const state = { mergeFiles: [], splitBytes: null, splitCount: 0, editBytes: null, editDoc: null, editFont: null, editImage: null, editSummary: { rotated: 0, removed: 0, texts: 0, images: 0 } };

  function setStatus(node, message, kind = '') { node.textContent = message; node.dataset.kind = kind; }
  function downloadBytes(filename, bytes, mime) { const blob = new Blob([bytes], { type: mime }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }
  function readFileBytes(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(new Uint8Array(reader.result)); reader.onerror = () => reject(new Error('读取文件失败')); reader.readAsArrayBuffer(file); }); }

  function switchTab(name) {
    const map = { merge: [elements.tabMerge, elements.panelMerge], split: [elements.tabSplit, elements.panelSplit], edit: [elements.tabEdit, elements.panelEdit] };
    for (const [key, [tab, panel]] of Object.entries(map)) { const active = key === name; tab.classList.toggle('is-active', active); tab.setAttribute('aria-selected', String(active)); panel.hidden = !active; }
  }
  elements.tabMerge.addEventListener('click', () => switchTab('merge'));
  elements.tabSplit.addEventListener('click', () => switchTab('split'));
  elements.tabEdit.addEventListener('click', () => switchTab('edit'));

  function renderMergeList() {
    if (!state.mergeFiles.length) { elements.mergeList.replaceChildren(Object.assign(document.createElement('li'), { className: 'pdf-list__empty', textContent: '尚未选择文件' })); elements.mergeBtn.disabled = true; return; }
    elements.mergeList.replaceChildren(...state.mergeFiles.map((entry, index) => {
      const item = document.createElement('li'); item.className = 'pdf-item';
      const info = document.createElement('div'); const name = document.createElement('div'); name.className = 'pdf-item__name'; name.textContent = entry.name; const meta = document.createElement('div'); meta.className = 'pdf-item__meta'; meta.textContent = `${formatBytes(entry.bytes.length)}　第 ${index + 1} 个`; info.append(name, meta);
      const actions = document.createElement('div'); actions.className = 'pdf-item__actions';
      const up = document.createElement('button'); up.type = 'button'; up.textContent = '↑'; up.setAttribute('aria-label', '上移'); up.disabled = index === 0; up.addEventListener('click', () => { const [moved] = state.mergeFiles.splice(index, 1); state.mergeFiles.splice(index - 1, 0, moved); renderMergeList(); });
      const down = document.createElement('button'); down.type = 'button'; down.textContent = '↓'; down.setAttribute('aria-label', '下移'); down.disabled = index === state.mergeFiles.length - 1; down.addEventListener('click', () => { const [moved] = state.mergeFiles.splice(index, 1); state.mergeFiles.splice(index + 1, 0, moved); renderMergeList(); });
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', '移除'); remove.addEventListener('click', () => { state.mergeFiles.splice(index, 1); renderMergeList(); });
      actions.append(up, down, remove); item.append(info, actions); return item;
    }));
    elements.mergeBtn.disabled = state.mergeFiles.length < 1;
  }
  elements.mergeInput.addEventListener('change', async (event) => {
    const files = [...event.target.files].filter((file) => /\.pdf$/i.test(file.name) || file.type === 'application/pdf');
    event.target.value = '';
    if (!files.length) { setStatus(elements.mergeStatus, '请选择 PDF 文件。', 'error'); return; }
    try { for (const file of files) state.mergeFiles.push({ name: file.name, bytes: await readFileBytes(file) }); renderMergeList(); setStatus(elements.mergeStatus, `已添加 ${files.length} 个文件，共 ${state.mergeFiles.length} 个。`, 'success'); } catch (error) { setStatus(elements.mergeStatus, error.message, 'error'); }
  });
  elements.mergeClear.addEventListener('click', () => { state.mergeFiles = []; renderMergeList(); setStatus(elements.mergeStatus, '已清空。', 'info'); });
  elements.mergeBtn.addEventListener('click', async () => {
    if (!state.mergeFiles.length) return;
    elements.mergeBtn.disabled = true; setStatus(elements.mergeStatus, '正在合并…', 'info');
    try { const bytes = await mergePdfs(state.mergeFiles.map((entry) => entry.bytes)); downloadBytes('merged.pdf', bytes, 'application/pdf'); root.OpenEduAnalytics?.toolUse?.('pdf-toolkit'); setStatus(elements.mergeStatus, `已合并 ${state.mergeFiles.length} 个文件（${formatBytes(bytes.length)}）。`, 'success'); }
    catch (error) { setStatus(elements.mergeStatus, `合并失败：${error.message}`, 'error'); }
    finally { elements.mergeBtn.disabled = state.mergeFiles.length < 1; }
  });

  elements.splitInput.addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0]; event.target.value = '';
    if (!file) return;
    try { state.splitBytes = await readFileBytes(file); const doc = await loadDocument(state.splitBytes); state.splitCount = doc.getPageCount(); elements.splitInfo.textContent = `${file.name}　共 ${state.splitCount} 页`; elements.extractBtn.disabled = false; elements.splitAllBtn.disabled = false; setStatus(elements.splitStatus, '已载入，可提取或拆分。', 'success'); }
    catch (error) { state.splitBytes = null; elements.splitInfo.textContent = '尚未载入'; elements.extractBtn.disabled = true; elements.splitAllBtn.disabled = true; setStatus(elements.splitStatus, `无法读取 PDF：${error.message}`, 'error'); }
  });
  elements.extractBtn.addEventListener('click', async () => {
    if (!state.splitBytes) return;
    try { const indices = parsePageRanges(elements.splitRange.value, state.splitCount); const bytes = await extractPages(state.splitBytes, indices); downloadBytes('extracted.pdf', bytes, 'application/pdf'); root.OpenEduAnalytics?.toolUse?.('pdf-toolkit'); setStatus(elements.splitStatus, `已提取 ${indices.length} 页（${formatBytes(bytes.length)}）。`, 'success'); }
    catch (error) { setStatus(elements.splitStatus, error.message, 'error'); }
  });
  elements.splitAllBtn.addEventListener('click', async () => {
    if (!state.splitBytes) return;
    elements.splitAllBtn.disabled = true; setStatus(elements.splitStatus, '正在拆分…', 'info');
    try { const pages = await splitToPages(state.splitBytes); const files = pages.map((bytes, index) => ({ name: `page-${String(index + 1).padStart(3, '0')}.pdf`, data: bytes })); const zip = zipStore(files); downloadBytes('pdf-pages.zip', zip, 'application/zip'); root.OpenEduAnalytics?.toolUse?.('pdf-toolkit'); setStatus(elements.splitStatus, `已拆分为 ${pages.length} 个文件并打包下载。`, 'success'); }
    catch (error) { setStatus(elements.splitStatus, `拆分失败：${error.message}`, 'error'); }
    finally { elements.splitAllBtn.disabled = false; }
  });

  function updateEditInfo() {
    if (!state.editDoc) { elements.editInfo.textContent = '尚未载入'; return; }
    const summary = state.editSummary; const parts = [`共 ${state.editDoc.getPageCount()} 页`];
    if (summary.rotated) parts.push(`旋转 ${summary.rotated} 页`);
    if (summary.removed) parts.push(`删除 ${summary.removed} 页`);
    if (summary.texts) parts.push(`文字 ${summary.texts} 处`);
    if (summary.images) parts.push(`图片 ${summary.images} 处`);
    elements.editInfo.textContent = parts.join('　·　');
  }
  function setEditEnabled(enabled) { for (const id of ['rotateBtn', 'removeBtn', 'addTextBtn', 'addImageBtn', 'exportBtn', 'resetEditBtn']) elements[id].disabled = !enabled; }
  elements.editInput.addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0]; event.target.value = '';
    if (!file) return;
    try { state.editBytes = await readFileBytes(file); state.editDoc = await loadDocument(state.editBytes); state.editFont = null; state.editSummary = { rotated: 0, removed: 0, texts: 0, images: 0 }; setEditEnabled(true); updateEditInfo(); setStatus(elements.editStatus, '已载入，可执行操作后导出。', 'success'); }
    catch (error) { state.editBytes = null; state.editDoc = null; setEditEnabled(false); updateEditInfo(); setStatus(elements.editStatus, `无法读取 PDF：${error.message}`, 'error'); }
  });
  elements.rotateBtn.addEventListener('click', () => {
    if (!state.editDoc) return;
    try { const indices = parsePageRanges(elements.rotateRange.value, state.editDoc.getPageCount()); const delta = Number(elements.rotateAngle.value); const pages = state.editDoc.getPages(); for (const index of indices) { const page = pages[index]; if (page) page.setRotation(root.PDFLib.degrees(((page.getRotation().angle || 0) + delta) % 360)); } state.editSummary.rotated += indices.length; updateEditInfo(); setStatus(elements.editStatus, `已旋转 ${indices.length} 页。`, 'success'); }
    catch (error) { setStatus(elements.editStatus, error.message, 'error'); }
  });
  elements.removeBtn.addEventListener('click', () => {
    if (!state.editDoc) return;
    try { const indices = parsePageRanges(elements.removeRange.value, state.editDoc.getPageCount()); if (indices.length >= state.editDoc.getPageCount()) throw new Error('不能删除全部页面'); for (const index of indices.slice().sort((a, b) => b - a)) state.editDoc.removePage(index); state.editSummary.removed += indices.length; updateEditInfo(); setStatus(elements.editStatus, `已删除 ${indices.length} 页。`, 'success'); }
    catch (error) { setStatus(elements.editStatus, error.message, 'error'); }
  });
  elements.addTextBtn.addEventListener('click', async () => {
    if (!state.editDoc) return;
    const text = elements.textContent.value;
    if (!text) { setStatus(elements.editStatus, '请输入要添加的文字。', 'error'); return; }
    if (!/^[\x20-\x7e]*$/.test(text)) { setStatus(elements.editStatus, '内置字体仅支持英文、数字和常用符号，暂不支持中文。', 'error'); return; }
    try {
      const page = state.editDoc.getPages()[Number(elements.textPage.value) - 1];
      if (!page) throw new Error('页码超出范围');
      state.editFont ||= await state.editDoc.embedFont(root.PDFLib.StandardFonts.Helvetica);
      page.drawText(text, { x: Number(elements.textX.value), y: Number(elements.textY.value), size: Number(elements.textSize.value), font: state.editFont, color: root.PDFLib.rgb(...hexToRgb(elements.textColor.value)) });
      state.editSummary.texts += 1; updateEditInfo(); setStatus(elements.editStatus, '已添加文字。', 'success');
    } catch (error) { setStatus(elements.editStatus, `添加文字失败：${error.message}`, 'error'); }
  });
  elements.addImageBtn.addEventListener('click', async () => {
    if (!state.editDoc) return;
    if (!state.editImage) { setStatus(elements.editStatus, '请先选择图片。', 'error'); return; }
    try {
      const page = state.editDoc.getPages()[Number(elements.imagePage.value) - 1];
      if (!page) throw new Error('页码超出范围');
      const image = state.editImage.type === 'image/png' ? await state.editDoc.embedPng(state.editImage.bytes) : await state.editDoc.embedJpg(state.editImage.bytes);
      const width = Number(elements.imageWidth.value); const height = width * image.height / image.width;
      page.drawImage(image, { x: Number(elements.imageX.value), y: Number(elements.imageY.value), width, height });
      state.editSummary.images += 1; updateEditInfo(); setStatus(elements.editStatus, '已添加图片。', 'success');
    } catch (error) { setStatus(elements.editStatus, `添加图片失败：${error.message}`, 'error'); }
  });
  elements.imageInput.addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0]; event.target.value = '';
    if (!file) return;
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') { setStatus(elements.editStatus, '仅支持 PNG 或 JPG 图片。', 'error'); return; }
    try { state.editImage = { type: file.type, bytes: await readFileBytes(file) }; setStatus(elements.editStatus, `已选择图片：${file.name}`, 'success'); }
    catch (error) { setStatus(elements.editStatus, error.message, 'error'); }
  });
  elements.exportBtn.addEventListener('click', async () => {
    if (!state.editDoc) return;
    elements.exportBtn.disabled = true; setStatus(elements.editStatus, '正在导出…', 'info');
    try { const bytes = await state.editDoc.save(); downloadBytes('edited.pdf', bytes, 'application/pdf'); root.OpenEduAnalytics?.toolUse?.('pdf-toolkit'); setStatus(elements.editStatus, `已导出（${formatBytes(bytes.length)}）。`, 'success'); }
    catch (error) { setStatus(elements.editStatus, `导出失败：${error.message}`, 'error'); }
    finally { elements.exportBtn.disabled = false; }
  });
  elements.resetEditBtn.addEventListener('click', async () => {
    if (!state.editBytes) return;
    try { state.editDoc = await loadDocument(state.editBytes); state.editFont = null; state.editSummary = { rotated: 0, removed: 0, texts: 0, images: 0 }; updateEditInfo(); setStatus(elements.editStatus, '已撤销全部修改。', 'info'); }
    catch (error) { setStatus(elements.editStatus, error.message, 'error'); }
  });
  renderMergeList(); updateEditInfo();
})(typeof globalThis !== 'undefined' ? globalThis : this);
