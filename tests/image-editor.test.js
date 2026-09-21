const test = require('node:test');
const assert = require('node:assert/strict');
const img = require('../tools/image-editor/script.js');

test('按容器尺寸等比缩放且不放大', () => {
  assert.deepEqual(img.fitDimensions(400, 300, 200, 200), { width: 200, height: 150, scale: 0.5 });
  assert.deepEqual(img.fitDimensions(100, 100, 200, 200), { width: 100, height: 100, scale: 1 });
});

test('调色参数生成 CSS 滤镜字符串', () => {
  assert.equal(img.buildFilter({ brightness: 1, contrast: 1, saturate: 1, hue: 0, grayscale: 0, sepia: 0 }), 'none');
  assert.equal(img.buildFilter({ brightness: 1.2, contrast: 1, saturate: 1, hue: 0, grayscale: 0, sepia: 0 }), 'brightness(1.2)');
  assert.equal(
    img.buildFilter({ brightness: 1.2, contrast: 0.8, saturate: 1.5, hue: 30, grayscale: 20, sepia: 10 }),
    'brightness(1.2) contrast(0.8) saturate(1.5) hue-rotate(30deg) grayscale(20%) sepia(10%)'
  );
});

test('输出尺寸支持裁切、证件规格与自定义', () => {
  assert.deepEqual(img.resolveOutputSize({ cropWidth: 400, cropHeight: 300, mode: 'crop' }), { width: 400, height: 300 });
  assert.deepEqual(img.resolveOutputSize({ cropWidth: 400, cropHeight: 300, mode: 'spec', specPx: [295, 413] }), { width: 295, height: 413 });
  assert.deepEqual(img.resolveOutputSize({ cropWidth: 400, cropHeight: 300, mode: 'custom', customWidth: 800, customHeight: 100, keepRatio: true }), { width: 800, height: 600 });
  assert.deepEqual(img.resolveOutputSize({ cropWidth: 400, cropHeight: 300, mode: 'custom', customWidth: 0, customHeight: 600, keepRatio: true }), { width: 800, height: 600 });
  assert.deepEqual(img.resolveOutputSize({ cropWidth: 400, cropHeight: 300, mode: 'custom', customWidth: 640, customHeight: 480, keepRatio: false }), { width: 640, height: 480 });
});

test('裁切约束与缩放遵守比例和边界', () => {
  assert.deepEqual(img.constrainCrop({ x: 10, y: 10, width: 80, height: 40 }, 1, { width: 100, height: 100 }), { x: 10, y: 10, width: 40, height: 40 });
  assert.deepEqual(img.constrainCrop({ x: 90, y: 90, width: 40, height: 40 }, null, { width: 100, height: 100 }), { x: 60, y: 60, width: 40, height: 40 });
  assert.deepEqual(img.resizeCrop({ x: 0, y: 0, width: 50, height: 50 }, 'se', 10, 10, null, { width: 100, height: 100 }), { x: 0, y: 0, width: 60, height: 60 });
  assert.deepEqual(img.resizeCrop({ x: 0, y: 0, width: 50, height: 50 }, 'se', 10, 10, 1, { width: 100, height: 100 }), { x: 0, y: 0, width: 60, height: 60 });
  assert.deepEqual(img.resizeCrop({ x: 0, y: 0, width: 50, height: 50 }, 'e', 50, 0, 1, { width: 100, height: 100 }), { x: 0, y: 0, width: 75, height: 75 });
  assert.deepEqual(img.resizeCrop({ x: 0, y: 0, width: 100, height: 50 }, 's', 0, 50, 2, { width: 200, height: 200 }), { x: 0, y: 0, width: 150, height: 75 });
});

test('文件大小与扩展名格式化', () => {
  assert.equal(img.formatBytes(0), '0 B');
  assert.equal(img.formatBytes(2048), '2.0 KB');
  assert.equal(img.formatBytes(1048576), '1.00 MB');
  assert.equal(img.extensionFor('image/jpeg'), 'jpg');
  assert.equal(img.extensionFor('image/webp'), 'webp');
  assert.equal(img.extensionFor('image/png'), 'png');
  assert.ok(img.STANDARD_SIZES.some((size) => size.name.includes('一寸')));
  assert.ok(img.STANDARD_SIZES.some((size) => size.name.includes('二寸')));
});
