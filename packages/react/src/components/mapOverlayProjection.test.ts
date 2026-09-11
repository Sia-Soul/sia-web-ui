import assert from 'node:assert/strict';
import test from 'node:test';
import {projectMapOverlay} from './mapOverlayProjection.ts';
test('地图叠加保留宿主像素投影且只减去一次平移偏移',()=>{
 const coordinate=[116.4551,40.2539] as const;
 let calls=0;
 const result=projectMapOverlay(coordinate,p=>{calls++;assert.equal(p,coordinate);return [640,320];},[120,-40]);
 assert.deepEqual(result,[520,360]);assert.equal(calls,1);
 assert.deepEqual(coordinate,[116.4551,40.2539]);
 assert.deepEqual(projectMapOverlay(coordinate,()=>[1280,640],[120,-40]),[1160,680]);
});
test('不截断视口外像素，拒绝无效输入和底图未就绪的无效投影',()=>{
 assert.deepEqual(projectMapOverlay([0,0],()=>[-25,1000]),[-25,1000]);
 assert.throws(()=>projectMapOverlay([NaN,0],()=>[0,0]),RangeError);
 assert.throws(()=>projectMapOverlay([0,0],()=>[Infinity,0]),RangeError);
 assert.throws(()=>projectMapOverlay([0,0],()=>[0,0],[0,NaN]),RangeError);
});
