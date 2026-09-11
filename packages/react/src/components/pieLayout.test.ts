import assert from "node:assert/strict";
import test from "node:test";
import { layoutPieValues } from "./pieLayout.ts";

test("饼图占比闭合为整圆，不修改输入",()=>{
  const values=[335,310,234,135,1548];
  const result=layoutPieValues(values,{innerRadius:0,outerRadius:100});
  assert.ok(Math.abs(result.at(-1)!.end-result[0]!.start-2*Math.PI)<1e-10);
  assert.equal(result[0]!.fraction,335/2562);
  assert.deepEqual(values,[335,310,234,135,1548]);
});
test("玫瑰面积模式各扇区等角，半径按平方根映射",()=>{
  const result=layoutPieValues([10,40],{innerRadius:30,outerRadius:110,rose:"area"});
  assert.equal(result[0]!.sweep,Math.PI);
  assert.equal(result[1]!.sweep,Math.PI);
  assert.equal(result[0]!.radius,70);
  assert.equal(result[1]!.radius,110);
});
test("玫瑰半径模式保留 20% 基础半径和比例角度",()=>{
  const result=layoutPieValues([0,10,40],{innerRadius:20,outerRadius:110,rose:"radius"});
  assert.equal(result[0]!.radius,38);
  assert.equal(result[1]!.radius,56);
  assert.ok(Math.abs(result[2]!.sweep/result[1]!.sweep-4)<1e-10);
});
test("逆时针、间隙及非法值不产生无效几何",()=>{
  const result=layoutPieValues([5,-3,NaN,Infinity,5],{innerRadius:10,outerRadius:20,clockwise:false,padAngle:5});
  assert.ok(result[0]!.end<result[0]!.start);
  assert.ok(result.every(item=>Object.values(item).every(Number.isFinite)));
  assert.equal(result[1]!.sweep,0);
  assert.ok(layoutPieValues([0,0],{innerRadius:0,outerRadius:100,rose:"area"}).every(item=>item.sweep===0));
});
