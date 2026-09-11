import assert from 'node:assert/strict';
import test from 'node:test';
import {vennLensPath} from './vennGeometry.ts';
test('韦恩交集为两段封闭圆弧，不使用矩形标签冒充交集',()=>{
 const path=vennLensPath(0,0,10,10,10);assert.equal((path.match(/ A /g)??[]).length,2);assert.ok(path.endsWith(' Z'));assert.ok(path.startsWith('M 5 '));
});
test('包含关系绘制小圆，无交集和无效数据不绘制路径',()=>{
 assert.equal(vennLensPath(0,0,10,5,15),'');assert.equal(vennLensPath(0,0,10,5,NaN),'');assert.ok(vennLensPath(0,0,10,5,2).startsWith('M -3 0'));
});
