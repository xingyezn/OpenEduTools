import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const outputDir = path.join(root, 'downloads');
const sharedFiles = [
  'css/tokens.css', 'css/main.css', 'css/components.css', 'css/tool.css',
  'js/theme.js', 'js/storage.js', 'js/favorites.js', 'js/recent.js', 'js/tool-page.js',
  'assets/icons/favicon-32.png', 'assets/images/logo.png'
];

const crcTable = Array.from({ length: 256 }, (_, start) => {
  let value = start;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  return value >>> 0;
});

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function localHeader(name, data, crc) {
  const encoded = Buffer.from(name); const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x0800, 6); header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10); header.writeUInt16LE(0x5d34, 12); header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(encoded.length, 26);
  return Buffer.concat([header, encoded, data]);
}

function centralHeader(name, data, crc, offset) {
  const encoded = Buffer.from(name); const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6); header.writeUInt16LE(0x0800, 8); header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12); header.writeUInt16LE(0x5d34, 14); header.writeUInt32LE(crc, 16); header.writeUInt32LE(data.length, 20); header.writeUInt32LE(data.length, 24); header.writeUInt16LE(encoded.length, 28); header.writeUInt32LE(0, 38); header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, encoded]);
}

export function createZip(entries) {
  const locals = []; const centrals = []; let offset = 0;
  for (const entry of entries) {
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data); const name = entry.name.replaceAll('\\', '/'); const crc = crc32(data); const local = localHeader(name, data, crc);
    locals.push(local); centrals.push(centralHeader(name, data, crc, offset)); offset += local.length;
  }
  const central = Buffer.concat(centrals); const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}

async function toolIds() {
  const entries = await readdir(path.join(root, 'tools'), { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('_')).map((entry) => entry.name).sort();
}

async function readEntry(source, target = source) { return { name: target, data: await readFile(path.join(root, source)) }; }

export async function collectToolPackage(id) {
  const prefix = `OpenEduTools-${id}`; const toolDir = path.join(root, 'tools', id); const files = await readdir(toolDir);
  const entries = [];
  const metadata = JSON.parse(await readFile(path.join(toolDir, 'tool.json'), 'utf8'));
  const landing = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=./tools/${id}/index.html"><title>${metadata.name} · OpenEduTools 离线包</title></head><body><p><a href="./tools/${id}/index.html">打开${metadata.name}</a></p></body></html>`;
  const readme = `OpenEduTools · ${metadata.name}\r\n\r\n使用方法：解压整个文件夹后，双击 index.html。\r\n名单、成绩和文本只在浏览器本地处理。\r\n项目地址：https://github.com/xingyezn/OpenEduTools\r\n许可证：MIT\r\n`;
  entries.push({ name: `${prefix}/index.html`, data: landing }, { name: `${prefix}/README.txt`, data: readme });
  for (const file of files.filter((name) => ['index.html', 'script.js', 'style.css', 'tool.json'].includes(name)).sort()) {
    let data = await readFile(path.join(toolDir, file));
    if (file === 'index.html') data = Buffer.from(data.toString().replace('<html lang="zh-CN">', '<html lang="zh-CN" data-offline-bundle>'));
    entries.push({ name: `${prefix}/tools/${id}/${file}`, data });
  }
  for (const file of sharedFiles) entries.push(await readEntry(file, `${prefix}/${file}`));
  return entries;
}

async function main() {
  const check = process.argv.includes('--check'); let stale = false;
  if (!check) await mkdir(outputDir, { recursive: true });
  for (const id of await toolIds()) {
    const zip = createZip(await collectToolPackage(id)); const destination = path.join(outputDir, `${id}.zip`);
    if (check) {
      let differs = false; try { differs = !(await readFile(destination)).equals(zip); } catch { differs = true; }
      if (differs) { stale = true; console.error(`离线包缺失或已过期：downloads/${id}.zip`); }
    } else { await writeFile(destination, zip); console.log(`已生成 downloads/${id}.zip`); }
  }
  if (stale) process.exitCode = 1; else if (check) console.log('全部离线包均为最新。');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
