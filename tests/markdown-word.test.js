const test = require('node:test');
const assert = require('node:assert/strict');
const md = require('../tools/markdown-to-word/script.js');

test('Markdown 解析出标题、列表、表格、公式与引用', () => {
  const types = md.parseMarkdown(md.DEFAULT_MARKDOWN).map((block) => block.type);
  assert.ok(types.includes('heading'));
  assert.ok(types.includes('list'));
  assert.ok(types.includes('table'));
  assert.ok(types.includes('math'));
  assert.ok(types.includes('blockquote'));
});

test('Markdown 渲染为 HTML 并包含 MathML 公式', () => {
  const html = md.renderMarkdownHtml(md.DEFAULT_MARKDOWN);
  assert.ok(html.includes('<h1>'));
  assert.ok(html.includes('<ul>'));
  assert.ok(html.includes('<table>'));
  assert.ok(html.includes('<math'));
});

test('兼容大模型常见的公式定界符与数学环境', () => {
  const sample = ['行内 \\(a^2\\) 与 $x_1$', '', '\\[ E = mc^2 \\]', '', '\\begin{equation}', '\\frac{1}{3}', '\\end{equation}', '', '\\begin{align}', 'a &= b \\\\', 'c &= d', '\\end{align}'].join('\n');
  const mathBlocks = md.parseMarkdown(sample).filter((block) => block.type === 'math');
  assert.ok(mathBlocks.length >= 3);
  assert.ok(md.parseMarkdown(sample).find((block) => block.type === 'paragraph').inline.some((node) => node.type === 'math'));
  assert.ok(md.latexToOmml('\\begin{align}a &= b \\\\ c &= d\\end{align}').includes('<m:m>'));
  assert.ok(md.renderMarkdownHtml(sample).includes('<math'));
});

test('LaTeX 公式转换为 MathML 与 OMML', () => {
  const fraction = md.latexToMathML('\\frac{a}{b}');
  assert.ok(fraction.includes('<mfrac>'));
  assert.ok(fraction.includes('<mi>a</mi>'));
  assert.ok(md.latexToMathML('\\sqrt{\\pi}').includes('<msqrt>'));
  assert.ok(md.latexToMathML('x_1^2').includes('<msubsup>'));
  assert.ok(md.latexToOmml('x^2').includes('<m:sSup>'));
  assert.ok(md.latexToOmml('\\sum_{i=1}^{n} i').includes('<m:nary>'));
  assert.ok(md.latexToOmml('\\frac{1}{n}').includes('<m:f>'));
  assert.ok(md.latexToOmml('\\hat{y}').includes('<m:acc>'));
});

test('生成的 docx 是合法 ZIP 且包含公式与表格', () => {
  const bytes = md.buildDocx(md.DEFAULT_MARKDOWN);
  assert.ok(bytes instanceof Uint8Array);
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const text = Buffer.from(bytes).toString('latin1');
  assert.ok(text.includes('word/document.xml'));
  const xml = Buffer.from(bytes).toString('utf8');
  assert.ok(xml.includes('<m:oMath>'));
  assert.ok(xml.includes('<m:oMathPara>'));
  assert.ok(xml.includes('<w:tbl>'));
});

test('CRC32 与 UTF-8 编码正确', () => {
  assert.equal(md.crc32(md.utf8Bytes('123456789')), 0xcbf43926);
  assert.deepEqual(md.utf8Bytes('中'), [0xe4, 0xb8, 0xad]);
});
