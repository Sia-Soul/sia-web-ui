import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('apps/docs/src/pages/chartScatterBubbleData.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createScatterBubbleData,scatterBubbleSize}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const data=createScatterBubbleData(23);
assert.equal(data.length,200);
assert.deepEqual(data,createScatterBubbleData(23));
assert.notDeepEqual(data,createScatterBubbleData(24));
for(const category of ['scatter1','scatter2'])assert.equal(data.filter(d=>d.category===category).length,100);
for(const d of data){
 for(const n of [d.x,d.y]){assert.ok(Number.isInteger(n)&&n>=-99&&n<=100);assert.ok(n===0||n>0&&n%2===0||n<0&&Math.abs(n)%2===1);}
 assert.ok(Number.isInteger(d.value)&&d.value>=0&&d.value<=100);
 assert.equal(scatterBubbleSize(d),Math.round(d.value/5));
}
assert.equal(scatterBubbleSize({x:0,y:0,value:0}),0);
assert.equal(scatterBubbleSize({x:0,y:0,value:100}),20);
console.log('两组 200 个三维数据、奇负偶正规则、半径映射（含零值）及随机种子复现检查通过。');
