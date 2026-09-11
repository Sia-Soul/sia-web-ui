import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveTreeItemStyle} from './treeStyles.ts';
test('树节点强调样式逐字段继承，false 和零值不会被丢失',()=>{
 const result=resolveTreeItemStyle({color:'orange',borderWidth:2,label:{show:true,color:'pink',position:'inside'}},{label:{position:'right'}},{label:{show:true}},{borderWidth:0,label:{show:false}},true);
 assert.equal(result.borderWidth,0);assert.deepEqual(result.label,{show:false,color:'pink',position:'right'});assert.equal(result.color,'orange');
});
test('非强调状态不会应用强调颜色或修改输入',()=>{
 const normal={color:'orange',label:{show:false}};
 assert.equal(resolveTreeItemStyle(normal,undefined,{color:'blue'},undefined,false).color,'orange');
 assert.deepEqual(normal,{color:'orange',label:{show:false}});
});
