const test = require('node:test');
const assert = require('node:assert/strict');
const lab = require('../tools/projectile-lab/script.js');

function close(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `期望 ${expected}，实际 ${actual}`);
}

test('斜抛运动在平地上的飞行时间、射程、最高点和落地速度正确', () => {
  const result = lab.computeProjectile({ speed: 20, angleDeg: 45, height: 0, gravity: 9.8 });
  close(result.flightTime, 2 * 20 * Math.sin(Math.PI / 4) / 9.8, 1e-8);
  close(result.range, 400 / 9.8, 1e-8);
  close(result.maxHeight, 10.204081632653061, 1e-8);
  close(result.apexTime, result.flightTime / 2, 1e-8);
  close(result.landingSpeed, 20, 1e-8);
  close(result.landingAngle, 45, 1e-8);
});

test('自由落体与竖直上抛的边界情况可计算', () => {
  const fall = lab.computeProjectile({ speed: 0, angleDeg: 0, height: 10, gravity: 9.8 });
  close(fall.flightTime, Math.sqrt(20 / 9.8), 1e-8);
  close(fall.range, 0, 1e-8);
  close(fall.maxHeight, 10, 1e-8);
  close(fall.landingSpeed, Math.sqrt(2 * 9.8 * 10), 1e-8);
  const vertical = lab.computeProjectile({ speed: 10, angleDeg: 90, height: 0, gravity: 10 });
  close(vertical.range, 0, 1e-8);
  close(vertical.maxHeight, 5, 1e-8);
  close(vertical.landingSpeed, 10, 1e-8);
});

test('多角度对比中 30° 与 60° 射程相同，45° 射程最大', () => {
  const rows = lab.compareAngles({ speed: 20, height: 0, gravity: 9.8 }, [15, 30, 45, 60, 75]);
  const byAngle = Object.fromEntries(rows.map((row) => [row.angleDeg, row]));
  close(byAngle[30].range, byAngle[60].range, 1e-8);
  assert.ok(byAngle[45].range > byAngle[30].range);
  assert.ok(byAngle[45].range >= byAngle[60].range);
  assert.equal(rows[0].angleDeg, 15);
});

test('轨迹采样包含起点和落点，且速度随时间变化', () => {
  const result = lab.computeProjectile({ speed: 15, angleDeg: 30, height: 5, gravity: 9.8 });
  const points = lab.sampleTrajectory(result, 21);
  assert.equal(points.length, 21);
  assert.equal(points[0].t, 0);
  assert.equal(points[0].x, 0);
  assert.equal(points[0].y, 5);
  close(points[points.length - 1].t, result.flightTime, 1e-9);
  close(points[points.length - 1].x, result.range, 1e-6);
  close(points[points.length - 1].y, 0, 1e-6);
  assert.ok(points[10].y > points[0].y);
  assert.ok(points[points.length - 1].vy < 0);
});

test('导出 CSV 包含汇总、对比与轨迹数据', () => {
  const result = lab.computeProjectile({ speed: 20, angleDeg: 45, height: 0, gravity: 9.8 });
  const samples = lab.sampleTrajectory(result, 5);
  const comparison = lab.compareAngles({ speed: 20, height: 0, gravity: 9.8 }, [15, 45]);
  const csv = lab.buildExperimentCsv(result, samples, comparison);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /抛体运动实验数据/);
  assert.match(csv, /水平射程 \(m\)/);
  assert.match(csv, /多角度对比/);
  assert.match(csv, /轨迹采样/);
  assert.match(csv, /40\.816/);
});

test('非法参数会被拒绝', () => {
  assert.throws(() => lab.computeProjectile({ speed: 0, angleDeg: 0, height: 0, gravity: 9.8 }), /不能同时为 0/);
  assert.throws(() => lab.computeProjectile({ speed: 20, angleDeg: 91, height: 0, gravity: 9.8 }), /抛射角/);
  assert.throws(() => lab.computeProjectile({ speed: 20, angleDeg: 45, height: -1, gravity: 9.8 }), /初始高度/);
  assert.throws(() => lab.computeProjectile({ speed: 20, angleDeg: 45, height: 0, gravity: 0 }), /重力加速度/);
});
