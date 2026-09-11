import assert from "node:assert/strict";
import test from "node:test";
import { svgArcPath } from "./arcPath.ts";

test("100% 饼图使用两段圆弧，环图内外反向闭合",()=>{
  const pie=svgArcPath(0,0,100,0,2*Math.PI);
  assert.equal(pie.match(/ A /g)?.length,2);
  const ring=svgArcPath(0,0,100,0,2*Math.PI,50);
  assert.equal(ring.match(/ A /g)?.length,4);
  assert.ok(ring.includes("A 50 50 0 1 0"));
});
test("零帧、无效半径与无效坐标不绘制扇形",()=>{
  assert.equal(svgArcPath(0,0,100,1,1),"");
  assert.equal(svgArcPath(0,0,0,0,1),"");
  assert.equal(svgArcPath(NaN,0,100,0,1),"");
  assert.ok(!/NaN|Infinity/.test(svgArcPath(0,0,100,0,-Math.PI,50,false)));
});
