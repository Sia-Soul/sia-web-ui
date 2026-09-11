import assert from "node:assert/strict";
import test from "node:test";
import { logarithmicScale, logarithmicTicks } from "./chartScales.ts";
test("十进制对数刻度按幂生成而非线性相加",()=>{
  assert.deepEqual(logarithmicTicks([.1,10000]),[.1,1,10,100,1000,10000]);
  assert.equal(Math.round(logarithmicScale(10,[.1,10000],[250,0])),150);
});
test("负值对数轴越负越低，零轴钳制到上边界",()=>{
  assert.deepEqual(logarithmicTicks([-256,-1],2),[-256,-128,-64,-32,-16,-8,-4,-2,-1]);
  assert.equal(logarithmicScale(-256,[-256,-1],[256,0]),256);
  assert.equal(logarithmicScale(-1,[-256,-1],[256,0]),0);
  assert.equal(Math.round(logarithmicScale(-16,[-256,-1],[256,0])),128);
  assert.equal(logarithmicScale(0,[-256,-1],[256,0]),0);
});
test("三进制标签支持指数步长，非法跨零域不生成刻度",()=>{
  const ticks=logarithmicTicks([1/3,3**11],3,3);
  assert.deepEqual(ticks.map(value=>Math.round(Math.log(value)/Math.log(3))),[-1,2,5,8,11]);
  assert.deepEqual(logarithmicTicks([-1,1]),[]);
});
