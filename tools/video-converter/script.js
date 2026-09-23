(function (root) {
  'use strict';

  const OUTPUT_TARGETS = [
    { id: 'mp4', name: 'MP4', extension: 'mp4', mimeType: 'video/mp4', videoCodec: 'avc', audioCodec: 'aac' },
    { id: 'webm', name: 'WebM', extension: 'webm', mimeType: 'video/webm', videoCodec: 'vp9', audioCodec: 'opus' }
  ];
  const CODEC_CANDIDATES = {
    mp4: { video: ['avc', 'av1', 'vp9'], audio: ['aac', 'opus', 'mp3'] },
    webm: { video: ['vp9', 'av1', 'vp8'], audio: ['opus', 'vorbis'] }
  };
  const PRESETS = [
    { id: 'quality', name: '保持画质', quality: 'very-high', audioQuality: 'high' },
    { id: 'balanced', name: '均衡', quality: 'medium', audioQuality: 'medium' },
    { id: 'size', name: '优先减小体积', quality: 'low', audioQuality: 'low' },
    { id: 'remux', name: '仅换封装', remux: true }
  ];
  const QUALITY_BPP = { 'very-low': 0.035, low: 0.05, medium: 0.085, high: 0.13, 'very-high': 0.19 };
  const AUDIO_BITRATES = { 'very-low': 48000, low: 64000, medium: 96000, high: 128000, 'very-high': 192000 };
  const CODEC_LABELS = {
    avc: 'H.264', hevc: 'H.265/HEVC', vp8: 'VP8', vp9: 'VP9', av1: 'AV1', prores: 'ProRes',
    aac: 'AAC', opus: 'Opus', mp3: 'MP3', vorbis: 'Vorbis', flac: 'FLAC', ac3: 'AC-3', eac3: 'E.AC-3', dts: 'DTS'
  };

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function toPositive(value) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : 0; }

  function codecLabel(codec) {
    if (!codec) return '未知';
    if (CODEC_LABELS[codec]) return CODEC_LABELS[codec];
    if (/^pcm/.test(codec)) return 'PCM';
    return String(codec).toUpperCase();
  }

  function codecCandidates(targetId) {
    const set = CODEC_CANDIDATES[targetId] || CODEC_CANDIDATES.mp4;
    return { video: set.video.slice(), audio: set.audio.slice() };
  }

  function estimateBitrate(width, height, frameRate, quality) {
    const w = toPositive(width); const h = toPositive(height); const fps = toPositive(frameRate) || 30;
    if (!w || !h) return 0;
    return Math.round(w * h * fps * (QUALITY_BPP[quality] || QUALITY_BPP.medium));
  }

  function estimateAudioBitrate(quality) { return AUDIO_BITRATES[quality] || AUDIO_BITRATES.medium; }

  function estimateOutputSize(duration, videoBitrate, audioBitrate) {
    const seconds = toPositive(duration);
    const video = toPositive(videoBitrate);
    const audio = toPositive(audioBitrate);
    if (!seconds || (!video && !audio)) return 0;
    return Math.round(((video + audio) / 8) * seconds);
  }

  function resolveDimension(width, height, maxHeight) {
    const w = Math.round(toPositive(width)); const h = Math.round(toPositive(height)); const limit = Math.round(toPositive(maxHeight));
    const even = (value) => { const rounded = Math.round(value); return Math.max(2, rounded - (rounded % 2)); };
    if (!w || !h) return { width: null, height: null, scaled: false };
    if (!limit || h <= limit) return { width: w, height: h, scaled: false };
    const scale = limit / h;
    return { width: even(w * scale), height: even(limit), scaled: true };
  }

  function sanitizeOutputName(fileName, extension) {
    const base = String(fileName || '').replace(/\.[^.]+$/, '');
    const clean = base.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim();
    const safe = Array.from(clean).slice(0, 60).join('') || '视频';
    const ext = String(extension || 'mp4').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'mp4';
    return `${safe}-转换.${ext}`;
  }

  function formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value < 0) return '—';
    if (value < 1024) return `${Math.round(value)} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const pad = (value) => String(value).padStart(2, '0');
    const hours = Math.floor(total / 3600); const minutes = Math.floor((total % 3600) / 60); const secs = total % 60;
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
  }

  function formatSpeed(bytesPerSecond) { const value = Number(bytesPerSecond); return Number.isFinite(value) && value > 0 ? `${formatBytes(value)}/s` : '—'; }

  function progressPercent(value) {
    const ratio = Number(value);
    if (!Number.isFinite(ratio)) return 0;
    return clamp(Math.round(ratio * 100), 0, 100);
  }

  function planConversion(options) {
    const settings = options || {};
    const target = OUTPUT_TARGETS.find((item) => item.id === settings.target) || OUTPUT_TARGETS[0];
    const preset = PRESETS.find((item) => item.id === settings.preset) || PRESETS[1];
    const advanced = settings.advanced || {};
    const source = settings.source || {};
    const codecs = settings.codecs || {};
    const keepAudio = advanced.removeAudio !== true && source.hasAudio !== false;
    const plan = { target: target.id, extension: target.extension, mimeType: target.mimeType, copy: {}, video: null, audio: null };
    if (preset.remux) {
      if (!keepAudio) plan.audio = { discard: true };
      return plan;
    }
    const dimension = resolveDimension(source.width, source.height, advanced.maxHeight);
    plan.copy = false;
    plan.video = { codec: codecs.video || target.videoCodec, quality: preset.quality, forceTranscode: true };
    if (dimension.scaled) { plan.video.width = dimension.width; plan.video.height = dimension.height; }
    const frameRate = toPositive(advanced.frameRate);
    if (frameRate) plan.video.frameRate = frameRate;
    plan.audio = keepAudio ? { codec: codecs.audio || target.audioCodec, quality: preset.audioQuality || 'medium', forceTranscode: true } : { discard: true };
    return plan;
  }

  function summarizeSupport(state) {
    const env = state || {};
    if (!env.webCodecs) return { ok: false, reason: '当前浏览器缺少 WebCodecs 支持，请使用最新版 Chrome、Edge、Firefox 或 Safari。' };
    if (env.canDecodeVideo === false) return { ok: false, reason: '当前浏览器无法解码这个视频的编码，请改用其他文件或更新浏览器。' };
    if (env.canEncodeVideo === false) return { ok: false, reason: '当前浏览器无法编码所选目标格式的视频，请尝试切换目标格式。' };
    return { ok: true, reason: '' };
  }

  function discardReasonText(reason) {
    const texts = {
      discarded_by_user: '按设置丢弃',
      max_track_count_reached: '超出输出格式可容纳的轨道数',
      max_track_count_of_type_reached: '目标格式不支持该轨道类型',
      unknown_source_codec: '无法识别源编码',
      undecodable_source_codec: '当前浏览器无法解码源编码',
      no_encodable_target_codec: '当前浏览器没有可用的目标编码器',
      cannot_copy: '无法直接复制，需要重新编码'
    };
    return texts[reason] || '未知原因';
  }

  const api = {
    OUTPUT_TARGETS, PRESETS, CODEC_CANDIDATES, QUALITY_BPP, codecCandidates, codecLabel,
    estimateBitrate, estimateAudioBitrate, estimateOutputSize, resolveDimension, sanitizeOutputName,
    formatBytes, formatDuration, formatSpeed, progressPercent, planConversion, summarizeSupport, discardReasonText
  };
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;

  const elements = Object.fromEntries([
    'support-status', 'dropZone', 'chooseFileBtn', 'fileInput', 'fileInfo', 'infoName', 'infoSize', 'infoDuration',
    'infoResolution', 'infoVideo', 'infoAudio', 'source-status', 'targetFormat', 'preset', 'maxHeight', 'frameRate',
    'removeAudio', 'plan-summary', 'convertBtn', 'cancelBtn', 'resetBtn', 'progressWrap', 'progressBar', 'progressText',
    'progressDetail', 'status', 'resultBox'
  ].map((id) => [id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), document.getElementById(id)]));

  const state = { input: null, output: null, conversion: null, file: null, source: null, codecs: { video: null, audio: null }, outputUrl: '', running: false, timer: 0 };

  function setStatus(node, message, kind = '') { if (!node) return; node.textContent = message; node.dataset.kind = kind; }
  function setProgress(percent, detail) {
    elements.progressBar.value = percent;
    elements.progressText.textContent = `${percent}%`;
    elements.progressDetail.textContent = detail || '';
  }
  function revokeOutput() { if (state.outputUrl) { URL.revokeObjectURL(state.outputUrl); state.outputUrl = ''; } }

  function webCodecsAvailable() { return typeof root.VideoEncoder !== 'undefined' && typeof root.VideoDecoder !== 'undefined' && typeof root.AudioEncoder !== 'undefined' && typeof root.AudioDecoder !== 'undefined'; }

  function resetResult() {
    elements.resultBox.replaceChildren(Object.assign(document.createElement('p'), { className: 'muted result-empty', textContent: '转换完成后，这里会显示体积对比、预览和下载按钮。' }));
  }

  function resetAll(message = '') {
    revokeOutput();
    state.input = null; state.output = null; state.conversion = null; state.file = null; state.source = null; state.codecs = { video: null, audio: null }; state.running = false;
    elements.fileInput.value = '';
    elements.fileInfo.hidden = true;
    elements.convertBtn.disabled = true;
    elements.resetBtn.disabled = true;
    elements.cancelBtn.hidden = true;
    elements.progressWrap.hidden = true;
    setProgress(0, '');
    setStatus(elements.sourceStatus, '');
    setStatus(elements.status, message);
    elements.planSummary.textContent = '';
    resetResult();
    refreshSupport();
  }

  function refreshSupport() {
    if (!webCodecsAvailable()) { setStatus(elements.supportStatus, '当前浏览器不支持 WebCodecs，无法在本地转换视频，请使用最新版 Chrome、Edge、Firefox 或 Safari。', 'error'); return false; }
    setStatus(elements.supportStatus, '');
    return true;
  }

  function readTrackInfo(track, type) {
    return Promise.resolve()
      .then(() => track.getCodec())
      .then((codec) => ({ codec, track, type }))
      .catch(() => ({ codec: null, track, type }));
  }

  async function loadFile(file) {
    if (!refreshSupport()) return;
    if (!file) return;
    resetAll();
    state.file = file;
    setStatus(elements.sourceStatus, '正在读取视频信息…');
    try {
      const input = new root.Mediabunny.Input({ formats: root.Mediabunny.ALL_FORMATS, source: new root.Mediabunny.BlobSource(file) });
      const videoTracks = await input.getVideoTracks();
      const audioTracks = await input.getAudioTracks();
      if (!videoTracks.length) throw new Error('这个文件里没有视频轨道');
      const videoTrack = videoTracks[0];
      const audioTrack = audioTracks[0] || null;
      const width = await videoTrack.getDisplayWidth();
      const height = await videoTrack.getDisplayHeight();
      const codec = await videoTrack.getCodec();
      const duration = await input.computeDuration();
      let frameRate = 0; let bitrate = 0;
      try { const stats = await videoTrack.computePacketStats(120); frameRate = stats.averagePacketRate || 0; bitrate = stats.averageBitrate || 0; } catch { /* 统计失败不影响主流程 */ }
      const audioCodec = audioTrack ? await audioTrack.getCodec() : null;
      let audioChannels = 0; let audioSampleRate = 0;
      if (audioTrack && typeof audioTrack.getNumberOfChannels === 'function') { try { audioChannels = await audioTrack.getNumberOfChannels(); } catch { /* 忽略 */ } }
      if (audioTrack && typeof audioTrack.getSampleRate === 'function') { try { audioSampleRate = await audioTrack.getSampleRate(); } catch { /* 忽略 */ } }
      state.input = input;
      state.source = { width, height, videoCodec: codec, audioCodec, hasAudio: Boolean(audioTrack), duration, frameRate, bitrate, audioChannels, audioSampleRate, size: file.size };
      renderFileInfo(file, state.source);
      setStatus(elements.sourceStatus, '');
      if (file.size > 1024 * 1024 * 1024) setStatus(elements.sourceStatus, '文件较大（超过约 1 GB），转换可能因浏览器内存不足而失败，建议先压缩或改用较小视频。', 'warning');
      elements.resetBtn.disabled = false;
      await refreshCapabilities();
    } catch (error) {
      state.input = null; state.source = null;
      elements.fileInfo.hidden = true;
      elements.convertBtn.disabled = true;
      setStatus(elements.sourceStatus, `无法读取这个视频：${error.message || '格式不受支持'}。浏览器可处理 MP4、MOV、WebM、MKV、MPEG-TS 等，AVI、WMV、FLV 暂不支持。`, 'error');
    }
  }

  function renderFileInfo(file, source) {
    elements.infoName.textContent = file.name;
    elements.infoSize.textContent = formatBytes(file.size);
    elements.infoDuration.textContent = source.duration ? formatDuration(source.duration) : '—';
    elements.infoResolution.textContent = source.width && source.height ? `${source.width}×${source.height}` : '—';
    elements.infoVideo.textContent = codecLabel(source.videoCodec) + (source.frameRate ? ` · ${Math.round(source.frameRate)} 帧/秒` : '');
    elements.infoAudio.textContent = source.hasAudio ? codecLabel(source.audioCodec) : '无';
    elements.fileInfo.hidden = false;
  }

  function currentSettings() {
    return {
      target: elements.targetFormat.value,
      preset: elements.preset.value,
      advanced: { maxHeight: elements.maxHeight.value, frameRate: elements.frameRate.value, removeAudio: elements.removeAudio.checked }
    };
  }

  async function refreshCapabilities() {
    if (!state.source || !state.input) return;
    const settings = currentSettings();
    const candidates = codecCandidates(settings.target);
    const dimension = resolveDimension(state.source.width, state.source.height, settings.advanced.maxHeight);
    const width = dimension.width || state.source.width; const height = dimension.height || state.source.height;
    state.codecs = { video: null, audio: null };
    try {
      state.codecs.video = await root.Mediabunny.getFirstEncodableVideoCodec(candidates.video, { width, height });
      const keepAudio = !settings.advanced.removeAudio && state.source.hasAudio;
      if (keepAudio) state.codecs.audio = await root.Mediabunny.getFirstEncodableAudioCodec(candidates.audio, { numberOfChannels: state.source.audioChannels || undefined, sampleRate: state.source.audioSampleRate || undefined });
    } catch { /* 检测失败时保持未检测状态 */ }
    const isRemux = settings.preset === 'remux';
    let canDecode = true;
    if (!isRemux && state.source.videoCodec) {
      try { canDecode = (await root.Mediabunny.canDecodeVideo(state.source.videoCodec)) !== false; } catch { canDecode = true; }
    }
    const support = summarizeSupport({ webCodecs: webCodecsAvailable(), canDecodeVideo: canDecode, canEncodeVideo: isRemux ? true : Boolean(state.codecs.video) });
    const encoderMissing = !isRemux && !state.codecs.video;
    elements.convertBtn.disabled = !support.ok || state.running;
    if (!support.ok) setStatus(elements.status, support.reason, 'error');
    else if (encoderMissing) setStatus(elements.status, '没有找到可用的目标编码器，请尝试切换目标格式。', 'error');
    else setStatus(elements.status, '');
    renderPlanSummary(settings, support.ok && !encoderMissing);
  }

  function renderPlanSummary(settings, ready) {
    if (!state.source) { elements.planSummary.textContent = ''; return; }
    const target = OUTPUT_TARGETS.find((item) => item.id === settings.target) || OUTPUT_TARGETS[0];
    const preset = PRESETS.find((item) => item.id === settings.preset) || PRESETS[1];
    if (preset.remux) { elements.planSummary.textContent = `输出：${target.name} · 优先直接复制原有编码，若目标格式不兼容则自动转码。`; return; }
    const dimension = resolveDimension(state.source.width, state.source.height, settings.advanced.maxHeight);
    const width = dimension.width || state.source.width; const height = dimension.height || state.source.height;
    const fps = toPositive(settings.advanced.frameRate) || state.source.frameRate || 30;
    const videoBitrate = estimateBitrate(width, height, fps, preset.quality);
    const keepAudio = !settings.advanced.removeAudio && state.source.hasAudio;
    const audioBitrate = keepAudio ? estimateAudioBitrate(preset.audioQuality) : 0;
    const size = estimateOutputSize(state.source.duration, videoBitrate, audioBitrate);
    const parts = [`输出：${target.name} · ${preset.name} · ${width}×${height}`, `视频约 ${(videoBitrate / 1000000).toFixed(1)} Mbps`];
    if (keepAudio) parts.push('保留声音');
    if (size) parts.push(`预计体积约 ${formatBytes(size)}`);
    elements.planSummary.textContent = parts.join(' · ') + (ready ? '' : '（等待能力检测）');
  }

  function toQuality(level) {
    const Quality = root.Mediabunny && root.Mediabunny.Quality;
    return Quality ? new Quality(level) : level;
  }

  function buildConversionOptions(plan) {
    const options = { input: state.input, output: state.output, tracks: 'primary', showWarnings: false, copy: plan.copy };
    if (plan.video) { options.video = Object.assign({}, plan.video); if (options.video.quality) options.video.quality = toQuality(options.video.quality); }
    if (plan.audio) { options.audio = Object.assign({}, plan.audio); if (options.audio.quality) options.audio.quality = toQuality(options.audio.quality); }
    return options;
  }

  async function startConversion() {
    if (state.running || !state.source || !state.input) return;
    const settings = currentSettings();
    const plan = planConversion({ target: settings.target, preset: settings.preset, advanced: settings.advanced, source: state.source, codecs: state.codecs });
    state.running = true;
    elements.convertBtn.disabled = true;
    elements.cancelBtn.hidden = false;
    elements.progressWrap.hidden = false;
    setProgress(0, '');
    setStatus(elements.status, '正在准备转换…');
    resetResult();
    revokeOutput();
    try {
      const format = plan.target === 'webm' ? new root.Mediabunny.WebMOutputFormat() : new root.Mediabunny.Mp4OutputFormat();
      const output = new root.Mediabunny.Output({ format, target: new root.Mediabunny.BufferTarget() });
      state.output = output;
      const conversion = await root.Mediabunny.Conversion.init(buildConversionOptions(plan));
      state.conversion = conversion;
      if (!conversion.isValid) {
        const reasons = (conversion.discardedTracks || []).map((item) => discardReasonText(item.reason)).filter(Boolean);
        throw new Error(`无法生成目标格式${reasons.length ? `：${reasons.join('；')}` : ''}`);
      }
      const startedAt = (root.performance && root.performance.now ? root.performance.now() : Date.now());
      const clock = () => ((root.performance && root.performance.now ? root.performance.now() : Date.now()) - startedAt) / 1000;
      conversion.onProgress = (progress, processedTime) => {
        const percent = progressPercent(progress);
        const elapsed = clock();
        const speed = elapsed > 0 ? processedTime / elapsed : 0;
        const remaining = speed > 0.01 && state.source.duration ? Math.max(0, (state.source.duration - processedTime) / speed) : 0;
        const detail = `${formatDuration(processedTime)} / ${formatDuration(state.source.duration)}` + (speed > 0.01 ? ` · 剩约 ${formatDuration(remaining)}` : '');
        setProgress(percent, detail);
      };
      setStatus(elements.status, '正在转换…');
      await conversion.execute();
      const buffer = output.target.buffer;
      if (!buffer) throw new Error('没有生成输出数据');
      const mimeType = (await output.getMimeType().catch(() => plan.mimeType)) || plan.mimeType;
      const blob = new Blob([buffer], { type: mimeType });
      setProgress(100, `${formatDuration(state.source.duration)} / ${formatDuration(state.source.duration)}`);
      setStatus(elements.status, '转换完成。', 'success');
      renderResult(blob, plan);
      root.OpenEduAnalytics?.toolUse?.('video-converter');
    } catch (error) {
      const canceled = /cancel/i.test(error && error.name ? error.name : '') || /cancel/i.test(error && error.message ? error.message : '');
      if (canceled) setStatus(elements.status, '已取消转换。', 'warning');
      else setStatus(elements.status, `转换失败：${error.message || '未知错误'}`, 'error');
      elements.progressWrap.hidden = true;
    } finally {
      state.running = false;
      elements.cancelBtn.hidden = true;
      elements.convertBtn.disabled = !state.source;
    }
  }

  function renderResult(blob, plan) {
    revokeOutput();
    state.outputUrl = URL.createObjectURL(blob);
    const sourceSize = state.source && state.source.size ? state.source.size : 0;
    const delta = sourceSize ? Math.round((1 - blob.size / sourceSize) * 100) : 0;
    const summary = document.createElement('p');
    summary.className = 'result-summary';
    summary.textContent = sourceSize ? `原文件 ${formatBytes(sourceSize)} → 输出 ${formatBytes(blob.size)}` + (delta > 0 ? `，减小约 ${delta}%` : delta < 0 ? `，增大约 ${Math.abs(delta)}%` : '，体积基本不变') : `输出 ${formatBytes(blob.size)}`;
    const preview = document.createElement('video');
    preview.className = 'result-preview';
    preview.controls = true;
    preview.playsInline = true;
    preview.src = state.outputUrl;
    const actions = document.createElement('div');
    actions.className = 'result-actions';
    const download = document.createElement('a');
    download.className = 'button';
    download.href = state.outputUrl;
    download.download = sanitizeOutputName(state.file ? state.file.name : '视频', plan.extension);
    download.textContent = '下载转换后的视频';
    actions.append(download);
    elements.resultBox.replaceChildren(summary, preview, actions);
  }

  async function cancelConversion() {
    if (!state.conversion || !state.running) return;
    setStatus(elements.status, '正在取消…');
    try { await state.conversion.cancel(); } catch { /* 忽略取消异常 */ }
  }

  if (!refreshSupport()) { elements.chooseFileBtn.disabled = true; elements.convertBtn.disabled = true; }
  elements.chooseFileBtn.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', (event) => { const file = event.target.files && event.target.files[0]; if (file) loadFile(file); event.target.value = ''; });
  elements.dropZone.addEventListener('dragover', (event) => { event.preventDefault(); elements.dropZone.classList.add('is-dragover'); });
  elements.dropZone.addEventListener('dragleave', () => elements.dropZone.classList.remove('is-dragover'));
  elements.dropZone.addEventListener('drop', (event) => { event.preventDefault(); elements.dropZone.classList.remove('is-dragover'); const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]; if (file) loadFile(file); });
  elements.convertBtn.addEventListener('click', startConversion);
  elements.cancelBtn.addEventListener('click', cancelConversion);
  elements.resetBtn.addEventListener('click', () => resetAll('已重置。'));
  for (const id of ['targetFormat', 'preset', 'maxHeight', 'frameRate', 'removeAudio']) elements[id].addEventListener('change', () => { if (state.source) refreshCapabilities(); });
  resetAll();
})(typeof globalThis !== 'undefined' ? globalThis : this);