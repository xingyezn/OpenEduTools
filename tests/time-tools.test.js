const test = require('node:test');
const assert = require('node:assert/strict');
const clock = require('../tools/fullscreen-clock/script.js');
const pomodoro = require('../tools/pomodoro-timer/script.js');
const noise = require('../tools/noise-meter/script.js');

test('全屏时钟按 24/12 小时制格式化时间与日期', () => {
  const morning = new Date(2026, 8, 21, 9, 5, 7);
  assert.equal(clock.formatTime(morning, { use24: true, showSeconds: true }), '09:05:07');
  assert.equal(clock.formatTime(morning, { use24: true, showSeconds: false }), '09:05');
  assert.equal(clock.formatTime(morning, { use24: false, showSeconds: true }), '09:05:07 AM');
  assert.equal(clock.formatTime(new Date(2026, 8, 21, 12, 0, 0), { use24: false }), '12:00:00 PM');
  assert.equal(clock.formatTime(new Date(2026, 8, 21, 0, 0, 0), { use24: false }), '12:00:00 AM');
  assert.equal(clock.formatDate(morning), '2026 年 9 月 21 日 · 星期一');
});

test('倒计时格式化和结束时间解析处理跨天与非法输入', () => {
  assert.equal(clock.formatCountdown(0), '00:00');
  assert.equal(clock.formatCountdown(61000), '01:01');
  assert.equal(clock.formatCountdown(90000), '01:30');
  assert.equal(clock.formatCountdown(3661000), '1:01:01');
  const now = new Date(2026, 8, 21, 10, 0, 0);
  assert.equal(clock.parseEndTime(now, '11:30').getTime(), new Date(2026, 8, 21, 11, 30, 0).getTime());
  assert.equal(clock.parseEndTime(now, '09:00').getTime(), new Date(2026, 8, 22, 9, 0, 0).getTime());
  assert.equal(clock.parseEndTime(now, ''), null);
  assert.equal(clock.parseEndTime(now, '25:00'), null);
});

test('番茄钟格式化、阶段时长与轮次切换正确', () => {
  assert.equal(pomodoro.formatClock(1500000), '25:00');
  assert.equal(pomodoro.formatClock(0), '00:00');
  assert.equal(pomodoro.formatClock(61000), '01:01');
  const settings = { focus: 25, short: 5, long: 15 };
  assert.equal(pomodoro.phaseDurationMs(settings, 'focus'), 1500000);
  assert.equal(pomodoro.phaseDurationMs(settings, 'short'), 300000);
  assert.equal(pomodoro.phaseDurationMs(settings, 'long'), 900000);
  assert.equal(pomodoro.nextMode('focus', 0, 4), 'short');
  assert.equal(pomodoro.nextMode('focus', 3, 4), 'long');
  assert.equal(pomodoro.nextMode('short', 1, 4), 'focus');
  assert.equal(pomodoro.nextMode('long', 4, 4), 'focus');
});

test('番茄钟按时间戳计算剩余时间并可归零', () => {
  assert.equal(pomodoro.remainingAt({ duration: 1500000, accumulated: 0, startedAt: 1000, running: true }, 61000), 1440000);
  assert.equal(pomodoro.remainingAt({ duration: 1500000, accumulated: 5000, startedAt: 0, running: false }, 99999), 1495000);
  assert.equal(pomodoro.remainingAt({ duration: 1000, accumulated: 0, startedAt: 0, running: true }, 99999), 0);
});

test('噪音计计算 RMS 并映射到 0-100 相对刻度', () => {
  assert.equal(noise.computeRms([128, 128, 128, 128]), 0);
  assert.equal(noise.computeRms([]), 0);
  assert.ok(Math.abs(noise.computeRms([64, 192]) - 0.5) < 1e-9);
  assert.ok(Math.abs(noise.computeRms([0, 255]) - 0.9961) < 0.001);
  assert.equal(noise.rmsToLevel(0), 0);
  assert.equal(noise.rmsToLevel(1), 100);
  assert.equal(noise.rmsToLevel(0.5), 90);
});
