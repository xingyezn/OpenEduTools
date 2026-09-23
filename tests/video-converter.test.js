const test = require('node:test');
const assert = require('node:assert/strict');
const vc = require('../tools/video-converter/script.js');

test('codecCandidates 按目标格式返回候选且不共享数组', () => {
  assert.equal(vc.codecCandidates('webm').video[0], 'vp9');
  assert.equal(vc.codecCandidates('webm').audio[0], 'opus');
  assert.equal(vc.codecCandidates('mp4').video[0], 'avc');
  assert.equal(vc.codecCandidates('unknown').video[0], 'avc');
  const copy = vc.codecCandidates('mp4');
  copy.video.push('x');
  assert.equal(vc.codecCandidates('mp4').video.length, 3);
});

test('estimateBitrate 随质量和帧率单调变化', () => {
  assert.equal(vc.estimateBitrate(0, 1080, 30, 'medium'), 0);
  const low = vc.estimateBitrate(1920, 1080, 30, 'low');
  const medium = vc.estimateBitrate(1920, 1080, 30, 'medium');
  const high = vc.estimateBitrate(1920, 1080, 30, 'high');
  assert.equal(medium, 5287680);
  assert.ok(low < medium && medium < high);
  assert.ok(vc.estimateBitrate(1920, 1080, 60, 'medium') > medium);
  assert.equal(vc.estimateAudioBitrate('high'), 128000);
  assert.equal(vc.estimateAudioBitrate('unknown'), 96000);
});

test('estimateOutputSize 按时长与码率计算', () => {
  assert.equal(vc.estimateOutputSize(60, 5287680, 96000), 40377600);
  assert.equal(vc.estimateOutputSize(0, 1000000, 0), 0);
  assert.equal(vc.estimateOutputSize(10, 0, 0), 0);
});

test('resolveDimension 只在超过上限时缩小且保持偶数', () => {
  assert.deepEqual(vc.resolveDimension(1920, 1080, 720), { width: 1280, height: 720, scaled: true });
  assert.deepEqual(vc.resolveDimension(1280, 720, 1080), { width: 1280, height: 720, scaled: false });
  assert.deepEqual(vc.resolveDimension(1920, 1080, ''), { width: 1920, height: 1080, scaled: false });
  assert.deepEqual(vc.resolveDimension(0, 0, 720), { width: null, height: null, scaled: false });
  assert.deepEqual(vc.resolveDimension(1000, 750, 721), { width: 960, height: 720, scaled: true });
});

test('sanitizeOutputName 去掉扩展名与非法字符', () => {
  assert.equal(vc.sanitizeOutputName('课堂 记录/01.mp4', 'mp4'), '课堂 记录01-转换.mp4');
  assert.equal(vc.sanitizeOutputName('a<b>c:d.mp4', 'mp4'), 'abcd-转换.mp4');
  assert.equal(vc.sanitizeOutputName('', 'webm'), '视频-转换.webm');
  assert.equal(vc.sanitizeOutputName('clip.MOV', 'WEBM'), 'clip-转换.webm');
});

test('格式化函数处理边界', () => {
  assert.equal(vc.formatBytes(0), '0 B');
  assert.equal(vc.formatBytes(2048), '2.0 KB');
  assert.equal(vc.formatBytes(1048576), '1.0 MB');
  assert.equal(vc.formatBytes(-1), '—');
  assert.equal(vc.formatDuration(0), '0:00');
  assert.equal(vc.formatDuration(59), '0:59');
  assert.equal(vc.formatDuration(3600), '1:00:00');
  assert.equal(vc.formatDuration(3661), '1:01:01');
  assert.equal(vc.formatSpeed(1024), '1.0 KB/s');
  assert.equal(vc.formatSpeed(0), '—');
});

test('progressPercent 归一化并限制在 0-100', () => {
  assert.equal(vc.progressPercent(0.5), 50);
  assert.equal(vc.progressPercent(1), 100);
  assert.equal(vc.progressPercent(1.5), 100);
  assert.equal(vc.progressPercent(0), 0);
  assert.equal(vc.progressPercent(0.333), 33);
  assert.equal(vc.progressPercent('bad'), 0);
});

test('planConversion 为转码预设生成编码配置', () => {
  const plan = vc.planConversion({ target: 'mp4', preset: 'balanced', source: { width: 1920, height: 1080, hasAudio: true }, codecs: { video: 'avc', audio: 'aac' } });
  assert.equal(plan.target, 'mp4');
  assert.equal(plan.copy, false);
  assert.deepEqual(plan.video, { codec: 'avc', quality: 'medium', forceTranscode: true });
  assert.deepEqual(plan.audio, { codec: 'aac', quality: 'medium', forceTranscode: true });
});

test('planConversion 处理 WebM、无音轨与高级选项', () => {
  const webm = vc.planConversion({ target: 'webm', preset: 'size', source: { width: 640, height: 360, hasAudio: false } });
  assert.deepEqual(webm.video, { codec: 'vp9', quality: 'low', forceTranscode: true });
  assert.deepEqual(webm.audio, { discard: true });
  const advanced = vc.planConversion({ target: 'mp4', preset: 'balanced', source: { width: 1920, height: 1080, hasAudio: true }, advanced: { maxHeight: '720', frameRate: '30' }, codecs: { video: 'av1', audio: 'aac' } });
  assert.equal(advanced.video.codec, 'av1');
  assert.equal(advanced.video.width, 1280);
  assert.equal(advanced.video.height, 720);
  assert.equal(advanced.video.frameRate, 30);
  const muted = vc.planConversion({ target: 'mp4', preset: 'quality', source: { width: 1280, height: 720, hasAudio: true }, advanced: { removeAudio: true } });
  assert.deepEqual(muted.audio, { discard: true });
});

test('planConversion 的仅换封装保留复制策略', () => {
  const plan = vc.planConversion({ target: 'mp4', preset: 'remux', source: { width: 1920, height: 1080, hasAudio: true } });
  assert.deepEqual(plan.copy, {});
  assert.equal(plan.video, null);
  assert.equal(plan.audio, null);
  const muted = vc.planConversion({ target: 'mp4', preset: 'remux', source: { hasAudio: true }, advanced: { removeAudio: true } });
  assert.deepEqual(muted.audio, { discard: true });
});

test('summarizeSupport 给出可读原因', () => {
  assert.equal(vc.summarizeSupport({ webCodecs: false }).ok, false);
  assert.match(vc.summarizeSupport({ webCodecs: false }).reason, /WebCodecs/);
  assert.equal(vc.summarizeSupport({ webCodecs: true, canDecodeVideo: false }).ok, false);
  assert.match(vc.summarizeSupport({ webCodecs: true, canDecodeVideo: false }).reason, /解码/);
  assert.equal(vc.summarizeSupport({ webCodecs: true, canDecodeVideo: true, canEncodeVideo: false }).ok, false);
  assert.deepEqual(vc.summarizeSupport({ webCodecs: true, canDecodeVideo: true, canEncodeVideo: true }), { ok: true, reason: '' });
});

test('codecLabel 与 discardReasonText 输出中文说明', () => {
  assert.equal(vc.codecLabel('avc'), 'H.264');
  assert.equal(vc.codecLabel('hevc'), 'H.265/HEVC');
  assert.equal(vc.codecLabel('pcm-s16'), 'PCM');
  assert.equal(vc.codecLabel('xyz'), 'XYZ');
  assert.equal(vc.codecLabel(null), '未知');
  assert.match(vc.discardReasonText('undecodable_source_codec'), /无法解码/);
  assert.equal(vc.discardReasonText('something_else'), '未知原因');
});