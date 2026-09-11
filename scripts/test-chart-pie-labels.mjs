import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync('packages/react/src/components/pieLabelLayout.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {layoutPieLabelY}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const anchors=Array.from({length:31},(_,i)=>({y:170+Math.sin(i)*5,right:i%2===0,visible:true}));
const original=JSON.stringify(anchors),ys=layoutPieLabelY(anchors,20,340,18);
for(const right of [false,true]){
 const side=ys.filter((_,i)=>anchors[i].right===right).sort((a,b)=>a-b);
 assert.ok(side[0]>=20&&side.at(-1)<=340);
 for(let i=1;i<side.length;i++)assert.ok(side[i]-side[i-1]>=18-1e-9);
}
assert.equal(JSON.stringify(anchors),original);
assert.deepEqual(layoutPieLabelY([],0,10),[]);
assert.deepEqual(layoutPieLabelY([{y:99,right:true,visible:true}],0,10),[10]);
assert.deepEqual(layoutPieLabelY([{y:99,right:true,visible:false}],0,10),[99]);
assert.deepEqual(layoutPieLabelY([{y:9,right:true,visible:true},{y:9,right:true,visible:true},{y:9,right:true,visible:true}],0,10,18),[0,5,10]);
assert.throws(()=>layoutPieLabelY([],10,0),/范围/);
console.log('饼图标签：31 项双侧避让、边界、输入不变、空值、隐藏项和过密降间距通过。');
