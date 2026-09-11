import assert from 'node:assert/strict';
import test from 'node:test';
import {buildScatterBatches} from './scatterBatch.ts';
test('两组万点数据独立配色，无抽样无丢点',()=>{
 const data=Array.from({length:20000},(_,i)=>({x:i/10,y:Math.sin(i),radius:2,color:i<10000?'red':'blue'}));
 const batches=buildScatterBatches(data);assert.deepEqual(batches.map(b=>[b.color,b.count]),[['red',10000],['blue',10000]]);
 for(const b of batches)assert.equal((b.path.match(/M /g)??[]).length,10000);
});
test('无效几何不写入 SVG 路径',()=>{
 assert.deepEqual(buildScatterBatches([{x:NaN,y:0,radius:2,color:'red'},{x:0,y:0,radius:0,color:'blue'}]),[]);
});
