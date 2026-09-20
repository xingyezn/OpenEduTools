const test = require('node:test');
const assert = require('node:assert/strict');
const toolPage = require('../js/tool-page.js');

const EXPECTED_MATRIX = [
  '1111111000011100101111111',
  '1000001000100111101000001',
  '1011101011010010001011101',
  '1011101010000111001011101',
  '1011101011100100101011101',
  '1000001010010011001000001',
  '1111111010101010101111111',
  '0000000010000010100000000',
  '1011111000001000001111100',
  '1011010010110100010100010',
  '1101001011000111100101011',
  '1001000010110101101100001',
  '1101101000011011011010111',
  '1101000010100000100101010',
  '1011111100111001001111011',
  '1001100100010011111110001',
  '1111111011110000111110100',
  '0000000011001111100011000',
  '1111111000000110101010111',
  '1000001011001100100011010',
  '1011101011101011111110101',
  '1011101010000001011011111',
  '1011101011111001000001101',
  '1000001000010010110111001',
  '1111111011010000011111111'
];

test('二维码按字节模式生成稳定矩阵并可选版本', () => {
  const qr = toolPage.encodeQr('https://example.com', 'M');
  assert.equal(qr.version, 2);
  assert.equal(qr.size, 25);
  assert.ok(qr.mask >= 0 && qr.mask < 8);
  const matrix = qr.modules.map((row) => row.map((cell) => (cell ? '1' : '0')).join('')).join('\n');
  assert.equal(matrix, EXPECTED_MATRIX.join('\n'));
});

test('二维码对超长内容返回空并正确编码 UTF-8', () => {
  assert.equal(toolPage.encodeQr('a'.repeat(400), 'M'), null);
  assert.deepEqual(toolPage.utf8Bytes('A'), [65]);
  assert.deepEqual(toolPage.utf8Bytes('中'), [0xe4, 0xb8, 0xad]);
});

test('复制文案包含平台名、工具描述和网址', () => {
  const tool = toolPage.buildShareText({ title: '课堂噪音计', description: '用麦克风实时估算教室音量。', url: 'https://example.com/tools/noise-meter/index.html' });
  assert.equal(tool, 'OpenEduTools · 课堂噪音计\n用麦克风实时估算教室音量。\nhttps://example.com/tools/noise-meter/index.html');
  const site = toolPage.buildShareText({ title: 'OpenEduTools · 教师微工具', description: '免费开源。', url: 'https://example.com/' });
  assert.equal(site, 'OpenEduTools · 教师微工具\n免费开源。\nhttps://example.com/');
  const noDescription = toolPage.buildShareText({ title: '全屏时钟', description: '', url: 'https://example.com/x' });
  assert.equal(noDescription, 'OpenEduTools · 全屏时钟\nhttps://example.com/x');
});

test('分享链接对网址和标题进行编码', () => {
  const links = toolPage.buildShareLinks('https://example.com/a b', '标题 & 测试');
  assert.ok(links.weibo.startsWith('https://service.weibo.com/share/share.php?url='));
  assert.ok(links.weibo.includes(encodeURIComponent('https://example.com/a b')));
  assert.ok(links.weibo.includes(encodeURIComponent('标题 & 测试')));
  assert.ok(links.qzone.includes('sns.qzone.qq.com'));
  assert.ok(links.qq.includes('connect.qq.com'));
  assert.ok(links.email.startsWith('mailto:?subject='));
  assert.ok(links.x.startsWith('https://twitter.com/intent/tweet?'));
  assert.ok(links.facebook.includes('facebook.com/sharer'));
  assert.ok(links.linkedin.includes('linkedin.com/sharing'));
  assert.ok(links.telegram.startsWith('https://t.me/share/url?'));
  assert.ok(links.whatsapp.includes('api.whatsapp.com/send'));
  assert.ok(links.reddit.includes('reddit.com/submit'));
});
