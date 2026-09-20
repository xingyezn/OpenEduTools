const test = require('node:test');
const assert = require('node:assert/strict');
const handwriting = require('../tools/handwriting-digits/script.js');

test('二值化按平均灰度阈值转换像素', () => {
  assert.deepEqual(Array.from(handwriting.binarizePixels([0, 0, 0, 255, 255, 255, 255, 255, 200, 200, 200, 255])), [1, 0, 0]);
  assert.deepEqual(Array.from(handwriting.binarizePixels([128, 128, 128, 255])), [0]);
  assert.deepEqual(Array.from(handwriting.binarizePixels([100, 100, 100, 255], 120)), [1]);
});

test('二值网格与纯文本输出保留行列结构', () => {
  assert.equal(handwriting.formatBinaryGrid(new Uint8Array([1, 0, 1, 0]), 2, 2), '10\n10');
  assert.equal(handwriting.binaryToText([1, 0, 1, 1]), '1011');
});

test('文件名净化并生成稳定样本名', () => {
  assert.equal(handwriting.sanitizeFilenamePart(' 7 班 03 '), '7-班-03');
  assert.equal(handwriting.sanitizeFilenamePart('a/b:c'), 'a-b-c');
  assert.equal(handwriting.sanitizeFilenamePart(''), 'student');
  assert.equal(handwriting.buildSampleFilename('001', 5, 2), '001-005-2');
  assert.equal(handwriting.buildSampleFilename('', 1, 9), 'student-001-9');
});
