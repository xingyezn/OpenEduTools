import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from './tool-metadata.mjs';

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.git') return [];
    return entry.isDirectory() ? walk(full) : [full];
  });
}
const failures = [];
for (const file of walk(rootDir).filter((item) => item.endsWith('.html'))) {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const reference = match[1];
    if (/^(?:https?:|mailto:|tel:|data:|#)/i.test(reference)) continue;
    if (reference.startsWith('/')) { failures.push(`${path.relative(rootDir, file)}: 根路径不兼容项目子路径：${reference}`); continue; }
    const clean = reference.split(/[?#]/)[0]; if (!clean) continue;
    const target = path.resolve(path.dirname(file), clean);
    if (!fs.existsSync(target)) failures.push(`${path.relative(rootDir, file)}: 找不到 ${reference}`);
  }
}
if (failures.length) { console.error(`相对路径检查失败（${failures.length} 项）：\n${failures.map((item) => `- ${item}`).join('\n')}`); process.exitCode = 1; }
else console.log('站内关键相对路径检查通过。');
