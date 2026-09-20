import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const options = Object.fromEntries(process.argv.slice(2).map((item) => { const [key, value] = item.replace(/^--/, '').split('='); return [key, value ?? true]; }));
const browserName = options.browser || 'chrome';
const baseUrl = String(options.url || 'http://127.0.0.1:8765').replace(/\/$/, '');
const candidates = process.platform === 'win32' ? {
  chrome: ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'],
  edge: ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe']
} : {
  chrome: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
  edge: ['/usr/bin/microsoft-edge']
};
const executable = candidates[browserName]?.find(fs.existsSync);
if (!executable) { console.error(`找不到浏览器：${browserName}`); process.exit(2); }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), `oet-${browserName}-`));
const child = spawn(executable, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--disable-default-apps', '--disable-extensions',
  '--disable-background-networking', '--disable-component-update', '--disable-sync', '--metrics-recording-only',
  '--mute-audio', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });

function devtoolsUrl() {
  return new Promise((resolve, reject) => {
    let buffer = ''; const timer = setTimeout(() => reject(new Error('浏览器调试端口启动超时')), 10000);
    child.stderr.on('data', (chunk) => { buffer += chunk; const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`浏览器提前退出：${code}`)); });
  });
}

class CDP {
  constructor(url) { this.socket = new WebSocket(url); this.id = 0; this.pending = new Map(); this.events = new Map(); this.socket.onmessage = (event) => { const message = JSON.parse(event.data); if (message.id) { const handler = this.pending.get(message.id); this.pending.delete(message.id); if (message.error) handler?.reject(new Error(message.error.message)); else handler?.resolve(message.result); } else for (const handler of this.events.get(message.method) || []) handler(message.params); }; }
  async open() { if (this.socket.readyState === WebSocket.OPEN) return; await new Promise((resolve, reject) => { this.socket.onopen = resolve; this.socket.onerror = reject; }); }
  send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++this.id; this.pending.set(id, { resolve, reject }); this.socket.send(JSON.stringify({ id, method, params })); }); }
  on(method, handler) { const handlers = this.events.get(method) || []; handlers.push(handler); this.events.set(method, handlers); }
  close() { this.socket.close(); }
}

function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
async function main() {
  const browserWs = await devtoolsUrl(); const endpoint = new URL(browserWs); const httpBase = `http://${endpoint.host}`;
  const target = (await (await fetch(`${httpBase}/json/list`)).json()).find((item) => item.type === 'page');
  if (!target) throw new Error('未找到页面目标');
  const cdp = new CDP(target.webSocketDebuggerUrl); await cdp.open();
  const errors = []; const requests = [];
  cdp.on('Runtime.exceptionThrown', (event) => errors.push(event.exceptionDetails?.text || '运行时异常'));
  cdp.on('Log.entryAdded', (event) => { if (event.entry?.level === 'error') errors.push(event.entry.text); });
  cdp.on('Runtime.consoleAPICalled', (event) => { if (event.type === 'error') errors.push(event.args?.map((arg) => arg.value || arg.description).join(' ')); });
  cdp.on('Network.requestWillBeSent', (event) => requests.push(event.request.url));
  await Promise.all(['Page.enable','Runtime.enable','Log.enable','Network.enable'].map((method) => cdp.send(method)));
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: false });
  async function evaluate(expression) { const response = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (response.exceptionDetails) throw new Error(response.exceptionDetails.text); return response.result.value; }
  async function navigate(route) {
    await cdp.send('Page.navigate', { url: `${baseUrl}${route}` });
    for (let attempt = 0; attempt < 50; attempt += 1) {
      await delay(100);
      const ready = await evaluate(`document.readyState === 'complete' && ${route === '/' ? "document.querySelector('#result-count')?.textContent !== '正在加载工具…'" : 'true'}`);
      if (ready) return;
    }
    throw new Error(`页面加载超时：${route}`);
  }
  if (options['offline-picker']) {
    await cdp.send('Page.navigate', { url: `${baseUrl}/index.html` });
    for (let attempt = 0; attempt < 50; attempt += 1) { await delay(100); if (await evaluate(`document.readyState === 'complete'`)) break; }
    await delay(250);
    const check = await evaluate(`(() => { const input=document.querySelector('#names'); if (!input) return {location:location.href}; input.value='示例甲\\n示例乙'; input.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#roll-duration').value='0'; document.querySelector('#draw').click(); return {location:location.href,status:document.querySelector('#status').textContent,downloadVisible:document.body.textContent.includes('下载离线包'),overflow:document.documentElement.scrollWidth>innerWidth}; })()`);
    const unexpectedRequests = requests.filter((url) => /^https?:/i.test(url)); const passed = /\/tools\/random-picker\/index\.html$/.test(check.location) && /已抽中/.test(check.status) && !check.downloadVisible && !check.overflow && errors.length === 0 && unexpectedRequests.length === 0;
    console.log(JSON.stringify({ browser: browserName, mode: 'offline-file', passed, check, errors, unexpectedRequests }, null, 2)); cdp.close(); if (!passed) process.exitCode = 1; return;
  }
  const checks = {};
  await navigate('/'); checks.home = await evaluate(`({ cards: document.querySelectorAll('.tool-card').length, downloads: document.querySelectorAll('.tool-card__download').length, subjects: document.querySelectorAll('#subject-list button').length, github: document.querySelector('[data-github-link]')?.href, count: document.querySelector('#result-count')?.textContent, newTab: document.querySelector('#tool-grid .tool-card__title a')?.target === '_blank', overflow: document.documentElement.scrollWidth > innerWidth })`);
  checks.fuzzySearch = await evaluate(`(() => { const search=document.querySelector('#tool-search'); search.value='揭小'; search.dispatchEvent(new Event('input',{bubbles:true})); const result={cards:document.querySelectorAll('#tool-grid .tool-card').length,name:document.querySelector('#tool-grid .tool-card__title')?.textContent}; document.querySelector('#clear-search').click(); return result; })()`);
  checks.subjectFilter = await evaluate(`(() => { const button=document.querySelector('[data-subject="mathematics"]'); button.click(); const result={cards:document.querySelectorAll('#tool-grid .tool-card').length,name:document.querySelector('#tool-grid .tool-card__title')?.textContent}; document.querySelector('#clear-search').click(); return result; })()`);
  if (options.screenshot) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
    const capture = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); const targetPath = path.resolve(String(options.screenshot)); fs.mkdirSync(path.dirname(targetPath), { recursive: true }); fs.writeFileSync(targetPath, Buffer.from(capture.data, 'base64'));
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: false });
  }
  await navigate('/tools/random-picker/index.html'); checks.picker = await evaluate(`(() => { const input=document.querySelector('#names'); input.value='示例甲\\n示例乙\\n示例甲'; input.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#remove-picked').checked=true; document.querySelector('#roll-duration').value='0'; document.querySelector('#draw').click(); return {status:document.querySelector('#status').textContent,overflow:document.documentElement.scrollWidth>innerWidth}; })()`);
  await navigate('/tools/random-group/index.html'); checks.group = await evaluate(`(() => { const input=document.querySelector('#names'); input.value='示例甲\\n示例乙\\n示例丙\\n示例丁\\n示例戊'; input.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#btnBySize').click(); document.querySelector('#amount').value='2'; document.querySelector('#group').click(); return {groups:document.querySelectorAll('.group-card').length,status:document.querySelector('#status').textContent,overflow:document.documentElement.scrollWidth>innerWidth}; })()`);
  await navigate('/tools/classroom-timer/index.html'); checks.timerStarted = await evaluate(`(() => { document.querySelector('#minutes').value='0'; document.querySelector('#seconds').value='1'; document.querySelector('#start').click(); return document.querySelector('#status').textContent; })()`); await delay(1300); checks.timer = await evaluate(`({display:document.querySelector('#display').textContent,finished:!document.querySelector('#finished').hidden,overflow:document.documentElement.scrollWidth>innerWidth})`);
  await navigate('/tools/text-cleaner/index.html'); checks.cleaner = await evaluate(`(() => { const input=document.querySelector('#source'); input.value='  示例甲  \\n\\n\\n示例甲  '; input.dispatchEvent(new Event('input',{bubbles:true})); for (const name of ['trimLines','collapseBlankLines','dedupeLines']) { const box=document.querySelector('[data-option="'+name+'"]'); box.checked=true; box.dispatchEvent(new Event('change',{bubbles:true})); } return {output:document.querySelector('#output').value,summary:document.querySelector('#summary').textContent,overflow:document.documentElement.scrollWidth>innerWidth}; })()`);
  await navigate('/tools/score-statistics/index.html'); checks.score = await evaluate(`(() => { document.querySelector('#scores').value='分数\\n0\\n60\\n80\\n90\\n100'; document.querySelector('#calculate').click(); return {status:document.querySelector('#status').textContent,result:document.querySelector('#result').textContent,overflow:document.documentElement.scrollWidth>innerWidth}; })()`);
  await navigate('/tools/handwriting-digits/index.html'); checks.handwritingGated = await evaluate(`document.querySelector('#startBtn').disabled`); await evaluate(`(() => { HTMLAnchorElement.prototype.click=function(){}; window.showDirectoryPicker=async()=>{const w={write:async()=>{},close:async()=>{}}; const h={name:'test',getDirectoryHandle:async()=>h,getFileHandle:async()=>({createWritable:async()=>w})}; return h;}; const id=document.querySelector('#studentId'); id.value='T001'; id.dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('#selectFolderBtn').click(); return true; })()`); await delay(150); await evaluate(`(() => { document.querySelector('#startBtn').click(); document.querySelector('#saveBtn').click(); return true; })()`); await delay(700); checks.handwriting = await evaluate(`({count:document.querySelector('#collectedCount').textContent,max:document.querySelector('#maxCountLabel').textContent,status:document.querySelector('#status').textContent,exportVisible:!document.querySelector('#exportAllBtn').hidden,fullscreen:!!document.querySelector('#fullscreenBtn'),target:document.querySelector('#targetNumber').textContent,overflow:document.documentElement.scrollWidth>innerWidth})`);
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 }); checks.scale200 = await evaluate(`({scale:visualViewport.scale,actionVisible:!!document.querySelector('#calculate')?.getClientRects().length,overflow:document.documentElement.scrollWidth>innerWidth})`);
  const unexpectedRequests = requests.filter((url) => /^https?:/i.test(url) && !url.startsWith(baseUrl));
  const passed = checks.home.cards === 6 && checks.home.downloads === 6 && checks.home.subjects >= 2 && /github\.com\/xingyezn\/OpenEduTools/.test(checks.home.github) && checks.home.count === '找到 6 个工具' && checks.home.newTab && checks.fuzzySearch.cards === 1 && checks.fuzzySearch.name === '随机点名' && checks.subjectFilter.cards === 1 && checks.subjectFilter.name === '成绩统计' && /已抽中/.test(checks.picker.status) && checks.group.groups === 3 && checks.timer.finished && checks.cleaner.output === '示例甲\n' && /已完成 5 个分数/.test(checks.score.status) && checks.handwritingGated === true && checks.handwriting.count === '1' && checks.handwriting.max === '100' && /已保存/.test(checks.handwriting.status) && checks.handwriting.exportVisible && checks.handwriting.fullscreen && /^[0-9]$/.test(checks.handwriting.target) && !Object.values(checks).some((check) => check?.overflow) && errors.length === 0 && unexpectedRequests.length === 0;
  console.log(JSON.stringify({ browser: browserName, passed, checks, errors, unexpectedRequests }, null, 2)); cdp.close(); if (!passed) process.exitCode = 1;
}

try { await main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; } finally { child.kill(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* temporary profile cleanup is best effort */ } }
