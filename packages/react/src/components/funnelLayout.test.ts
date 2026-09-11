import assert from "node:assert/strict";
import test from "node:test";
import {layoutFunnelValues} from "./funnelLayout.ts";
const box={left:0,top:0,width:100,height:100};
test("漏斗按固定数值域映射，底部收至零且保留原始索引",()=>{
 const items=layoutFunnelValues([60,40,20,80,100],box);
 assert.deepEqual(items.map(x=>x.index),[4,3,0,1,2]);
 assert.deepEqual(items[4]!.points,[[40,80],[60,80],[50,100],[50,100]]);
 assert.equal(layoutFunnelValues([50],box)[0]!.points[0]![0],25);
});
test("金字塔从零宽起始，最终到达最大宽",()=>{
 const items=layoutFunnelValues([60,20,100],{...box,sort:"ascending",align:"right"});
 assert.deepEqual(items[0]!.points.slice(0,2),[[100,0],[100,0]]);
 assert.deepEqual(items[2]!.points.slice(2),[[100,100],[0,100]]);
});
test("漏斗间隙、最大宽度比例和非法数据",()=>{
 const items=layoutFunnelValues([100,50,NaN],{...box,gap:10,maxSize:.8,align:"left"});
 assert.equal(items.length,2);assert.equal(items[0]!.points[1]![0],80);
 assert.equal(items[1]!.points[0]![1],55);
 assert.deepEqual(layoutFunnelValues([],box),[]);
});
