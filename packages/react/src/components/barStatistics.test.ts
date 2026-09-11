import assert from 'node:assert/strict';
import test from 'node:test';
import {barStatistics} from './barStatistics.ts';
test('搜索引擎完整七日统计保持原精度',()=>{
 const actual=barStatistics([620,732,{value:701},734,890,930,820])!;
 assert.equal(actual.average,5427/7);assert.equal(actual.average.toFixed(2),'775.29');assert.equal(actual.min,620);assert.equal(actual.max,930);
});
test('不把缺失和隐藏数据记为零，保留真实零和负值',()=>{
 assert.deepEqual(barStatistics([NaN,{value:99,hidden:true},-2,0,8]),{average:2,min:-2,max:8});assert.equal(barStatistics([NaN,Infinity]),undefined);
});
