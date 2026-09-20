(function (root) {
  'use strict';

  // 将统计计数压缩成适合卡片展示的短字符串。
  // 0-999 直接显示，1,000+ 用 k，1,000,000+ 用 M，最多保留一位小数。
  function formatCount(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return '0';
    if (number < 1000) return String(Math.round(number));
    if (number < 1000000) {
      const thousands = number / 1000;
      return `${thousands >= 100 ? Math.round(thousands) : Math.round(thousands * 10) / 10}k`;
    }
    const millions = number / 1000000;
    return `${millions >= 100 ? Math.round(millions) : Math.round(millions * 10) / 10}M`;
  }

  const api = { formatCount };
  root.OETFormat = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
