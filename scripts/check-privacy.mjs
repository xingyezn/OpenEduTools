import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from './tool-metadata.mjs';

function walk(directory) { return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => { const full = path.join(directory, entry.name); if (['.git','node_modules','tests','scripts','worker'].includes(entry.name)) return []; return entry.isDirectory() ? walk(full) : [full]; }); }
const runtimeFiles = walk(rootDir).filter((file) => /\.(?:html|js|css)$/.test(file)); const failures = [];
const allowedFetches = new Set(['./data/tools.json', './data/stats.json', '../../data/stats.json']);
for (const file of runtimeFiles) {
  const text = fs.readFileSync(file, 'utf8'); const relative = path.relative(rootDir, file).replaceAll('\\','/');
  if (/<(?:script|link|img|iframe)[^>]+(?:src|href)=["']https?:/i.test(text)) failures.push(`${relative}: 包含远程运行时资源`);
  if (/\b(?:eval\s*\(|new\s+Function\s*\()/i.test(text)) failures.push(`${relative}: 包含动态代码执行`);
  for (const match of text.matchAll(/fetch\s*\(\s*["']([^"']+)/g)) if (!allowedFetches.has(match[1])) failures.push(`${relative}: 包含未批准的网络读取 ${match[1]}`);
  for (const match of text.matchAll(/(?:localStorage\.(?:getItem|setItem|removeItem)\s*\(|\bKEY\s*=\s*)["']([^"']+)["']/g)) if (!match[1].startsWith('openEduTools:')) failures.push(`${relative}: localStorage 键缺少 openEduTools: 前缀`);
}
if (failures.length) { console.error(`隐私与网络静态检查失败（${failures.length} 项）：\n${failures.map((item) => `- ${item}`).join('\n')}`); process.exitCode = 1; }
else console.log(`隐私与网络静态检查通过：${runtimeFiles.length} 个运行时文件。`);
