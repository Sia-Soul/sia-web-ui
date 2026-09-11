const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const output=ts.transpileModule(fs.readFileSync('packages/react/src/components/treeLayout.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const compiled={exports:{}};new Function('module','exports',output)(compiled,compiled.exports);
const root=require('../apps/docs/src/pages/chartPhoneTreeSource.json')[0].option.series[0].data[0];
const actual=compiled.exports.layoutTreeNodes(root,{nodeSize:40,nodePadding:20,rootPosition:[100,378*.6],orientation:'horizontal'});
// Original browser shapeList centers (Float32 positions), not a snapshot of this implementation.
const expected=[[100,226.8000030517578,90,70],[270,106.80000305175781,60,60],[430,66.80000305175781,20,20],[430,106.80000305175781,20,20],[430,146.8000030517578,20,20],[270,186.8000030517578,60,60],[270,266.79998779296875,60,60],[270,346.79998779296875,100,40]];
assert.equal(actual.length,8);actual.forEach((node,index)=>[node.x,node.y,node.width,node.height].forEach((value,column)=>assert.ok(Math.abs(value-expected[index][column])<.0001,`节点${index}坐标/尺寸${column}: ${value}`)));console.log('tree1 原站8节点中心和尺寸匹配通过（容差仅Float32舍入）。');
