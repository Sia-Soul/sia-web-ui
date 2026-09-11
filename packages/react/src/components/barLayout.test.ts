import assert from "node:assert/strict";
import test from "node:test";
import { layoutBarValues } from "./barLayout.ts";

test("重叠柱共享位置但不累加数值，全堆积仍可覆盖", () => {
  const series=[{overlayGroup:"a",data:[40]},{overlayGroup:"b",data:[100]},{overlayGroup:"a",data:[96]}];
  const layout=layoutBarValues(series,1);
  assert.equal(layout.groups.length,2);
  assert.deepEqual(layout.rows.map(row=>row[0]?.group),[0,1,0]);
  assert.deepEqual(layout.rows.map(row=>[row[0]?.start,row[0]?.end]),[[0,40],[0,100],[0,96]]);
  assert.deepEqual(layoutBarValues(series,1,true).rows.map(row=>row[0]?.start),[0,40,140]);
});

test("有堆积系列时，未声明堆积的两组柱仍然独立", () => {
  const layout = layoutBarValues([{data:[320]}, {stack:"广告",data:[120]}, {stack:"广告",data:[220]}, {data:[862]}], 1);
  assert.equal(layout.groups.length, 3);
  assert.deepEqual(layout.rows.map(row => row[0]?.start), [0,0,120,0]);
  assert.equal(Math.max(...layout.bounds), 862);
});
test("正负值在同一个堆积组分别从零累计", () => {
  const layout = layoutBarValues([{stack:"总量",data:[100]}, {stack:"总量",data:[-30]}, {stack:"总量",data:[20]}, {stack:"总量",data:[-40]}], 1);
  assert.deepEqual(layout.rows.map(row => [row[0]?.start,row[0]?.end]), [[0,100],[0,-30],[100,120],[-30,-70]]);
});
test("透明瀑布辅助数据参与累加，缺失数据不生成柱", () => {
  const layout = layoutBarValues([{stack:"总量",data:[1700]}, {stack:"总量",data:[1200]}, {stack:"总量",data:[{value:0,hidden:true}]}], 1);
  assert.equal(layout.rows[1]?.[0]?.end, 2900);
  assert.equal(layout.rows[2]?.[0], null);
});
test("全量堆积覆盖分组设置，显式区间保留起点", () => {
  const layout = layoutBarValues([{data:[10]}, {stack:"另组",data:[20]}, {data:[{start:100,value:5}]}], 1, true);
  assert.equal(layout.groups.length, 1);
  assert.deepEqual(layout.rows.map(row => row[0]?.start), [0,10,100]);
});
