import assert from 'node:assert/strict';
import test from 'node:test';
import {transferCartesianValue} from './cartesianTransfer.ts';

test('scalar drop merges cells while preserving source slot, labels and axes',()=>{
 const source=[{name:'GDP',valueAxisIndex:0,data:[4315,2150.76]},{name:'房地产',valueAxisIndex:1,data:[159.9,200]}];
 const before=JSON.stringify(source);
 const result=transferCartesianValue(source,{series:0,index:0},{series:1,index:1},['北京','天津']);
 assert.deepEqual(result.series.map(item=>item.data),[[null,2150.76],[159.9,4515]]);
 assert.equal(result.series[1]!.valueAxisIndex,1);
 assert.equal(result.series[1]!.name,'房地产');
 assert.equal(JSON.stringify(source),before);
 assert.equal(result.island,undefined);
});
test('empty slot restoration, self-drop and drag-out island preserve values',()=>{
 const source=[{name:'GDP',data:[.1,null,.2]}];
 assert.deepEqual(transferCartesianValue(source,{series:0,index:0},{series:0,index:2},['A','B','C']).series[0]!.data,[null,null,.3]);
 assert.deepEqual(transferCartesianValue(source,{series:0,index:0},{series:0,index:1},['A','B','C']).series[0]!.data,[null,.1,.2]);
 assert.deepEqual(transferCartesianValue(source,{series:0,index:0},{series:0,index:0},['A','B','C']).series,source);
 const out=transferCartesianValue(source,{series:0,index:0},null,['\n北京','B','C']);
 assert.deepEqual(out.island,{name:'北京',seriesName:'GDP',value:.1});
 assert.deepEqual(out.series[0]!.data,[null,null,.2]);
});
test('scalar transfer handles negative/exponent values and rejects invalid cells',()=>{
 const merge=(a:number,b:number)=>transferCartesianValue([{name:'A',data:[a,b]}],{series:0,index:0},{series:0,index:1},['A','B']).series[0]!.data[1];
 assert.equal(merge(1e-7,2e-7),3e-7);
 assert.equal(merge(-.1,.3),.2);
 assert.equal(merge(1e20,1e20),2e20);
 assert.throws(()=>merge(Number.MAX_VALUE,Number.MAX_VALUE),RangeError);
 assert.throws(()=>transferCartesianValue([{name:'A',data:[null]}],{series:0,index:0},null,[]),RangeError);
 assert.throws(()=>transferCartesianValue([{name:'A',data:[1]}],{series:0,index:0},{series:1,index:0},[]),RangeError);
});
