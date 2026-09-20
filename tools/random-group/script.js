(function (root) {
  'use strict';
  function parseNames(raw, dedupe = true) { const names = String(raw || '').split(/[\s,，、;；/]+/).map((value) => value.trim()).filter(Boolean); return dedupe ? [...new Set(names)] : names; }
  function secureUint32() { if (root.crypto?.getRandomValues) { const values = new Uint32Array(1); root.crypto.getRandomValues(values); return values[0]; } return Math.floor(Math.random() * 0x100000000); }
  function unbiasedIndex(length, randomUint32 = secureUint32) { if (!Number.isInteger(length) || length < 1) throw new RangeError('范围必须大于 0'); const range = 0x100000000; const limit = range - range % length; let value; do { value = randomUint32(); } while (!Number.isInteger(value) || value < 0 || value >= limit); return value % length; }
  function shuffle(items, randomIndex = unbiasedIndex) { const result = [...items]; for (let index = result.length - 1; index > 0; index -= 1) { const other = randomIndex(index + 1); [result[index], result[other]] = [result[other], result[index]]; } return result; }
  function groupBalanced(items, groupCount) { if (!Number.isInteger(groupCount) || groupCount < 1) throw new RangeError('组数必须是正整数'); if (items.length === 0) return []; const count = Math.min(groupCount, items.length); const groups = Array.from({ length: count }, () => []); items.forEach((item, index) => groups[index % count].push(item)); return groups; }
  function runGrouping(names, mode, amount, randomIndex) { if (!names.length) throw new Error('请先输入至少一个姓名'); if (!Number.isInteger(amount) || amount < 1) throw new Error('数量必须是大于 0 的整数'); const groupCount = mode === 'size' ? Math.ceil(names.length / amount) : amount; return groupBalanced(shuffle(names, randomIndex), groupCount); }
  function formatGroups(groups) { return groups.map((group, index) => `第 ${index + 1} 组（${group.length} 人）\n${group.join('\n')}`).join('\n\n'); }
  const api = { parseNames, unbiasedIndex, shuffle, groupBalanced, runGrouping, formatGroups };
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;

  const input = document.getElementById('names'); const dedupe = document.getElementById('dedupe'); const amount = document.getElementById('amount'); const groupButton = document.getElementById('group');
  const status = document.getElementById('status'); const result = document.getElementById('result'); const copy = document.getElementById('copy'); const groupInfo = document.getElementById('groupInfo'); const numLabel = document.getElementById('numLabel');
  const count = document.getElementById('name-count'); const settingsToggle = document.getElementById('settings-toggle'); const panel = document.getElementById('settings-panel');
  let groupMode = 'count'; let lastGroups = [];
  function currentNames() { return parseNames(input.value, dedupe.checked); }
  function setStatus(message, kind = '') { status.textContent = message; status.dataset.kind = kind; }
  function updateCount() { count.textContent = `有效人数：${currentNames().length}`; }
  function setGroupMode(mode) {
    if (groupMode === mode) return;
    groupMode = mode;
    document.getElementById('btnByCount').classList.toggle('is-active', mode === 'count'); document.getElementById('btnByCount').setAttribute('aria-pressed', String(mode === 'count'));
    document.getElementById('btnBySize').classList.toggle('is-active', mode === 'size'); document.getElementById('btnBySize').setAttribute('aria-pressed', String(mode === 'size'));
    numLabel.textContent = mode === 'count' ? '组数' : '每组人数'; amount.setAttribute('aria-label', numLabel.textContent);
    amount.value = 4; amount.focus(); amount.select();
  }
  function render(groups) {
    const fragment = document.createDocumentFragment();
    groups.forEach((group, index) => {
      const card = document.createElement('section'); card.className = 'group-card'; card.style.animationDelay = `${(index * 0.04).toFixed(2)}s`;
      const head = document.createElement('div'); head.className = 'group-head';
      const name = document.createElement('span'); name.className = 'g-name'; name.textContent = `第 ${index + 1} 组`;
      const size = document.createElement('span'); size.className = 'g-count'; size.textContent = `${group.length} 人`;
      head.append(name, size);
      const list = document.createElement('ul');
      group.forEach((member) => { const item = document.createElement('li'); item.textContent = member; list.append(item); });
      card.append(head, list); fragment.append(card);
    });
    result.replaceChildren(fragment);
  }
  function clearResult() {
    lastGroups = []; copy.disabled = true; groupInfo.textContent = '';
    result.replaceChildren(Object.assign(document.createElement('p'), { className: 'empty-tip', textContent: '点击「分组」开始随机分组' }));
  }
  function doGroup() {
    try {
      const value = Number(amount.value);
      lastGroups = runGrouping(currentNames(), groupMode, value);
      render(lastGroups); copy.disabled = false;
      const total = lastGroups.reduce((sum, group) => sum + group.length, 0);
      groupInfo.textContent = `共 ${lastGroups.length} 组 ｜ ${total} 人`;
      setStatus(`已分为 ${lastGroups.length} 组，每组 ${Math.min(...lastGroups.map((group) => group.length))}–${Math.max(...lastGroups.map((group) => group.length))} 人。`, 'success');
      root.OpenEduAnalytics?.toolUse?.('random-group');
    } catch (error) { clearResult(); setStatus(error.message, 'error'); }
  }
  function openPanel(open) { panel.hidden = !open; settingsToggle.setAttribute('aria-expanded', String(open)); if (open) { updateCount(); input.focus(); } }
  groupButton.addEventListener('click', doGroup);
  copy.addEventListener('click', () => { if (lastGroups.length) root.OETToolPage.copyText(formatGroups(lastGroups)); });
  document.getElementById('btnByCount').addEventListener('click', () => setGroupMode('count'));
  document.getElementById('btnBySize').addEventListener('click', () => setGroupMode('size'));
  amount.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.keyCode === 13) { event.preventDefault(); doGroup(); } });
  settingsToggle.addEventListener('click', () => openPanel(panel.hidden));
  document.getElementById('apply-names').addEventListener('click', () => { updateCount(); clearResult(); setStatus(`名单已应用，共 ${currentNames().length} 人。`, 'success'); openPanel(false); });
  document.getElementById('clear').addEventListener('click', () => { input.value = ''; clearResult(); updateCount(); setStatus('已清空，名单未被保存。', 'success'); input.focus(); });
  input.addEventListener('input', updateCount);
  dedupe.addEventListener('change', updateCount);
  updateCount();
})(typeof globalThis !== 'undefined' ? globalThis : this);
