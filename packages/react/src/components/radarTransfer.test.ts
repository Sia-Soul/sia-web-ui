import test from 'node:test';
import assert from 'node:assert/strict';
import {transferRadarSeries} from './radarTransfer.ts';
test('radar merge adds full arrays in destination order and preserves source snapshots',()=>{
 const panels=[{series:[{name:'图一',data:[100,8,.4,-80,2000]},{name:'图二',data:[10,3,.2,-100,1000]},{name:'图三',data:[20,3,.3,-13.5,3000]}]}];
 const snapshot=JSON.stringify(panels);
 const merged=transferRadarSeries(panels,{panel:0,series:0},{panel:0,series:1});
 assert.equal(merged[0]!.series.length,2);
 assert.deepEqual(merged[0]!.series[0],{name:'图二 & 图一',data:[110,11,.6,-180,3000]});
 assert.deepEqual(merged[0]!.series[1],panels[0]!.series[2]);
 assert.equal(JSON.stringify(panels),snapshot);
});
test('radar move, drag-out and self-drop preserve deterministic indexing',()=>{
 const panels=[{series:[{name:'甲',data:[1,2]},{name:'乙',data:[3,4]}]},{series:[]}];
 const moved=transferRadarSeries(panels,{panel:0,series:1},{panel:1});
 assert.equal(moved[0]!.series.length,1);assert.deepEqual(moved[1]!.series[0],panels[0]!.series[1]);
 assert.equal(transferRadarSeries(panels,{panel:0,series:0},null)[0]!.series[0]!.name,'乙');
 assert.deepEqual(transferRadarSeries(panels,{panel:0,series:0},{panel:0,series:0}),panels);
 assert.throws(()=>transferRadarSeries(panels,{panel:0,series:9},null),RangeError);
 assert.throws(()=>transferRadarSeries(panels,{panel:0,series:0},{panel:9}),RangeError);
 assert.throws(()=>transferRadarSeries([{series:[{name:'a',data:[1]},{name:'b',data:[1,2]}]}],{panel:0,series:0},{panel:0,series:1}),RangeError);
});
