import fs from 'node:fs';
import path from 'node:path';
import { readToolMetadata, rootDir, validateMetadata } from './tool-metadata.mjs';

const check = process.argv.includes('--check');
const entries = readToolMetadata();
const errors = entries.flatMap((entry) => entry.parseError ? [`${entry.directoryName}: ${entry.parseError}`] : validateMetadata(entry.meta, entry).map((message) => `${entry.directoryName}: ${message}`));
if (errors.length) {
  console.error('拒绝生成索引，元数据无效：\n' + errors.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}
const tools = entries.map((entry) => entry.meta).sort((a, b) => a.id.localeCompare(b.id, 'en'));
const output = JSON.stringify({ schemaVersion: 1, generatedFrom: 'tools/*/tool.json', tools }, null, 2) + '\n';
const target = path.join(rootDir, 'data', 'tools.json');
if (check) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (current !== output) { console.error('data/tools.json 已过期；请运行 node scripts/build-tools-index.mjs'); process.exit(1); }
  console.log(`工具索引已同步：${tools.length} 个工具。`);
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output);
  console.log(`已生成 data/tools.json：${tools.length} 个工具。`);
}
