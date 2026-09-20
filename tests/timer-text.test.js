const test = require('node:test');
const assert = require('node:assert/strict');
const timer = require('../tools/classroom-timer/script.js');
const cleaner = require('../tools/text-cleaner/script.js');

test('计时器校验时间并格式化边界', () => { assert.equal(timer.durationFromParts(1,2,3),3723000); assert.throws(()=>timer.durationFromParts(0,60,0),/有效时间/); assert.equal(timer.displayMilliseconds(0),'00:00:00'); assert.equal(timer.displayMilliseconds(1001),'00:00:02'); });
test('计时器用时间戳计算运行、暂停和倒计时归零', () => { const running={mode:'countdown',duration:5000,accumulated:1000,startedAt:100,running:true}; assert.equal(timer.elapsedAt(running,2100),3000); assert.equal(timer.valueAt(running,2100),2000); assert.equal(timer.valueAt(running,9000),0); const paused={...running,running:false}; assert.equal(timer.valueAt(paused,9000),4000); assert.equal(timer.valueAt({mode:'stopwatch',duration:0,accumulated:2500,startedAt:0,running:false},99),2500); });
test('文本清洗默认无损且操作可组合', () => { const raw=' 甲  乙 \r\n\r\n\r\n甲  乙 '; assert.equal(cleaner.cleanText(raw,{}),' 甲  乙 \n\n\n甲  乙 '); assert.equal(cleaner.cleanText(raw,{trimLines:true,collapseSpaces:true,collapseBlankLines:true,dedupeLines:true}),'甲 乙\n'); });
test('文本清洗处理空文本、重复行与标点，统计 Unicode 字符', () => { assert.equal(cleaner.cleanText('',{removeEmptyLines:true}),''); assert.equal(cleaner.cleanText('甲\n乙\n甲',{dedupeLines:true}),'甲\n乙'); assert.equal(cleaner.cleanText('你好, world!',{chinesePunctuation:true}),'你好， world！'); assert.deepEqual(cleaner.textStats('😀\n甲'),{characters:3,lines:2}); assert.equal(cleaner.differenceSummary('a','a').changed,false); });
