import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapLineControl,mapLineSample,mapLineDuration} from './mapLineGeometry.ts';
test('迁徙曲线控制点沿方向法线偏移，而不是统一向上',()=>{
 assert.deepEqual(mapLineControl([0,0],[100,0],.2),[50,-20]);
 assert.deepEqual(mapLineControl([0,0],[0,100],.2),[20,50]);
 assert.deepEqual(mapLineControl([100,0],[0,0],.2),[50,20]);
 assert.deepEqual(mapLineControl([10,20],[110,70],.2),[70,25]);
});
test('运动按二次曲线参数采样、端点裁限和距离周期',()=>{
 const s=[0,0] as const,t=[100,0] as const,c=mapLineControl(s,t,.2);
 assert.deepEqual(mapLineSample(s,c,t,.5),[50,-10]);
 assert.deepEqual(mapLineSample(s,c,t,.25),[25,-7.5]);
 assert.deepEqual(mapLineSample(s,c,t,-1),s);assert.deepEqual(mapLineSample(s,c,t,2),t);
 assert.equal(mapLineDuration([0,0],[3,4],30),150);
 assert.equal(mapLineDuration([0,0],[0,0],30),1);
});
