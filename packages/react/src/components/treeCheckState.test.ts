import test from 'node:test';
import assert from 'node:assert/strict';
import { getTreeCheckState, toggleTreeCheck } from './treeCheckState.ts';
const nodes = [{key:'root',title:'根',children:[{key:'a',title:'甲'},{key:'b',title:'乙'}]}];
test('回填全部叶子时父节点选中，第一次点击父节点即可取消整组',()=>{
 const state=getTreeCheckState(nodes,['a','b']);assert.equal(state.checked.has('root'),true);
 const next=toggleTreeCheck(nodes,['a','b'],nodes[0]);assert.equal(next.checked.size,0);
});
test('部分叶子回填显示半选，点击半选父节点补齐全部',()=>{
 const state=getTreeCheckState(nodes,['a']);assert.equal(state.halfChecked.has('root'),true);
 const next=toggleTreeCheck(nodes,['a'],nodes[0]);assert.deepEqual([...next.checked].sort(),['a','b','root']);
});
test('受控回调包含父节点时取消单个子项不会被父键重新选回',()=>{
 const next=toggleTreeCheck(nodes,['root','a','b'],nodes[0].children[0]);
 assert.deepEqual([...next.checked],['b']);assert.equal(next.halfChecked.has('root'),true);
});
test('多层祖先全选与半选均向上传递',()=>{
 const data=[{key:'top',title:'顶',children:nodes}];
 assert.equal(getTreeCheckState(data,['a','b']).checked.has('top'),true);
 const state=toggleTreeCheck(data,['top','root','a','b'],nodes[0].children[0]);
 assert.deepEqual([...state.halfChecked].sort(),['root','top']);assert.deepEqual([...state.checked],['b']);
});
test('禁选必选字段保留，父节点取消只影响允许取消的字段',()=>{
 const data=[{key:'root',title:'组',children:[{key:'required',title:'必选',disableCheckbox:true},{key:'optional',title:'可选'}]}];
 const next=toggleTreeCheck(data,['required','optional'],data[0]);assert.deepEqual([...next.checked],['required']);
});
test('禁用分支阻断传播，未知异步键保留',()=>{
 const data=[{key:'root',title:'组',children:[{key:'locked',title:'禁用',disabled:true,children:[{key:'child',title:'子'}]},{key:'a',title:'甲'}]}];
 const state=getTreeCheckState(data,['root','unknown']);assert.equal(state.checked.has('child'),false);assert.equal(state.checked.has('unknown'),true);
});
test('独立勾选模式不影响父子，也不产生半选',()=>{
 assert.deepEqual([...getTreeCheckState(nodes,['root'],true).checked],['root']);
 const next=toggleTreeCheck(nodes,['a'],nodes[0],true);assert.deepEqual([...next.checked],['a','root']);assert.equal(next.halfChecked.size,0);
});
test('checkable=false 的中间分组由其可勾选子项参与汇总',()=>{
 const data=[{key:'root',title:'组',children:[{key:'group',title:'中间',checkable:false,children:[{key:'a',title:'甲'},{key:'b',title:'乙'}]}]}];
 const state=getTreeCheckState(data,['a']);assert.equal(state.halfChecked.has('root'),true);assert.equal(state.checked.has('group'),false);
});
