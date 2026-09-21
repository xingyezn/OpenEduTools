(function (root) {
  'use strict';

  const DEFAULT_MARKDOWN = [
    '# 手写数字识别：从数据到模型',
    '',
    '手写数字识别是机器学习入门的经典任务，通常使用 **MNIST** 数据集进行训练。',
    '',
    '## 一、处理流程',
    '',
    '- 数据采集：收集 0–9 的手写样本',
    '- 数据预处理：缩放到 50×50 并二值化',
    '- 模型训练：使用简单的神经网络',
    '',
    '## 二、评价指标',
    '',
    '| 指标 | 含义 | 目标 |',
    '| --- | --- | --- |',
    '| 准确率 | 预测正确的比例 | ≥ 95% |',
    '| 损失 | 预测误差 | 越小越好 |',
    '| 召回率 | 正类被找回的比例 | ≥ 90% |',
    '',
    '## 三、核心公式',
    '',
    '线性层与激活函数：',
    '',
    '$$',
    'z = W x + b, \\quad a = \\sigma(z)',
    '$$',
    '',
    'Softmax 与交叉熵损失：',
    '',
    '$$',
    'L = -\\frac{1}{N}\\sum_{i=1}^{N}\\sum_{k=1}^{K} y_{i,k}\\log\\left(\\frac{e^{z_{i,k}}}{\\sum_{j=1}^{K} e^{z_{i,j}}}\\right)',
    '$$',
    '',
    '均方误差与高斯积分：',
    '',
    '$$',
    '\\text{MSE} = \\frac{1}{n}\\sum_{i=1}^{n}(y_i - \\hat{y}_i)^2, \\qquad \\int_{-\\infty}^{+\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}',
    '$$',
    '',
    '> 提示：导出 Word 时，公式会转换为可编辑的公式对象。'
  ].join('\n');

  const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω' };
  const SYMBOLS = { cdot: '⋅', times: '×', div: '÷', pm: '±', mp: '∓', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', equiv: '≡', sim: '∼', propto: '∝', to: '→', rightarrow: '→', Rightarrow: '⇒', leftarrow: '←', Leftarrow: '⇐', leftrightarrow: '↔', infty: '∞', partial: '∂', nabla: '∇', in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', supset: '⊃', cup: '∪', cap: '∩', forall: '∀', exists: '∃', emptyset: '∅', dots: '…', ldots: '…', cdots: '⋯', degree: '°', angle: '∠', perp: '⊥', parallel: '∥', star: '⋆', ast: '∗', circ: '∘', bullet: '•', prime: '′' };
  const NARY = { sum: '∑', prod: '∏', int: '∫', oint: '∮', iint: '∬', bigcup: '⋃', bigcap: '⋂' };
  const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'lg', 'exp', 'lim', 'max', 'min', 'sup', 'inf', 'det', 'dim', 'gcd', 'mod']);
  const ACCENT_MATHML = { hat: '^', bar: '‾', vec: '→', dot: '˙', ddot: '¨', tilde: '~' };
  const ACCENT_OMML = { hat: '\u0302', bar: '\u0304', vec: '\u20d7', dot: '\u0307', ddot: '\u0308', tilde: '\u0303' };
  const SPACE_WIDTH = { ',': '0.167em', ';': '0.278em', '!': '-0.167em', ' ': '0.25em', quad: '1em', qquad: '2em' };
  const GREEK_VALUES = new Set(Object.values(GREEK));

  function escapeXml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character])); }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
  function utf8Bytes(value) {
    const bytes = []; const text = String(value);
    for (let index = 0; index < text.length; index += 1) {
      const code = text.codePointAt(index); if (code > 0xffff) index += 1;
      if (code < 0x80) bytes.push(code);
      else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
    return bytes;
  }

  /* ================= LaTeX 解析 ================= */
  function tokenizeLatex(input) {
    const tokens = []; const text = String(input || ''); let index = 0;
    while (index < text.length) {
      const character = text[index];
      if (/\s/.test(character)) { index += 1; continue; }
      if (character === '\\') {
        const match = /^\\([a-zA-Z]+|.)/.exec(text.slice(index));
        if (match) { tokens.push({ type: 'command', name: match[1], start: index, end: index + match[0].length }); index += match[0].length; continue; }
        index += 1; continue;
      }
      if (character === '{' || character === '}' || character === '^' || character === '_' || character === '&') { tokens.push({ type: character, start: index, end: index + 1 }); index += 1; continue; }
      tokens.push({ type: 'char', value: character, start: index, end: index + 1 }); index += 1;
    }
    return tokens;
  }
  function parseLatex(input) {
    const source = String(input || ''); const tokens = tokenizeLatex(source); let pos = 0;
    const peek = () => tokens[pos];
    function parseGroup() {
      const nodes = [];
      while (pos < tokens.length) {
        const token = tokens[pos];
        if (token.type === '}') break;
        if (token.type === 'command' && (token.name === 'right' || token.name === 'end')) break;
        nodes.push(parseElement());
      }
      return nodes;
    }
    function parseElement() { return parseScripts(parseAtom()); }
    function parseScripts(base) {
      let sub = null; let sup = null;
      for (;;) {
        const token = peek();
        if (token && token.type === '^') { pos += 1; sup = parseArgument(); }
        else if (token && token.type === '_') { pos += 1; sub = parseArgument(); }
        else if (token && token.type === 'char' && token.value === "'") { pos += 1; sup = { type: 'atom', value: '′' }; }
        else break;
      }
      return sub || sup ? { type: 'scripts', base, sub, sup } : base;
    }
    function parseArgument() {
      const token = peek();
      if (token && token.type === '{') { pos += 1; const body = parseGroup(); if (peek() && peek().type === '}') pos += 1; return { type: 'group', body }; }
      return parseAtom();
    }
    function readRawGroup() {
      const open = peek(); if (!open || open.type !== '{') return '';
      pos += 1; let depth = 1; let end = -1;
      while (pos < tokens.length) {
        const token = tokens[pos];
        if (token.type === '{') depth += 1;
        else if (token.type === '}') { depth -= 1; if (depth === 0) { end = token.start; pos += 1; break; } }
        pos += 1;
      }
      return end < 0 ? '' : source.slice(open.end, end);
    }
    function readDelimiter() {
      const token = peek(); if (!token) return '';
      if (token.type === 'char') { pos += 1; return token.value; }
      if (token.type === 'command') {
        pos += 1;
        const map = { lbrace: '{', rbrace: '}', lvert: '|', rvert: '|', vert: '|', lVert: '‖', rVert: '‖', langle: '⟨', rangle: '⟩', '.': '' };
        return map[token.name] !== undefined ? map[token.name] : (SYMBOLS[token.name] || token.name);
      }
      pos += 1; return '';
    }
    function parseAtom() {
      const token = tokens[pos];
      if (!token) return { type: 'atom', value: '' };
      if (token.type === 'char') { pos += 1; return { type: 'atom', value: token.value }; }
      if (token.type === '{') { pos += 1; const body = parseGroup(); if (peek() && peek().type === '}') pos += 1; return { type: 'group', body }; }
      if (token.type === 'command') { pos += 1; return parseCommand(token.name); }
      pos += 1; return { type: 'atom', value: '' };
    }
    function parseCommand(name) {
      if (name === 'frac' || name === 'dfrac' || name === 'tfrac') return { type: 'frac', num: parseArgument(), den: parseArgument() };
      if (name === 'sqrt') {
        let index = null;
        if (peek() && peek().type === 'char' && peek().value === '[') { pos += 1; const nodes = []; while (pos < tokens.length && !(tokens[pos].type === 'char' && tokens[pos].value === ']')) nodes.push(parseElement()); if (peek()) pos += 1; index = { type: 'group', body: nodes }; }
        return { type: 'sqrt', index, body: parseArgument() };
      }
      if (name === 'left') {
        const open = readDelimiter(); const body = parseGroup(); let close = '';
        if (peek() && peek().type === 'command' && peek().name === 'right') { pos += 1; close = readDelimiter(); }
        return { type: 'delim', open, close, body };
      }
      if (name === 'text' || name === 'mathrm' || name === 'operatorname' || name === 'mbox') return { type: 'text', value: readRawGroup() };
      if (name === 'begin') return parseEnvironment();
      if (ACCENT_MATHML[name]) return { type: 'accent', accent: name, body: parseArgument() };
      if (name === 'overline') return { type: 'bar', pos: 'top', body: parseArgument() };
      if (name === 'underline') return { type: 'bar', pos: 'bot', body: parseArgument() };
      if (NARY[name]) return { type: 'nary', op: name };
      if (FUNCTIONS.has(name)) return { type: 'func', name };
      if (name === ',' || name === ';' || name === '!' || name === ' ' || name === 'quad' || name === 'qquad') return { type: 'space', name };
      if (GREEK[name]) return { type: 'atom', value: GREEK[name] };
      if (SYMBOLS[name]) return { type: 'atom', value: SYMBOLS[name] };
      return { type: 'atom', value: name };
    }
    function parseEnvironment() {
      let env = '';
      if (peek() && peek().type === '{') { pos += 1; while (pos < tokens.length && tokens[pos].type !== '}') { const token = tokens[pos]; env += token.type === 'char' ? token.value : (token.type === 'command' ? token.name : ''); pos += 1; } if (peek()) pos += 1; }
      const rows = []; let cells = []; let cell = [];
      while (pos < tokens.length) {
        const token = tokens[pos];
        if (token.type === 'command' && token.name === 'end') { pos += 1; if (peek() && peek().type === '{') { pos += 1; while (pos < tokens.length && tokens[pos].type !== '}') pos += 1; if (peek()) pos += 1; } break; }
        if (token.type === 'command' && token.name === '\\') { pos += 1; cells.push(cell); cell = []; rows.push(cells); cells = []; continue; }
        if (token.type === '&') { pos += 1; cells.push(cell); cell = []; continue; }
        cell.push(parseElement());
      }
      if (cell.length || cells.length) { cells.push(cell); rows.push(cells); }
      return { type: 'matrix', env, rows };
    }
    return parseGroup();
  }

  function contentNodes(node) { return node && node.type === 'group' ? node.body : (node ? [node] : []); }
  function isGreek(value) { return GREEK_VALUES.has(value); }
  function mathmlAtom(value) {
    if (/^[0-9]+$/.test(value)) return `<mn>${escapeXml(value)}</mn>`;
    if (/^[a-zA-Z]$/.test(value) || isGreek(value)) return `<mi>${escapeXml(value)}</mi>`;
    return `<mo>${escapeXml(value)}</mo>`;
  }
  function mmlRow(nodes) { return `<mrow>${(nodes || []).map(nodeToMathML).join('')}</mrow>`; }
  function nodeToMathML(node) {
    if (!node) return '';
    switch (node.type) {
      case 'atom': return mathmlAtom(node.value);
      case 'group': return mmlRow(node.body);
      case 'frac': return `<mfrac>${mmlRow(contentNodes(node.num))}${mmlRow(contentNodes(node.den))}</mfrac>`;
      case 'sqrt': return node.index ? `<mroot>${mmlRow(contentNodes(node.body))}${mmlRow(contentNodes(node.index))}</mroot>` : `<msqrt>${mmlRow(contentNodes(node.body))}</msqrt>`;
      case 'scripts': return mathmlScripts(node);
      case 'nary': return `<mo>${escapeXml(NARY[node.op] || node.op)}</mo>`;
      case 'delim': return `<mrow><mo>${escapeXml(node.open)}</mo>${mmlRow(node.body)}<mo>${escapeXml(node.close)}</mo></mrow>`;
      case 'accent': return `<mover accent="true">${mmlRow(contentNodes(node.body))}<mo>${escapeXml(ACCENT_MATHML[node.accent] || '')}</mo></mover>`;
      case 'bar': return node.pos === 'bot' ? `<munder>${mmlRow(contentNodes(node.body))}<mo>_</mo></munder>` : `<mover>${mmlRow(contentNodes(node.body))}<mo>‾</mo></mover>`;
      case 'func': return `<mo>${escapeXml(node.name)}</mo>`;
      case 'text': return `<mtext>${escapeXml(node.value)}</mtext>`;
      case 'space': return `<mspace width="${SPACE_WIDTH[node.name] || '0.2em'}"/>`;
      case 'matrix': return mathmlMatrix(node);
      default: return '';
    }
  }
  function mathmlScripts(node) {
    if (node.base && node.base.type === 'nary') {
      const op = `<mo>${escapeXml(NARY[node.base.op] || node.base.op)}</mo>`;
      if (node.sub && node.sup) return `<munderover>${op}${mmlRow(contentNodes(node.sub))}${mmlRow(contentNodes(node.sup))}</munderover>`;
      if (node.sub) return `<munder>${op}${mmlRow(contentNodes(node.sub))}</munder>`;
      if (node.sup) return `<mover>${op}${mmlRow(contentNodes(node.sup))}</mover>`;
      return op;
    }
    const base = nodeToMathML(node.base);
    if (node.sub && node.sup) return `<msubsup>${base}${mmlRow(contentNodes(node.sub))}${mmlRow(contentNodes(node.sup))}</msubsup>`;
    if (node.sup) return `<msup>${base}${mmlRow(contentNodes(node.sup))}</msup>`;
    return `<msub>${base}${mmlRow(contentNodes(node.sub))}</msub>`;
  }
  function mathmlMatrix(node) {
    const rows = node.rows.map((row) => `<mtr>${row.map((cell) => `<mtd>${mmlRow(cell)}</mtd>`).join('')}</mtr>`).join('');
    const table = `<mtable>${rows}</mtable>`;
    if (node.env === 'pmatrix') return `<mrow><mo>(</mo>${table}<mo>)</mo></mrow>`;
    if (node.env === 'bmatrix') return `<mrow><mo>[</mo>${table}<mo>]</mo></mrow>`;
    if (node.env === 'vmatrix') return `<mrow><mo>|</mo>${table}<mo>|</mo></mrow>`;
    if (node.env === 'cases') return `<mrow><mo>{</mo>${table}</mrow>`;
    return table;
  }
  function latexToMathML(input) {
    try { return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${mmlRow(parseLatex(input))}</math>`; }
    catch { return `<math xmlns="http://www.w3.org/1998/Math/MathML"><mtext>${escapeXml(input)}</mtext></math>`; }
  }

  function ommlNodes(nodes) { return (nodes || []).map(nodeToOmml).join(''); }
  function ommlRun(value, style) { return `<m:r>${style ? `<m:rPr><m:sty m:val="${style}"/></m:rPr>` : ''}<m:t xml:space="preserve">${escapeXml(value)}</m:t></m:r>`; }
  function nodeToOmml(node) {
    if (!node) return '';
    switch (node.type) {
      case 'atom': return ommlRun(node.value);
      case 'group': return ommlNodes(node.body);
      case 'frac': return `<m:f><m:num>${ommlNodes(contentNodes(node.num))}</m:num><m:den>${ommlNodes(contentNodes(node.den))}</m:den></m:f>`;
      case 'sqrt': return `<m:rad><m:radPr><m:degHide m:val="${node.index ? '0' : '1'}"/></m:radPr><m:deg>${node.index ? ommlNodes(contentNodes(node.index)) : ''}</m:deg><m:e>${ommlNodes(contentNodes(node.body))}</m:e></m:rad>`;
      case 'scripts': return ommlScripts(node);
      case 'nary': return `<m:nary><m:naryPr><m:chr m:val="${escapeXml(NARY[node.op] || node.op)}"/><m:limLoc m:val="undOvr"/><m:subHide m:val="1"/><m:supHide m:val="1"/></m:naryPr><m:sub/><m:sup/><m:e/></m:nary>`;
      case 'delim': return `<m:d><m:dPr><m:begChr m:val="${escapeXml(node.open)}"/><m:endChr m:val="${escapeXml(node.close)}"/></m:dPr><m:e>${ommlNodes(node.body)}</m:e></m:d>`;
      case 'accent': return `<m:acc><m:accPr><m:chr m:val="${ACCENT_OMML[node.accent] || ''}"/></m:accPr><m:e>${ommlNodes(contentNodes(node.body))}</m:e></m:acc>`;
      case 'bar': return `<m:bar><m:barPr><m:pos m:val="${node.pos === 'bot' ? 'bot' : 'top'}"/></m:barPr><m:e>${ommlNodes(contentNodes(node.body))}</m:e></m:bar>`;
      case 'func': return ommlRun(node.name, 'p');
      case 'text': return ommlRun(node.value, 'p');
      case 'space': return ommlRun(' ');
      case 'matrix': return ommlMatrix(node);
      default: return '';
    }
  }
  function ommlScripts(node) {
    if (node.base && node.base.type === 'nary') {
      const op = node.base.op;
      return `<m:nary><m:naryPr><m:chr m:val="${escapeXml(NARY[op] || op)}"/><m:limLoc m:val="undOvr"/><m:subHide m:val="${node.sub ? '0' : '1'}"/><m:supHide m:val="${node.sup ? '0' : '1'}"/></m:naryPr><m:sub>${node.sub ? ommlNodes(contentNodes(node.sub)) : ''}</m:sub><m:sup>${node.sup ? ommlNodes(contentNodes(node.sup)) : ''}</m:sup><m:e/></m:nary>`;
    }
    const base = nodeToOmml(node.base);
    if (node.sub && node.sup) return `<m:sSubSup><m:e>${base}</m:e><m:sub>${ommlNodes(contentNodes(node.sub))}</m:sub><m:sup>${ommlNodes(contentNodes(node.sup))}</m:sup></m:sSubSup>`;
    if (node.sup) return `<m:sSup><m:e>${base}</m:e><m:sup>${ommlNodes(contentNodes(node.sup))}</m:sup></m:sSup>`;
    return `<m:sSub><m:e>${base}</m:e><m:sub>${ommlNodes(contentNodes(node.sub))}</m:sub></m:sSub>`;
  }
  function ommlMatrix(node) {
    const rows = node.rows.map((row) => `<m:mr>${row.map((cell) => `<m:e>${ommlNodes(cell)}</m:e>`).join('')}</m:mr>`).join('');
    const matrix = `<m:m><m:mPr><m:mcs><m:mc><m:mcPr><m:count m:val="${Math.max(1, ...node.rows.map((row) => row.length))}"/><m:mcJc m:val="center"/></m:mcPr></m:mc></m:mcs></m:mPr>${rows}</m:m>`;
    if (node.env === 'pmatrix') return `<m:d><m:dPr><m:begChr m:val="("/><m:endChr m:val=")"/></m:dPr><m:e>${matrix}</m:e></m:d>`;
    if (node.env === 'bmatrix') return `<m:d><m:dPr><m:begChr m:val="["/><m:endChr m:val="]"/></m:dPr><m:e>${matrix}</m:e></m:d>`;
    if (node.env === 'vmatrix') return `<m:d><m:dPr><m:begChr m:val="|"/><m:endChr m:val="|"/></m:dPr><m:e>${matrix}</m:e></m:d>`;
    if (node.env === 'cases') return `<m:d><m:dPr><m:begChr m:val="{"/><m:endChr m:val=""/></m:dPr><m:e>${matrix}</m:e></m:d>`;
    return matrix;
  }
  function latexToOmml(input) {
    try { return ommlNodes(parseLatex(input)); }
    catch { return ommlRun(String(input), 'p'); }
  }

  /* ================= Markdown 解析 ================= */
  function parseInline(text) {
    const nodes = []; const source = String(text || ''); let index = 0;
    const patterns = [
      { re: /^\$([^$]+)\$/, type: 'math' },
      { re: /^\\\((.+?)\\\)/, type: 'math' },
      { re: /^`([^`]+)`/, type: 'code' },
      { re: /^\*\*([\s\S]+?)\*\*/, type: 'strong' },
      { re: /^__([\s\S]+?)__/, type: 'strong' },
      { re: /^~~([\s\S]+?)~~/, type: 'del' },
      { re: /^\*([^*]+)\*/, type: 'em' },
      { re: /^_([^_]+)_/, type: 'em' },
      { re: /^!\[([^\]]*)\]\(([^)]+)\)/, type: 'image' },
      { re: /^\[([^\]]+)\]\(([^)]+)\)/, type: 'link' }
    ];
    while (index < source.length) {
      const slice = source.slice(index); let matched = false;
      for (const pattern of patterns) {
        const match = pattern.re.exec(slice);
        if (!match) continue;
        if (pattern.type === 'math') nodes.push({ type: 'math', tex: match[1] });
        else if (pattern.type === 'code') nodes.push({ type: 'code', value: match[1] });
        else if (pattern.type === 'link') nodes.push({ type: 'link', href: match[2], children: parseInline(match[1]) });
        else if (pattern.type === 'image') nodes.push({ type: 'text', value: match[1] || '图片' });
        else nodes.push({ type: pattern.type, children: parseInline(match[1]) });
        index += match[0].length; matched = true; break;
      }
      if (matched) continue;
      const character = source[index]; index += 1;
      if (nodes.length && nodes[nodes.length - 1].type === 'text') nodes[nodes.length - 1].value += character;
      else nodes.push({ type: 'text', value: character });
    }
    return nodes;
  }
  function splitTableRow(line) {
    let text = line.trim(); if (text.startsWith('|')) text = text.slice(1); if (text.endsWith('|')) text = text.slice(0, -1);
    return text.split('|').map((cell) => cell.trim());
  }
  function parseListBlock(lines, start) {
    const baseIndent = /^(\s*)/.exec(lines[start])[1].length;
    const ordered = /^\s*\d+[.)]\s+/.test(lines[start]);
    const items = []; let index = start;
    while (index < lines.length) {
      const match = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[index]);
      if (!match) break;
      const indent = match[1].length; const isOrdered = /^\d/.test(match[2]);
      if (indent < baseIndent) break;
      if (indent > baseIndent) { const nested = parseListBlock(lines, index); if (items.length) items[items.length - 1].children = nested.block; index = nested.next; continue; }
      if (isOrdered !== ordered) break;
      items.push({ inline: parseInline(match[3]), children: null }); index += 1;
    }
    return { block: { type: 'list', ordered, items }, next: index };
  }
  function parseMarkdown(markdown) {
    const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
    const blocks = []; let index = 0;
    const isBlank = (line) => /^\s*$/.test(line);
    while (index < lines.length) {
      const line = lines[index];
      if (isBlank(line)) { index += 1; continue; }
      const fence = /^\s*```(.*)$/.exec(line);
      if (fence) {
        const lang = fence[1].trim(); const code = []; index += 1;
        while (index < lines.length && !/^\s*```/.test(lines[index])) { code.push(lines[index]); index += 1; }
        if (index < lines.length) index += 1;
        blocks.push({ type: 'code', lang, value: code.join('\n') }); continue;
      }
      const trimmed = line.trim();
      if (trimmed.startsWith('$$') || trimmed.startsWith('\\[')) {
        const openToken = trimmed.startsWith('$$') ? '$$' : '\\['; const closeToken = trimmed.startsWith('$$') ? '$$' : '\\]';
        let rest = trimmed.slice(openToken.length);
        if (rest.endsWith(closeToken) && rest.length >= closeToken.length) { blocks.push({ type: 'math', tex: rest.slice(0, rest.length - closeToken.length).trim() }); index += 1; continue; }
        const tex = [rest]; index += 1;
        while (index < lines.length && !lines[index].trim().endsWith(closeToken)) { tex.push(lines[index]); index += 1; }
        if (index < lines.length) { const current = lines[index].trim(); tex.push(current.slice(0, current.length - closeToken.length)); index += 1; }
        blocks.push({ type: 'math', tex: tex.join('\n').trim() }); continue;
      }
      const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
      if (heading) { blocks.push({ type: 'heading', level: heading[1].length, inline: parseInline(heading[2].trim()) }); index += 1; continue; }
      if (/^\s*(?:[-*_])\s*(?:[-*_]\s*){2,}$/.test(line)) { blocks.push({ type: 'hr' }); index += 1; continue; }
      if (/^\s*>/.test(line)) { const quote = []; while (index < lines.length && /^\s*>/.test(lines[index])) { quote.push(lines[index].replace(/^\s*>\s?/, '')); index += 1; } blocks.push({ type: 'blockquote', blocks: parseMarkdown(quote.join('\n')) }); continue; }
      if (line.includes('|') && index + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[index + 1]) && lines[index + 1].includes('-')) {
        const header = splitTableRow(line); index += 2; const rows = [];
        while (index < lines.length && lines[index].includes('|') && !isBlank(lines[index])) { rows.push(splitTableRow(lines[index])); index += 1; }
        blocks.push({ type: 'table', header, rows }); continue;
      }
      if (/^(\s*)([-*+]|\d+[.)])\s+/.test(line)) { const parsed = parseListBlock(lines, index); blocks.push(parsed.block); index = parsed.next; continue; }
      const paragraph = [trimmed]; index += 1;
      while (index < lines.length && !isBlank(lines[index]) && !/^(#{1,6})\s/.test(lines[index]) && !/^\s*>/.test(lines[index]) && !/^\s*```/.test(lines[index]) && !/^(\s*)([-*+]|\d+[.)])\s+/.test(lines[index]) && !lines[index].trim().startsWith('$$') && !lines[index].includes('|')) { paragraph.push(lines[index].trim()); index += 1; }
      blocks.push({ type: 'paragraph', inline: parseInline(paragraph.join(' ')) });
    }
    return blocks;
  }

  function inlineToHtml(nodes) {
    return (nodes || []).map((node) => {
      switch (node.type) {
        case 'text': return escapeHtml(node.value);
        case 'strong': return `<strong>${inlineToHtml(node.children)}</strong>`;
        case 'em': return `<em>${inlineToHtml(node.children)}</em>`;
        case 'del': return `<del>${inlineToHtml(node.children)}</del>`;
        case 'code': return `<code>${escapeHtml(node.value)}</code>`;
        case 'link': return `<a href="${escapeHtml(node.href)}" target="_blank" rel="noopener noreferrer">${inlineToHtml(node.children)}</a>`;
        case 'math': return `<span class="md-math">${latexToMathML(node.tex)}</span>`;
        default: return '';
      }
    }).join('');
  }
  function blocksToHtml(blocks) {
    return blocks.map((block) => {
      switch (block.type) {
        case 'heading': return `<h${block.level}>${inlineToHtml(block.inline)}</h${block.level}>`;
        case 'paragraph': return `<p>${inlineToHtml(block.inline)}</p>`;
        case 'math': return `<div class="md-math-block">${latexToMathML(block.tex)}</div>`;
        case 'code': return `<pre><code>${escapeHtml(block.value)}</code></pre>`;
        case 'hr': return '<hr>';
        case 'blockquote': return `<blockquote>${blocksToHtml(block.blocks)}</blockquote>`;
        case 'list': return listToHtml(block);
        case 'table': return tableToHtml(block);
        default: return '';
      }
    }).join('');
  }
  function listToHtml(block) {
    const tag = block.ordered ? 'ol' : 'ul';
    const items = block.items.map((item) => `<li>${inlineToHtml(item.inline)}${item.children ? listToHtml(item.children) : ''}</li>`).join('');
    return `<${tag}>${items}</${tag}>`;
  }
  function tableToHtml(block) {
    const head = `<thead><tr>${block.header.map((cell) => `<th>${inlineToHtml(parseInline(cell))}</th>`).join('')}</tr></thead>`;
    const body = `<tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td>${inlineToHtml(parseInline(cell))}</td>`).join('')}</tr>`).join('')}</tbody>`;
    return `<table>${head}${body}</table>`;
  }
  function renderMarkdownHtml(markdown) { return blocksToHtml(parseMarkdown(markdown)); }

  /* ================= DOCX 生成 ================= */
  const CRC_TABLE = (() => { const table = new Uint32Array(256); for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); table[n] = c >>> 0; } return table; })();
  function crc32(bytes) { let crc = -1; for (let index = 0; index < bytes.length; index += 1) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[index]) & 0xff]; return (crc ^ -1) >>> 0; }
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
    for (const entry of central) {
      const header = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(entry.crc), u32(entry.size), u32(entry.size), u16(entry.nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(entry.offset));
      centralChunks.push(new Uint8Array(header), new Uint8Array(entry.nameBytes)); centralSize += header.length + entry.nameBytes.length;
    }
    const end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(centralSize), u32(offset), u16(0)));
    const all = [...localChunks, ...centralChunks, end];
    let total = 0; for (const chunk of all) total += chunk.length;
    const output = new Uint8Array(total); let pointer = 0; for (const chunk of all) { output.set(chunk, pointer); pointer += chunk.length; }
    return output;
  }
  function plainText(nodes) { return (nodes || []).map((node) => node.type === 'text' ? node.value : node.type === 'code' ? node.value : node.children ? plainText(node.children) : '').join(''); }
  function runXml(value, rPr = '') { return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r>`; }
  function inlineToDocxRuns(nodes, rPr = '') {
    return (nodes || []).map((node) => {
      switch (node.type) {
        case 'text': return runXml(node.value, rPr);
        case 'strong': return inlineToDocxRuns(node.children, `${rPr}<w:b/>`);
        case 'em': return inlineToDocxRuns(node.children, `${rPr}<w:i/>`);
        case 'del': return inlineToDocxRuns(node.children, `${rPr}<w:strike/>`);
        case 'code': return runXml(node.value, `${rPr}<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:shd w:val="clear" w:fill="F3F4F6"/>`);
        case 'link': return runXml(`${plainText(node.children)}（${node.href}）`, `${rPr}<w:color w:val="2563EB"/><w:u w:val="single"/>`);
        case 'math': return `<m:oMath>${latexToOmml(node.tex)}</m:oMath>`;
        default: return '';
      }
    }).join('');
  }
  function listToDocx(block, level = 0) {
    let xml = ''; let counter = 1;
    for (const item of block.items) {
      const prefix = block.ordered ? `${counter}. ` : '• ';
      xml += `<w:p><w:pPr><w:ind w:left="${720 + level * 360}" w:hanging="360"/></w:pPr>${inlineToDocxRuns([{ type: 'text', value: prefix }].concat(item.inline))}</w:p>`;
      if (item.children) xml += listToDocx(item.children, level + 1);
      counter += 1;
    }
    return xml;
  }
  function tableToDocx(block) {
    const rows = [block.header, ...block.rows]; const columns = Math.max(1, ...rows.map((row) => row.length));
    let xml = `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="BFBFBF"/><w:left w:val="single" w:sz="4" w:color="BFBFBF"/><w:bottom w:val="single" w:sz="4" w:color="BFBFBF"/><w:right w:val="single" w:sz="4" w:color="BFBFBF"/><w:insideH w:val="single" w:sz="4" w:color="BFBFBF"/><w:insideV w:val="single" w:sz="4" w:color="BFBFBF"/></w:tblBorders></w:tblPr><w:tblGrid>${Array.from({ length: columns }, () => '<w:gridCol w:w="2400"/>').join('')}</w:tblGrid>`;
    rows.forEach((row, rowIndex) => {
      xml += '<w:tr>';
      for (let column = 0; column < columns; column += 1) {
        const cell = parseInline(row[column] || '');
        xml += `<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr><w:p>${inlineToDocxRuns(cell, rowIndex === 0 ? '<w:b/>' : '')}</w:p></w:tc>`;
      }
      xml += '</w:tr>';
    });
    return `${xml}</w:tbl>`;
  }
  function blockToDocx(block) {
    switch (block.type) {
      case 'heading': { const size = [36, 32, 28, 26, 24, 22][block.level - 1] || 24; return `<w:p><w:pPr><w:outlineLvl w:val="${block.level - 1}"/><w:spacing w:before="240" w:after="120"/></w:pPr>${inlineToDocxRuns(block.inline, `<w:b/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`)}</w:p>`; }
      case 'paragraph': return `<w:p>${inlineToDocxRuns(block.inline)}</w:p>`;
      case 'math': return `<w:p><m:oMathPara><m:oMath>${latexToOmml(block.tex)}</m:oMath></m:oMathPara></w:p>`;
      case 'code': return `<w:p><w:pPr><w:shd w:val="clear" w:fill="F3F4F6"/></w:pPr>${block.value.split('\n').map((line, index) => `${index ? '<w:br/>' : ''}${runXml(line, '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/>')}`).join('')}</w:p>`;
      case 'list': return listToDocx(block);
      case 'table': return tableToDocx(block) + '<w:p/>';
      case 'blockquote': return `<w:p><w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="A78BFA"/></w:pBdr><w:ind w:left="360"/></w:pPr>${block.blocks.map((inner) => inner.type === 'paragraph' ? inlineToDocxRuns(inner.inline) : '').join('')}</w:p>`;
      case 'hr': return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr></w:pPr></w:p>';
      default: return '';
    }
  }
  function buildDocx(markdown) {
    const body = parseMarkdown(markdown).map(blockToDocx).join('');
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
    return zipStore([
      { name: '[Content_Types].xml', data: new Uint8Array(utf8Bytes(contentTypes)) },
      { name: '_rels/.rels', data: new Uint8Array(utf8Bytes(rels)) },
      { name: 'word/document.xml', data: new Uint8Array(utf8Bytes(documentXml)) }
    ]);
  }

  const api = { escapeXml, escapeHtml, utf8Bytes, crc32, zipStore, parseLatex, latexToMathML, latexToOmml, parseMarkdown, parseInline, renderMarkdownHtml, buildDocx, DEFAULT_MARKDOWN };
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;

  const elements = Object.fromEntries(['markdown', 'preview', 'status', 'convertBtn', 'copyMdBtn', 'downloadMdBtn', 'resetBtn'].map((id) => [id, document.getElementById(id)]));
  let debounceTimer = 0;
  function setStatus(message, kind = '') { elements.status.textContent = message; elements.status.dataset.kind = kind; }
  function renderPreview() { elements.preview.innerHTML = renderMarkdownHtml(elements.markdown.value); }
  function schedulePreview() { clearTimeout(debounceTimer); debounceTimer = setTimeout(renderPreview, 150); }
  function downloadDocx() {
    try {
      const bytes = buildDocx(elements.markdown.value);
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = 'OpenEduTools-markdown.docx'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
      root.OpenEduAnalytics?.toolUse?.('markdown-to-word');
      setStatus(`已生成 Word 文档（${bytes.length} 字节），公式已转换为可编辑对象。`, 'success');
    } catch (error) { setStatus(`生成失败：${error.message}`, 'error'); }
  }
  elements.markdown.addEventListener('input', schedulePreview);
  elements.convertBtn.addEventListener('click', downloadDocx);
  elements.copyMdBtn.addEventListener('click', () => root.OETToolPage.copyText(elements.markdown.value));
  elements.downloadMdBtn.addEventListener('click', () => root.OETToolPage.downloadText('OpenEduTools-markdown.md', elements.markdown.value, 'text/markdown;charset=utf-8'));
  elements.resetBtn.addEventListener('click', () => { elements.markdown.value = DEFAULT_MARKDOWN; renderPreview(); setStatus('已恢复示例内容。', 'info'); });
  elements.markdown.value = DEFAULT_MARKDOWN;
  renderPreview();
})(typeof globalThis !== 'undefined' ? globalThis : this);
