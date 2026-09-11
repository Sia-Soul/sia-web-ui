import assert from 'node:assert/strict';
import test from 'node:test';
import {layoutEventRiver,eventRiverOutline} from './eventRiverLayout.ts';
const event=(x:number,weight=1)=>({weight,evolution:[{x,value:1},{x:x+10,value:1}]});
test('闭合样条经过尖起点、尾端及对称中点',()=>{const path=eventRiverOutline([{x:10,thickness:8},{x:20,thickness:4}],50,25);assert.ok(path.startsWith('M10,50 C'));for(const point of ['15,46','22.5,48','25,50','22.5,52','15,54'])assert.ok(path.includes(` ${point}`),point);assert.ok(path.endsWith(' Z'));assert.equal(eventRiverOutline([],0,10),'');});
test('单事件按半厚度避让、保留4像素间距和尾部',()=>{const [item]=layoutEventRiver([{data:[event(10)]}],5,{y:10,height:100});assert.equal(item!.y,46);assert.equal(item!.points[0]!.thickness,64);assert.equal(item!.tailX,25);});
test('重叠事件上下排列，不重叠事件复用高度',()=>{const overlap=layoutEventRiver([{data:[event(10),event(10)]}],5,{y:0,height:100});assert.ok(overlap[1]!.y>overlap[0]!.y);const separate=layoutEventRiver([{data:[event(10),event(30)]}],5,{y:0,height:100});assert.equal(separate[0]!.y,separate[1]!.y);});
test('系列/事件权重排序不修改原始数组',()=>{const input=[{weight:1,data:[event(1),event(1,3)]},{weight:10,data:[event(1)]}],saved=JSON.stringify(input);const result=layoutEventRiver(input,5,{y:0,height:100});assert.deepEqual(result.map(item=>[item.seriesIndex,item.eventIndex]),[[1,0],[0,1],[0,0]]);assert.equal(JSON.stringify(input),saved);});
test('0.8次幂重要性及无效输入边界',()=>{const [item]=layoutEventRiver([{data:[{evolution:[{x:1,value:32}]}]}],5,{y:0,height:100});assert.ok(Math.abs(item!.importance-16)<1e-10);assert.deepEqual(layoutEventRiver([],5,{y:0,height:100}),[]);assert.throws(()=>layoutEventRiver([{data:[{evolution:[{x:0,value:-1}]}]}],5,{y:0,height:100}));});
