import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutTreeNodes} from './treeLayout.ts';
test('树图节点顺序、父子索引和层距保持确定',()=>{
 const data={children:[{children:[{},{}]},{children:[{},{}]}]};
 const points=layoutTreeNodes(data,{nodePadding:1,rootPosition:[300,50]});
 assert.equal(points.length,7);assert.deepEqual(points.map(p=>p.parent),[undefined,0,1,1,0,4,4]);
 assert.deepEqual(points.map(p=>p.y),[50,170,290,290,170,290,290]);
 assert.equal(points[0]!.x,300);
 for(const depth of [1,2]){const layer=points.filter(p=>p.depth===depth);for(let i=1;i<layer.length;i++)assert.ok(layer[i]!.x-layer[i-1]!.x>=21);}
});
test('水平树支持不同尺寸，根节点锚点固定',()=>{
 const points=layoutTreeNodes({symbolSize:[90,70],children:[{symbolSize:60},{}]},{orientation:'horizontal',rootPosition:[100,230]});
 assert.deepEqual([points[0]!.x,points[0]!.y],[100,230]);
 assert.equal(points[1]!.x,270);assert.equal(points[2]!.x,270);
 assert.equal(points[1]!.width,60);
});
test('重复名称不参与布局身份，单根布局不产生非法坐标',()=>{
 const p=layoutTreeNodes({});assert.equal(p.length,1);assert.deepEqual([p[0]!.x,p[0]!.y],[0,0]);
});
