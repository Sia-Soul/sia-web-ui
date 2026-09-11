import assert from 'node:assert/strict';
import test from 'node:test';
import {chartMarkerPath} from './chartMarkerPath.ts';
test('原站水滴、心形、箭头关键控制点',()=>{
 const coordinates=(path:string)=>path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
 const close=(actual:number[],expected:number[])=>{assert.equal(actual.length,expected.length);actual.forEach((n,i)=>assert.ok(Math.abs(n-expected[i]!)<1e-9));};
 close(coordinates(chartMarkerPath('heart',498,129.128,20)).slice(0,8),[498,123.128,503,112.46133333333334,518,128.46133333333336,498,139.128]);
 close(coordinates(chartMarkerPath('droplet',637.1666666666666,295.28,10)).slice(0,8),[637.1666666666666,300.28,642.1666666666666,300.28,644.6666666666666,293.6133333333333,637.1666666666666,287.28]);
 close(coordinates(chartMarkerPath('arrow',80.5,174.02,12)),[80.5,168.02,75.25,180.02,80.5,177.02,85.75,180.02]);
});
test('针形使用大圆弧并以数据坐标为尖端',()=>{const p=chartMarkerPath('pin',776,200,16);assert.ok(p.includes('A 8 8 0 1 1'));assert.ok(p.endsWith('L 776 200 Z'));});
test('scatter 原站极值图钉圆心和箭头顶点',()=>{
 const x=381.935,y=73.916,r=17,cy=48.416;
 assert.equal(chartMarkerPath('pin',x,y,34),`M ${x+r*Math.cos(.8*Math.PI)} ${cy+r*Math.sin(.8*Math.PI)} A 17 17 0 1 1 ${x+r*Math.cos(.2*Math.PI)} ${cy+r*Math.sin(.2*Math.PI)} L 381.935 73.916 Z`);
 const values=chartMarkerPath('arrow',907.985,74.69000000000003,34).match(/-?\d+(?:\.\d+)?/g)!.map(Number);
 [907.985,57.690000000000026,893.11,91.69000000000003,907.985,83.19000000000003,922.86,91.69000000000003].forEach((expected,index)=>assert.ok(Math.abs(values[index]!-expected)<1e-9));
});
