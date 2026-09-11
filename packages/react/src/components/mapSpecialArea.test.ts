import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSpecialAreaProjection} from './mapSpecialArea.ts';
test('特殊区域顶端对齐、等比例适应，并保持原始坐标不变',()=>{
 const points=[[0,0],[20,10]] as const;
 const projection=createSpecialAreaProjection(points,{left:100,top:50,width:15,height:15},([x,y])=>[x*2,-y*2]);
 assert.deepEqual(projection([0,10]),[200,-100]);
 assert.deepEqual(projection([20,0]),[230,-80]);
 assert.deepEqual(points,[[0,0],[20,10]]);
});
test('窄高区域按高度约束，特殊区域跨日期线兼容与输入检查',()=>{
 const project=createSpecialAreaProjection([[0,0],[10,40]],{left:5,top:5,width:10,height:10},([x,y])=>[x,-y]);
 assert.deepEqual(project([10,0]),[6.875,5]);
 const wrap=createSpecialAreaProjection([[-170,65],[170,60]],{left:0,top:0,width:10,height:10},([x,y])=>[x,-y]);
 assert.deepEqual(wrap([-170,65]),[10,0]);
 assert.throws(()=>createSpecialAreaProjection([],{left:0,top:0,width:1,height:1},p=>p),RangeError);
});
