const test = require('node:test');
const assert = require('node:assert/strict');

globalThis.PDFLib = require('../tools/pdf-toolkit/vendor/pdf-lib.min.js');
const pdf = require('../tools/pdf-toolkit/script.js');

test('页码范围解析支持区间、逗号、乱序与越界校验', () => {
  assert.deepEqual(pdf.parsePageRanges('1-3,5', 5), [0, 1, 2, 4]);
  assert.deepEqual(pdf.parsePageRanges('3-1', 5), [0, 1, 2]);
  assert.deepEqual(pdf.parsePageRanges('2, 2, 4', 5), [1, 3]);
  assert.throws(() => pdf.parsePageRanges('', 5), /请输入/);
  assert.throws(() => pdf.parsePageRanges('1-9', 5), /超出范围/);
  assert.throws(() => pdf.parsePageRanges('a', 5), /无法识别/);
});

test('颜色与文件大小辅助函数', () => {
  assert.deepEqual(pdf.hexToRgb('#ff0000'), [1, 0, 0]);
  assert.deepEqual(pdf.hexToRgb('#000000'), [0, 0, 0]);
  assert.equal(pdf.formatBytes(0), '0 B');
  assert.equal(pdf.formatBytes(2048), '2.0 KB');
});

test('按页面列表合并与提取 PDF 生成正确的页数', async () => {
  const { PDFDocument } = globalThis.PDFLib;
  const first = await PDFDocument.create(); first.addPage();
  const second = await PDFDocument.create(); second.addPage(); second.addPage();
  const sources = { a: await first.save(), b: await second.save() };
  const merged = await pdf.mergePageList([{ fileId: 'a', pageIndex: 0 }, { fileId: 'b', pageIndex: 0 }, { fileId: 'b', pageIndex: 1 }], (id) => sources[id]);
  const mergedDoc = await PDFDocument.load(merged);
  assert.equal(mergedDoc.getPageCount(), 3);
  const extracted = await pdf.extractPages(merged, [0, 2]);
  const extractedDoc = await PDFDocument.load(extracted);
  assert.equal(extractedDoc.getPageCount(), 2);
});

test('拆分生成每页一个 PDF', async () => {
  const { PDFDocument } = globalThis.PDFLib;
  const doc = await PDFDocument.create(); doc.addPage(); doc.addPage(); doc.addPage();
  const pages = await pdf.splitToPages(await doc.save());
  assert.equal(pages.length, 3);
  for (const bytes of pages) { const pageDoc = await PDFDocument.load(bytes); assert.equal(pageDoc.getPageCount(), 1); }
});

test('ZIP 打包输出以 PK 开头并包含文件名', () => {
  const zip = pdf.zipStore([{ name: 'page-001.pdf', data: new Uint8Array([1, 2, 3]) }, { name: 'page-002.pdf', data: new Uint8Array([4, 5]) }]);
  assert.equal(zip[0], 0x50);
  assert.equal(zip[1], 0x4b);
  assert.ok(Buffer.from(zip).toString('latin1').includes('page-001.pdf'));
});
