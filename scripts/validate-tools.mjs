import fs from 'node:fs';
import path from 'node:path';
import { readToolMetadata, rootDir, validateMetadata } from './tool-metadata.mjs';

const entries = readToolMetadata();
const failures = [];
const seen = new Set();
if (!entries.length) failures.push('tools/: 未找到工具目录');
for (const entry of entries) {
  const label = path.relative(rootDir, entry.file).replaceAll('\\', '/');
  if (entry.parseError) { failures.push(`${label}: ${entry.parseError}`); continue; }
  for (const error of validateMetadata(entry.meta, entry)) failures.push(`${label}: ${error}`);
  if (seen.has(entry.meta.id)) failures.push(`${label}: 重复 id ${entry.meta.id}`);
  seen.add(entry.meta.id);
  for (const name of ['index.html', 'style.css', 'script.js', 'tool.json']) {
    if (!fs.existsSync(path.join(rootDir, 'tools', entry.directoryName, name))) failures.push(`${label}: 缺少 ${name}`);
  }
  const target = path.join(rootDir, ...String(entry.meta.entry || '').split('/'));
  if (!fs.existsSync(target)) failures.push(`${label}: entry 指向不存在的文件`);
}
if (failures.length) {
  console.error(`工具元数据校验失败（${failures.length} 项）：`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else console.log(`工具元数据校验通过：${entries.length} 个工具。`);
