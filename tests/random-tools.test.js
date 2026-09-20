const test = require('node:test');
const assert = require('node:assert/strict');
const picker = require('../tools/random-picker/script.js');
const group = require('../tools/random-group/script.js');

test('随机点名解析空行和可选去重', () => { assert.deepEqual(picker.parseNames('甲\n\n 乙 \n甲'), ['甲','乙']); assert.deepEqual(picker.parseNames('甲\n甲',false), ['甲','甲']); assert.deepEqual(picker.parseNames(''), []); });
test('随机索引使用拒绝采样并覆盖边界', () => { const values=[0xffffffff,5]; assert.equal(picker.unbiasedIndex(3,()=>values.shift()),2); assert.equal(picker.unbiasedIndex(1,()=>0),0); assert.throws(()=>picker.unbiasedIndex(0),/大于 0/); });
test('抽取函数不修改候选池且支持确定随机源', () => { const pool=['甲','乙','丙']; assert.deepEqual(picker.drawCandidate(pool,()=>1),{picked:'乙',index:1}); assert.deepEqual(pool,['甲','乙','丙']); assert.throws(()=>picker.drawCandidate([]),/为空/); });
test('点名滚动时长正确换算并拒绝空值和越界', () => { assert.equal(picker.validateDuration('0'),0); assert.equal(picker.validateDuration('2.5'),2500); assert.equal(picker.validateDuration(10),10000); assert.throws(()=>picker.validateDuration(''),/请输入/); assert.throws(()=>picker.validateDuration(-1),/0 到 10/); assert.throws(()=>picker.validateDuration(10.1),/0 到 10/); });
test('Fisher–Yates 洗牌可注入确定索引且保留成员', () => { const result=group.shuffle(['甲','乙','丙'],()=>0); assert.deepEqual(result,['乙','丙','甲']); assert.deepEqual([...result].sort(),['丙','乙','甲'].sort()); });
test('分组均衡并处理组数大于人数、每组人数和错误输入', () => { assert.deepEqual(group.groupBalanced(['a','b','c','d','e'],2).map((items)=>items.length),[3,2]); assert.equal(group.runGrouping(['a'], 'count', 5, ()=>0).length,1); assert.deepEqual(group.runGrouping(['a','b','c','d','e'],'size',2,()=>0).map((items)=>items.length),[2,2,1]); assert.throws(()=>group.runGrouping([],'count',2),/至少一个/); assert.throws(()=>group.runGrouping(['a'],'count',0),/大于 0/); });
