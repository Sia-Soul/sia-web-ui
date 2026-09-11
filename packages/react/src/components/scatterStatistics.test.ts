import assert from 'node:assert/strict';
import test from 'node:test';
import {scatterStatistics} from './scatterStatistics.ts';
test('系列均值与极值独立计算，不受其他组影响',()=>{
 const stats=scatterStatistics([{x:1,y:2,category:'A'},{x:3,y:4,category:'A'},{x:10,y:20,category:'B'}],true);
 assert.deepEqual(stats.map(s=>[s.category,s.averageX,s.averageY,s.minY,s.maxY]),[['A',2,3,2,4],['B',10,20,20,20]]);
});
test('全局模式保持原行为，空数据和非有限数不产生伪均值',()=>{
 assert.equal(scatterStatistics([{x:1,y:2},{x:3,y:4}])[0]!.averageY,3);
 assert.deepEqual(scatterStatistics([{x:NaN,y:2}]),[]);assert.deepEqual(scatterStatistics([]),[]);
});
