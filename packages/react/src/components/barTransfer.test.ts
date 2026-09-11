import assert from 'node:assert/strict';
import test from 'node:test';
import {transferBarValue} from './barTransfer.ts';

test('个性化柱子值合并保留目标样式，源变空槽且不修改输入',()=>{
 const source=[{name:'邮件营销',data:[220,232]},{name:'直接访问',data:[{value:390,color:'lime',emphasisColor:'skyBlue'},330]}];
 const before=structuredClone(source);
 const result=transferBarValue(source,{series:0,index:0},{series:1,index:0},['周一','周二']);
 assert.deepEqual(result.series[1]!.data[0],{value:610,color:'lime',emphasisColor:'skyBlue',hidden:false});
 assert.deepEqual(result.series[0]!.data[0],{value:NaN,hidden:true});assert.deepEqual(source,before);
 assert.equal(result.series[1]!.data[1],source[1]!.data[1]);
});
test('缺失槽接收数据后可见，拖出生成孤岛，自投放保留元数据',()=>{
 const source=[{name:'联盟广告',data:[{value:NaN,hidden:true,color:'red'},120]}];
 const filled=transferBarValue(source,{series:0,index:1},{series:0,index:0},['周一','周二']);
 assert.deepEqual(filled.series[0]!.data[0],{value:120,hidden:false,color:'red'});
 const detached=transferBarValue(source,{series:0,index:1},null,['周一','周二']);
 assert.deepEqual(detached.island,{name:'周二',value:120,seriesName:'联盟广告'});
 assert.equal(transferBarValue(source,{series:0,index:1},{series:0,index:1},[]).series[0]!.data[0],source[0]!.data[0]);
 assert.throws(()=>transferBarValue(source,{series:0,index:0},null,[]),/空数据/);
});
test('小数合并精确且溢出不修改输入',()=>{
 const s=[{name:'小数',data:[.1,.2]}];assert.equal(transferBarValue(s,{series:0,index:0},{series:0,index:1},[]).series[0]!.data[1],.3);
 const huge=[{name:'大数',data:[Number.MAX_VALUE,Number.MAX_VALUE]}];assert.throws(()=>transferBarValue(huge,{series:0,index:0},{series:0,index:1},[]),/有限/);assert.equal(huge[0]!.data[0],Number.MAX_VALUE);
});
