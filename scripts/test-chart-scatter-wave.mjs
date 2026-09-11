import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync('apps/docs/src/pages/chartScatterWaveData.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createScatterWaveData}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const data=createScatterWaveData(17);
assert.equal(data.length,20000);assert.equal(data.filter(d=>d.category==='sin').length,10000);assert.equal(data.filter(d=>d.category==='cos').length,10000);
assert.deepEqual(data,createScatterWaveData(17));assert.notDeepEqual(data,createScatterWaveData(18));
data.forEach((point,index)=>{
 assert.ok(point.x>=0&&point.x<=10);
 const baseline=point.category==='sin'?Math.sin(point.x):Math.cos(point.x),remaining=9999-index%10000;
 assert.ok(Math.abs(point.y-baseline)<=point.x*.1+.00051);
 assert.ok(remaining%2?point.y<=baseline+.00051:point.y>=baseline-.00051);
});
console.log('正弦/余弦两组各 10,000 点、交替扰动方向、数值范围和种子复现检查通过。');
