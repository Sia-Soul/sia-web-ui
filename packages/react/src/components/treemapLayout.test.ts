import assert from "node:assert/strict";
import test from "node:test";
import {layoutTreemapValues} from "./treemapLayout.ts";
test("矩形图保持原始顺序与面积比例，不改变输入",()=>{
 const values=[6,4,4,2,2,1,1],before=[...values];
 const cells=layoutTreemapValues(values,{x:10,y:20,width:530.4,height:303.2});
 assert.deepEqual(values,before);assert.deepEqual(cells.map(c=>c.index),[0,1,2,3,4,5,6]);
 cells.forEach((cell,index)=>assert.ok(Math.abs(cell.width*cell.height-530.4*303.2*values[index]!/20)<1e-7));
 assert.equal(cells[0]!.x,cells[1]!.x);
 assert.ok(cells[2]!.x>cells[0]!.x);
});
test("矩形图边界内无重叠、无空洞",()=>{
 const cells=layoutTreemapValues([2,7,1,3,6,8,2,1],{x:0,y:0,width:300,height:500});
 cells.forEach((a,i)=>{
  assert.ok(a.x>=0&&a.y>=0&&a.x+a.width<=300+1e-8&&a.y+a.height<=500+1e-8);
  cells.slice(i+1).forEach(b=>assert.ok(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)<1e-8||Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)<1e-8));
 });
 assert.ok(Math.abs(cells.reduce((sum,c)=>sum+c.width*c.height,0)-150000)<1e-7);
});
test("零值与非法值不占面积，单一正值占满绘图区",()=>{
 assert.deepEqual(layoutTreemapValues([0,NaN,-1,Infinity,5],{x:2,y:3,width:10,height:20}),[{index:4,value:5,x:2,y:3,width:10,height:20}]);
 assert.deepEqual(layoutTreemapValues([0,0],{x:0,y:0,width:10,height:20}),[]);
});
test("极大有限权重归一化后仍保持面积",()=>{
 const cells=layoutTreemapValues([1e308,1e308],{x:0,y:0,width:100,height:100});
 assert.equal(cells.length,2);assert.equal(cells[0]!.width*cells[0]!.height,5000);
});
