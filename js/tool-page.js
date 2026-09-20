(function (root) {
  'use strict';
  function showToast(message) {
    let toast = document.querySelector('[data-toast]');
    if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; toast.dataset.toast = ''; toast.setAttribute('role', 'status'); document.body.append(toast); }
    toast.textContent = message; toast.hidden = false; clearTimeout(showToast.timer); showToast.timer = setTimeout(() => { toast.hidden = true; }, 2600);
  }
  async function copyText(text) {
    try { if (!navigator.clipboard || !window.isSecureContext) throw new Error('clipboard unavailable'); await navigator.clipboard.writeText(text); showToast('已复制到剪贴板'); return true; }
    catch { showToast('无法自动复制，请手动选择并复制'); return false; }
  }
  function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
    const safeName = String(filename).replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '-').slice(0, 80) || 'download.txt';
    const url = URL.createObjectURL(new Blob([text], { type: mime })); const link = document.createElement('a'); link.href = url; link.download = safeName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); showToast('已开始下载');
  }
  function downloadDataUrl(filename, dataUrl) {
    const link = document.createElement('a'); link.href = dataUrl; link.download = String(filename).replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '-').slice(0, 80) || 'download.png'; link.click(); showToast('已开始下载');
  }

  /* ================= 二维码（字节模式，纠错 L/M，版本 1–10） ================= */
  const QR_TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
  const QR_BLOCKS = {
    L: [null, [[1, 19]], [[1, 34]], [[1, 55]], [[1, 80]], [[1, 108]], [[2, 68]], [[2, 78]], [[2, 97]], [[2, 116]], [[2, 68], [2, 69]]],
    M: [null, [[1, 16]], [[1, 28]], [[1, 44]], [[2, 32]], [[2, 43]], [[4, 27]], [[4, 31]], [[2, 38], [2, 39]], [[3, 36], [2, 37]], [[4, 43], [1, 44]]]
  };
  const QR_ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  const QR_FINDER_A = [true, false, true, true, true, false, true, false, false, false, false];
  const QR_FINDER_B = [false, false, false, false, true, false, true, true, true, false, true];

  const QR_EXP = new Uint8Array(512); const QR_LOG = new Uint8Array(256);
  (function initGalois() { let value = 1; for (let index = 0; index < 255; index += 1) { QR_EXP[index] = value; QR_LOG[value] = index; value <<= 1; if (value & 0x100) value ^= 0x11d; } for (let index = 255; index < 512; index += 1) QR_EXP[index] = QR_EXP[index - 255]; }());
  function gfMul(left, right) { if (left === 0 || right === 0) return 0; return QR_EXP[QR_LOG[left] + QR_LOG[right]]; }
  function rsDivisor(degree) {
    const result = new Array(degree).fill(0); result[degree - 1] = 1; let root = 1;
    for (let index = 0; index < degree; index += 1) {
      for (let position = 0; position < degree; position += 1) { result[position] = gfMul(result[position], root); if (position + 1 < degree) result[position] ^= result[position + 1]; }
      root = gfMul(root, 0x02);
    }
    return result;
  }
  function rsRemainder(data, divisor) {
    const result = new Array(divisor.length).fill(0);
    for (const byte of data) { const factor = byte ^ result[0]; result.shift(); result.push(0); for (let index = 0; index < divisor.length; index += 1) result[index] ^= gfMul(divisor[index], factor); }
    return result;
  }
  function utf8Bytes(text) {
    const bytes = []; const value = String(text);
    for (let index = 0; index < value.length; index += 1) {
      const code = value.codePointAt(index); if (code > 0xffff) index += 1;
      if (code < 0x80) bytes.push(code);
      else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
    return bytes;
  }
  function dataCapacityBits(version, level) { let total = 0; for (const group of QR_BLOCKS[level][version]) total += group[0] * group[1]; return total * 8; }
  function charCountBits(version) { return version <= 9 ? 8 : 16; }
  function qrFormatBits(level, mask) {
    const value = (level << 3) | mask; let remainder = value;
    for (let index = 0; index < 10; index += 1) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
    return ((value << 10) | remainder) ^ 0x5412;
  }
  function qrVersionBits(version) { let remainder = version; for (let index = 0; index < 12; index += 1) remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25); return (version << 12) | remainder; }
  function buildCodewords(bytes, version, level) {
    const capacity = dataCapacityBits(version, level); const bits = [];
    const put = (value, length) => { for (let index = length - 1; index >= 0; index -= 1) bits.push((value >>> index) & 1); };
    put(4, 4); put(bytes.length, charCountBits(version)); for (const byte of bytes) put(byte, 8);
    put(0, Math.min(4, capacity - bits.length));
    while (bits.length % 8 !== 0) bits.push(0);
    const pads = [0xec, 0x11]; let padIndex = 0;
    while (bits.length < capacity) { put(pads[padIndex % 2], 8); padIndex += 1; }
    const codewords = []; for (let index = 0; index < bits.length; index += 8) { let value = 0; for (let offset = 0; offset < 8; offset += 1) value = (value << 1) | bits[index + offset]; codewords.push(value); }
    const groups = QR_BLOCKS[level][version]; const blocks = []; let offset = 0;
    for (const group of groups) for (let count = 0; count < group[0]; count += 1) { blocks.push(codewords.slice(offset, offset + group[1])); offset += group[1]; }
    const eccPerBlock = (QR_TOTAL_CODEWORDS[version] - codewords.length) / blocks.length; const divisor = rsDivisor(eccPerBlock);
    const eccBlocks = blocks.map((block) => rsRemainder(block, divisor));
    const result = []; const maxData = Math.max(...blocks.map((block) => block.length));
    for (let index = 0; index < maxData; index += 1) for (const block of blocks) if (index < block.length) result.push(block[index]);
    for (let index = 0; index < eccPerBlock; index += 1) for (const block of eccBlocks) result.push(block[index]);
    return result;
  }
  function buildMatrix(version, level, codewords, mask) {
    const size = version * 4 + 17;
    const modules = Array.from({ length: size }, () => new Array(size).fill(false));
    const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));
    const setFn = (x, y, dark) => { modules[y][x] = dark; isFunction[y][x] = true; };
    const drawFinder = (cx, cy) => { for (let dy = -4; dy <= 4; dy += 1) for (let dx = -4; dx <= 4; dx += 1) { const x = cx + dx; const y = cy + dy; if (x < 0 || x >= size || y < 0 || y >= size) continue; const dist = Math.max(Math.abs(dx), Math.abs(dy)); setFn(x, y, dist !== 2 && dist !== 4); } };
    drawFinder(3, 3); drawFinder(size - 4, 3); drawFinder(3, size - 4);
    for (let index = 8; index < size - 8; index += 1) { setFn(index, 6, index % 2 === 0); setFn(6, index, index % 2 === 0); }
    const align = QR_ALIGN[version];
    for (const cy of align) for (const cx of align) {
      if (isFunction[cy][cx]) continue;
      for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const reserve = (x, y) => { isFunction[y][x] = true; };
    for (let index = 0; index < 9; index += 1) { if (index !== 6) { reserve(8, index); reserve(index, 8); } }
    reserve(8, 8);
    for (let index = 0; index < 8; index += 1) { reserve(size - 1 - index, 8); reserve(8, size - 1 - index); }
    if (version >= 7) for (let index = 0; index < 18; index += 1) { const a = size - 11 + (index % 3); const b = Math.floor(index / 3); reserve(a, b); reserve(b, a); }
    let bitIndex = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right <= 6) right -= 1;
      for (let vert = 0; vert < size; vert += 1) for (let column = 0; column < 2; column += 1) {
        const x = right - column; let upward = ((right + 1) & 2) === 0; if (x < 6) upward = !upward; const y = upward ? size - 1 - vert : vert;
        if (isFunction[y][x]) continue;
        let dark = false;
        if (bitIndex < codewords.length * 8) dark = ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) === 1;
        modules[y][x] = dark; bitIndex += 1;
      }
    }
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
      if (isFunction[y][x]) continue;
      let invert = false;
      switch (mask) {
        case 0: invert = (x + y) % 2 === 0; break;
        case 1: invert = y % 2 === 0; break;
        case 2: invert = x % 3 === 0; break;
        case 3: invert = (x + y) % 3 === 0; break;
        case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
        case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        case 7: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        default: break;
      }
      if (invert) modules[y][x] = !modules[y][x];
    }
    const format = qrFormatBits(level, mask); const getBit = (value, index) => ((value >>> index) & 1) === 1;
    for (let index = 0; index < 6; index += 1) setFn(8, index, getBit(format, index));
    setFn(8, 7, getBit(format, 6)); setFn(8, 8, getBit(format, 7)); setFn(7, 8, getBit(format, 8));
    for (let index = 9; index < 15; index += 1) setFn(14 - index, 8, getBit(format, index));
    for (let index = 0; index < 8; index += 1) setFn(size - 1 - index, 8, getBit(format, index));
    for (let index = 8; index < 15; index += 1) setFn(8, size - 15 + index, getBit(format, index));
    setFn(8, size - 8, true);
    if (version >= 7) { const versionBits = qrVersionBits(version); for (let index = 0; index < 18; index += 1) { const bit = getBit(versionBits, index); const a = size - 11 + (index % 3); const b = Math.floor(index / 3); setFn(a, b, bit); setFn(b, a, bit); } }
    return modules;
  }
  function penaltyScore(modules) {
    const size = modules.length; let result = 0;
    for (let y = 0; y < size; y += 1) { let runColor = modules[y][0]; let runLength = 1; for (let x = 1; x < size; x += 1) { if (modules[y][x] === runColor) { runLength += 1; if (runLength === 5) result += 3; else if (runLength > 5) result += 1; } else { runColor = modules[y][x]; runLength = 1; } } }
    for (let x = 0; x < size; x += 1) { let runColor = modules[0][x]; let runLength = 1; for (let y = 1; y < size; y += 1) { if (modules[y][x] === runColor) { runLength += 1; if (runLength === 5) result += 3; else if (runLength > 5) result += 1; } else { runColor = modules[y][x]; runLength = 1; } } }
    for (let y = 0; y < size - 1; y += 1) for (let x = 0; x < size - 1; x += 1) { const color = modules[y][x]; if (color === modules[y][x + 1] && color === modules[y + 1][x] && color === modules[y + 1][x + 1]) result += 3; }
    const matchesPattern = (get, length, start, pattern) => { for (let index = 0; index < 11; index += 1) if (get(start + index) !== pattern[index]) return false; return true; };
    for (let y = 0; y < size; y += 1) for (let x = 0; x <= size - 11; x += 1) { if (matchesPattern((i) => modules[y][i], size, x, QR_FINDER_A) || matchesPattern((i) => modules[y][i], size, x, QR_FINDER_B)) result += 40; }
    for (let x = 0; x < size; x += 1) for (let y = 0; y <= size - 11; y += 1) { if (matchesPattern((i) => modules[i][x], size, y, QR_FINDER_A) || matchesPattern((i) => modules[i][x], size, y, QR_FINDER_B)) result += 40; }
    let dark = 0; for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) if (modules[y][x]) dark += 1;
    const total = size * size; result += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
    return result;
  }
  function encodeQr(text, level = 'M', forcedMask = null) {
    const normalized = level === 'L' ? 'L' : 'M'; const ec = normalized === 'L' ? 1 : 0;
    const bytes = utf8Bytes(text); let version = 0;
    for (let candidate = 1; candidate <= 10; candidate += 1) { if (4 + charCountBits(candidate) + 8 * bytes.length <= dataCapacityBits(candidate, normalized)) { version = candidate; break; } }
    if (!version) return null;
    const codewords = buildCodewords(bytes, version, normalized);
    if (forcedMask !== null && forcedMask !== undefined) return { version, size: version * 4 + 17, mask: forcedMask, modules: buildMatrix(version, ec, codewords, forcedMask) };
    let best = null;
    for (let mask = 0; mask < 8; mask += 1) { const modules = buildMatrix(version, ec, codewords, mask); const score = penaltyScore(modules); if (!best || score < best.score) best = { modules, mask, score }; }
    return { version, size: version * 4 + 17, mask: best.mask, modules: best.modules };
  }

  /* ================= 分享 ================= */
  function buildShareLinks(url, title) {
    const encodedUrl = encodeURIComponent(url); const encodedTitle = encodeURIComponent(title); const combined = encodeURIComponent(`${title} ${url}`);
    return {
      weibo: `https://service.weibo.com/share/share.php?url=${encodedUrl}&title=${encodedTitle}`,
      qzone: `https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=${encodedUrl}&title=${encodedTitle}`,
      qq: `https://connect.qq.com/widget/shareqq/index.html?url=${encodedUrl}&title=${encodedTitle}`,
      x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      whatsapp: `https://api.whatsapp.com/send?text=${combined}`,
      reddit: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
      email: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`
    };
  }
  async function copyCanvasImage(canvas) {
    try {
      if (!navigator.clipboard || typeof ClipboardItem === 'undefined') throw new Error('unsupported');
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showToast('二维码已复制到剪贴板');
      return true;
    } catch { showToast('当前浏览器不支持复制图片，请改用截图或系统分享'); return false; }
  }
  function drawQr(canvas, modules) {
    const size = modules.length; const quiet = 4; const scale = 6; const dimension = (size + quiet * 2) * scale;
    canvas.width = dimension; canvas.height = dimension;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, dimension, dimension);
    context.fillStyle = '#111111';
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) if (modules[y][x]) context.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
  }
  function shareTitle() { return document.querySelector('.tool-header h1')?.textContent?.trim() || document.title.replace(/\s*·\s*OpenEduTools\s*$/, ''); }
  function openShareDialog() {
    const url = location.href; const title = shareTitle();
    const qr = encodeQr(url, url.length > 110 ? 'L' : 'M');
    const overlay = document.createElement('div'); overlay.className = 'share-dialog'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', '分享');
    const panel = document.createElement('div'); panel.className = 'share-dialog__panel';
    const head = document.createElement('div'); head.className = 'share-dialog__head';
    const heading = document.createElement('h2'); heading.textContent = '分享';
    const close = document.createElement('button'); close.type = 'button'; close.className = 'icon-btn'; close.setAttribute('aria-label', '关闭'); close.textContent = '×';
    head.append(heading, close);
    const titleNode = document.createElement('p'); titleNode.className = 'share-dialog__title'; titleNode.textContent = title;
    const urlRow = document.createElement('div'); urlRow.className = 'share-dialog__url';
    const urlInput = document.createElement('input'); urlInput.type = 'text'; urlInput.readOnly = true; urlInput.value = url; urlInput.setAttribute('aria-label', '页面网址');
    const copyButton = document.createElement('button'); copyButton.type = 'button'; copyButton.className = 'button'; copyButton.textContent = '复制链接';
    copyButton.addEventListener('click', async () => { if (await copyText(url)) { urlInput.select(); } });
    urlRow.append(urlInput, copyButton);
    const body = document.createElement('div'); body.className = 'share-dialog__body';
    const qrBox = document.createElement('div'); qrBox.className = 'share-qr';
    if (qr) {
      const canvas = document.createElement('canvas'); canvas.className = 'share-qr__canvas'; canvas.setAttribute('aria-label', '页面二维码'); drawQr(canvas, qr.modules);
      const copyQr = document.createElement('button'); copyQr.type = 'button'; copyQr.className = 'button button--secondary'; copyQr.textContent = '复制二维码';
      copyQr.addEventListener('click', () => copyCanvasImage(canvas));
      qrBox.append(canvas, copyQr);
    } else {
      const note = document.createElement('p'); note.className = 'small muted'; note.textContent = '网址较长，无法生成二维码，请使用复制链接或系统分享。'; qrBox.append(note);
    }
    const links = document.createElement('div'); links.className = 'share-links';
    const shareLinks = buildShareLinks(url, title);
    const targets = [['weibo', '微博'], ['qzone', 'QQ空间'], ['qq', 'QQ好友'], ['x', 'X'], ['facebook', 'Facebook'], ['linkedin', 'LinkedIn'], ['telegram', 'Telegram'], ['whatsapp', 'WhatsApp'], ['reddit', 'Reddit']];
    for (const [key, label] of targets) { const anchor = document.createElement('a'); anchor.className = 'share-link'; anchor.href = shareLinks[key]; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.textContent = label; links.append(anchor); }
    const xiaohongshu = document.createElement('button'); xiaohongshu.type = 'button'; xiaohongshu.className = 'share-link'; xiaohongshu.textContent = '小红书';
    xiaohongshu.addEventListener('click', async () => { if (await copyText(`${title} ${url}`)) showToast('已复制链接，请在小红书 App 中粘贴发布'); });
    links.append(xiaohongshu);
    const mail = document.createElement('a'); mail.className = 'share-link'; mail.href = shareLinks.email; mail.textContent = '邮件'; links.append(mail);
    if (navigator.share) {
      const native = document.createElement('button'); native.type = 'button'; native.className = 'button button--secondary'; native.textContent = '系统分享';
      native.addEventListener('click', () => navigator.share({ title, text: title, url }).catch(() => {}));
      links.append(native);
    }
    const hint = document.createElement('p'); hint.className = 'share-dialog__hint small muted'; hint.textContent = '微信、小红书等未提供网页分享的 App，可复制链接或二维码后到 App 内粘贴；YouTube、B 站等视频平台需上传视频，无法直接分享网址。';
    body.append(qrBox, links);
    panel.append(head, titleNode, urlRow, body, hint); overlay.append(panel);
    const previous = document.activeElement;
    function closeDialog() { overlay.remove(); document.removeEventListener('keydown', onKey); if (previous && previous.focus) previous.focus(); }
    function onKey(event) { if (event.key === 'Escape') closeDialog(); }
    close.addEventListener('click', closeDialog);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeDialog(); });
    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    close.focus();
  }
  function initShare() {
    const nav = document.querySelector('.site-nav'); if (!nav || nav.querySelector('[data-share-button]')) return;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'share-button'; button.dataset.shareButton = ''; button.textContent = '分享';
    button.addEventListener('click', openShareDialog);
    const themeField = nav.querySelector('.theme-field'); nav.insertBefore(button, themeField || null);
  }

  function init() {
    initShare();
    const id = document.body.dataset.toolId; if (!id) return;
    const favoriteButton = document.querySelector('[data-tool-favorite]');
    if (favoriteButton && id !== 'sample-tool' && !document.documentElement.hasAttribute('data-offline-bundle')) {
      const actions = document.createElement('div'); actions.className = 'tool-header__actions';
      const parent = favoriteButton.parentNode; parent.insertBefore(actions, favoriteButton); actions.append(favoriteButton);
      const download = document.createElement('a'); download.className = 'button button--secondary'; download.href = `../../downloads/${id}.zip`; download.download = `${id}.zip`; download.textContent = '下载离线包'; actions.append(download);
    }
    let favorites;
    try { favorites = root.OETFavorites.createFavorites(localStorage); root.OETRecent.createRecent(localStorage).add(id); } catch { showToast('浏览器存储不可用，工具仍可正常使用'); }
    function sync() { if (!favoriteButton || !favorites) return; const active = favorites.get().includes(id); favoriteButton.textContent = active ? '★ 已收藏' : '☆ 收藏'; favoriteButton.setAttribute('aria-pressed', String(active)); }
    if (favoriteButton) favoriteButton.addEventListener('click', () => { const result = favorites?.toggle(id); sync(); showToast(result?.saved === false ? '收藏仅在本页有效，浏览器存储不可用' : (result?.value.includes(id) ? '已收藏' : '已取消收藏')); });
    sync();
  }
  const api = { showToast, copyText, downloadText, downloadDataUrl, utf8Bytes, encodeQr, buildShareLinks, openShareDialog };
  root.OETToolPage = api;
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init(); }
})(typeof globalThis !== 'undefined' ? globalThis : this);
