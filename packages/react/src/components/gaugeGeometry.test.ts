import assert from "node:assert/strict";
import test from "node:test";
import {gaugePointerPoints} from "./gaugeGeometry.ts";
test("仪表指针配置宽度是半宽，窄指针后跟为两倍宽",()=>{
 assert.deepEqual(gaugePointerPoints([10,20],0,100,5),[[0,20],[10,15],[110,20],[10,25]]);
});
test("宽指针后跟和旋转保持相同几何规则",()=>{
 const p=gaugePointerPoints([0,0],Math.PI/2,90,40);
 assert.ok(Math.abs(p[0]![1]+40)<1e-10);assert.ok(Math.abs(p[2]![1]-90)<1e-10);
 assert.equal(p[1]![0],40);assert.equal(p[3]![0],-40);
});
test("无效指针尺寸不输出无效坐标",()=>{
 assert.deepEqual(gaugePointerPoints([0,0],0,-1,5),[]);
 assert.deepEqual(gaugePointerPoints([NaN,0],0,10,5),[]);
});
