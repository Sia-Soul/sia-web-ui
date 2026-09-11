import test from 'node:test';
import assert from 'node:assert/strict';
import {radarRatio,radarDataBounds,radarNiceTicks} from './radarScale.ts';
test('explicit eight-way radar ticks support decimals, narrow integers and negative data',()=>{
 assert.deepEqual(radarNiceTicks(.2,.4,8),{min:.2,max:.4,step:.025,ticks:[.2,.225,.25,.275,.3,.325,.35,.375,.4]});
 assert.deepEqual(radarNiceTicks(3,8,8).ticks,[2,3,4,5,6,7,8,9,10]);
 assert.deepEqual(radarNiceTicks(10,100,8).ticks,[0,20,40,60,80,100,120,140,160]);
 assert.deepEqual(radarNiceTicks(-100,-13.5,8).ticks,[-160,-140,-120,-100,-80,-60,-40,-20,0]);
 assert.deepEqual(radarNiceTicks(1000,3000,8).ticks,[1000,1250,1500,1750,2000,2250,2500,2750,3000]);
});
test('nice ticks cover values and have consistent positive spacing',()=>{
 for(const [min,max] of [[-.01,.03],[.001,.005],[-10,-9],[12,19],[1,1.01],[0,1000]])for(const splits of [4,5,8]){
  const result=radarNiceTicks(min!,max!,splits);
  assert.equal(result.ticks.length,splits+1);
  assert.ok(result.min<=min!+1e-12);assert.ok(result.max>=max!-1e-12);
  assert.ok(result.step>0);
  for(let i=1;i<result.ticks.length;i++)assert.ok(Math.abs(result.ticks[i]!-result.ticks[i-1]!-result.step)<1e-9);
 }
 assert.throws(()=>radarNiceTicks(1,1),RangeError);
 assert.throws(()=>radarNiceTicks(0,1,0),RangeError);
});
test('legacy radar bounds preserve per-axis data and single-series cross-axis behavior',()=>{
 const data=[[100,8,.4,-80,2000],[10,3,.2,-100,1000],[20,3,.3,-13.5,3000]];
 assert.deepEqual(radarDataBounds(data,2,{scale:true,levels:8}),{min:.2,max:.4});
 assert.deepEqual(radarDataBounds(data,3,{scale:true,levels:8}),{min:-100,max:-13.5});
 assert.deepEqual(radarDataBounds(data,3,{scale:false}),{min:-100,max:0});
 assert.deepEqual(radarDataBounds([data[0]!],2,{scale:true}),{min:-80,max:2000});
 assert.deepEqual(radarDataBounds([[10,20,30]],0,{scale:true}),{min:0,max:30});
 assert.deepEqual(radarDataBounds([[10],[10]],0,{scale:true,levels:5}),{min:2,max:10});
 assert.deepEqual(radarDataBounds([[-10],[-10]],0,{scale:true,levels:5}),{min:-10,max:-2});
 assert.deepEqual(radarDataBounds([[0],[0]],0,{scale:true}),{min:0,max:1});
 assert.deepEqual(radarDataBounds([[10],[20]],0,{scale:true,boundaryGap:[.1,.2]}),{min:9,max:22});
 assert.deepEqual(radarDataBounds([],0),{min:0,max:1});
});
test('radar decimal domains use their true span instead of a minimum span of one',()=>{
 assert.equal(radarRatio(.2,.2,.4),0);
 assert.ok(Math.abs(radarRatio(.3,.2,.4)-.5)<1e-12);
 assert.equal(radarRatio(.4,.2,.4),1);
 assert.equal(radarRatio(.4,0,.4),1);
});
test('radar negative, mixed, clipped and degenerate domains are deterministic',()=>{
 assert.equal(radarRatio(-100,-100,-10),0);
 assert.equal(radarRatio(-55,-100,-10),.5);
 assert.equal(radarRatio(0,-10,10),.5);
 assert.equal(radarRatio(100,0,400),.25);
 assert.equal(radarRatio(5,10,20),0);assert.equal(radarRatio(30,10,20),1);
 assert.equal(radarRatio(undefined,10,20),0);assert.equal(radarRatio(NaN,0,10),0);
 assert.equal(radarRatio(10,10,10),0);assert.equal(radarRatio(10,20,10),0);
});
