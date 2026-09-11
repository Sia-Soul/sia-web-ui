import assert from 'node:assert/strict';
import test from 'node:test';
import {barMagicLayout} from './barMagicLayout.ts';
test('原始混合堆叠、全堆叠、全平铺互相切换不修改原配置',()=>{
 const series=[{data:[220]},{stack:'总量',data:[120]},{stack:'总量',data:[320]},{data:[620]}];const before=structuredClone(series);
 const normal=barMagicLayout(series,1,'bar');assert.deepEqual(normal.rows.map(r=>[r[0]?.start,r[0]?.end]),[[0,220],[0,120],[120,440],[0,620]]);
 const stack=barMagicLayout(series,1,'stack');assert.deepEqual(stack.rows.map(r=>[r[0]?.start,r[0]?.end]),[[0,220],[220,340],[340,660],[660,1280]]);
 const tiled=barMagicLayout(series,1,'tiled');assert.equal(tiled.groups.length,4);assert.deepEqual(tiled.rows.map(r=>r[0]?.start),[0,0,0,0]);
 assert.deepEqual(series,before);assert.deepEqual(barMagicLayout(series,1,'bar'),normal);
});
test('缺失槽与正负堆叠在切换时保留',()=>{
 const series=[{data:[-2,{value:NaN,hidden:true}]},{data:[3,4]},{data:[-5,6]}];
 const stack=barMagicLayout(series,2,'stack');assert.equal(stack.rows[0]?.[1],null);assert.equal(stack.rows[2]?.[0]?.end,-7);assert.equal(stack.rows[2]?.[1]?.end,10);
});
