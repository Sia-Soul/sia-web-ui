import test from 'node:test';
import assert from 'node:assert/strict';
import {rasterizeHeatmap} from './heatmapRaster.ts';
const options={radius:0,blur:1,minAlpha:0,gradient:[{offset:0,color:[0,0,255] as const},{offset:1,color:[255,0,0] as const}]};
test('overlapping heat accumulates before color lookup',()=>{
 const point={x:2.5,y:2.5,value:.5};
 const one=rasterizeHeatmap(5,5,[point],options),two=rasterizeHeatmap(5,5,[point,point],options),i=(2*5+2)*4;
 assert.equal(one[i+3],128);assert.equal(two[i+3],191);
 assert.ok(two[i]!>one[i]!);assert.ok(two[i+2]!<one[i+2]!);
});
test('heat opacity, clipping and nonfinite points',()=>{
 const point={x:.5,y:.5,value:1};
 assert.equal(rasterizeHeatmap(2,2,[point],{...options,opacity:.6})[3],153);
 assert.ok(rasterizeHeatmap(2,2,[{x:1000,y:800,value:1}],options).every(v=>v===0));
 assert.ok(rasterizeHeatmap(2,2,[{x:NaN,y:0,value:1}],options).every(v=>v===0));
 assert.equal(rasterizeHeatmap(0,0,[],options).length,0);
});
