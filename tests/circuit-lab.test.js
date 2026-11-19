const test = require('node:test');
const assert = require('node:assert/strict');
const lab = require('../tools/circuit-lab/script.js');

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `期望 ${expected}，实际 ${actual}`);
}

test('串联电路等效电阻、总电流和各电阻电压正确', () => {
  const circuit = lab.solveCircuit({ mode: 'series', voltage: 6, resistors: [10, 20] });
  close(circuit.equivalentResistance, 30);
  close(circuit.totalCurrent, 0.2);
  close(circuit.totalPower, 1.2);
  assert.deepEqual(circuit.branches.map((branch) => branch.voltage), [2, 4]);
  assert.deepEqual(circuit.branches.map((branch) => branch.current), [0.2, 0.2]);
  assert.deepEqual(circuit.branches.map((branch) => branch.power), [0.4, 0.8]);
  close(circuit.branches.reduce((sum, branch) => sum + branch.voltage, 0), 6);
});

test('并联电路等效电阻、总电流和各支路电流正确', () => {
  const circuit = lab.solveCircuit({ mode: 'parallel', voltage: 6, resistors: [10, 20] });
  close(circuit.equivalentResistance, 20 / 3);
  close(circuit.totalCurrent, 0.9);
  close(circuit.totalPower, 5.4);
  assert.deepEqual(circuit.branches.map((branch) => branch.voltage), [6, 6]);
  close(circuit.branches[0].current, 0.6);
  close(circuit.branches[1].current, 0.3);
  close(circuit.branches.reduce((sum, branch) => sum + branch.current, 0), 0.9);
  close(circuit.branches.reduce((sum, branch) => sum + branch.power, 0), 5.4);
});

test('单个电阻的串联与并联结果一致，符合欧姆定律', () => {
  for (const mode of ['series', 'parallel']) {
    const circuit = lab.solveCircuit({ mode, voltage: 5, resistors: [10] });
    close(circuit.equivalentResistance, 10);
    close(circuit.totalCurrent, 0.5);
    close(circuit.totalPower, 2.5);
    close(circuit.branches[0].voltage, 5);
    close(circuit.branches[0].current, 0.5);
  }
});

test('等效电阻辅助函数支持 1 至 4 个电阻', () => {
  close(lab.equivalentResistance('series', [1, 2, 3, 4]), 10);
  close(lab.equivalentResistance('parallel', [1, 2, 3, 4]), 12 / 25);
  close(lab.equivalentResistance('parallel', [4, 4]), 2);
});

test('非法电压、电阻和连接方式会被拒绝', () => {
  assert.throws(() => lab.solveCircuit({ mode: 'series', voltage: -1, resistors: [10] }), /电源电压/);
  assert.throws(() => lab.solveCircuit({ mode: 'series', voltage: 6, resistors: [] }), /至少设置一个/);
  assert.throws(() => lab.solveCircuit({ mode: 'series', voltage: 6, resistors: [0] }), /第 1 个电阻/);
  assert.throws(() => lab.solveCircuit({ mode: 'series', voltage: 6, resistors: [1001] }), /第 1 个电阻/);
  assert.throws(() => lab.solveCircuit({ mode: 'series', voltage: 6, resistors: [1, 2, 3, 4, 5] }), /最多支持/);
  assert.throws(() => lab.solveCircuit({ mode: 'mixed', voltage: 6, resistors: [10] }), /连接方式无效/);
});

test('实验记录可导出为 CSV，且不修改原始记录', () => {
  const circuit = lab.solveCircuit({ mode: 'parallel', voltage: 6, resistors: [10, 20] });
  const records = [{ ...circuit, resistors: [...circuit.resistors] }];
  const csv = lab.exportCircuitCsv(records);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /连接方式/);
  assert.match(csv, /并联/);
  assert.match(csv, /10 ∥ 20/);
  assert.match(csv, /0\.9/);
  assert.equal(records[0].resistors.length, 2);
  assert.throws(() => lab.exportCircuitCsv([]), /没有可导出/);
});
