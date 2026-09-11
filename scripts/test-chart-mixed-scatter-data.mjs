import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync('apps/docs/src/pages/chartMixedScatterData.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createMixedScatterData}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const calls=[];
const data=createMixedScatterData(()=>{const value=(calls.length%101)/101;calls.push(value);return value;});
assert.equal(calls.length,630);
assert.equal(data.scatter.length,200);assert.equal(data.line.length,30);
assert.deepEqual(data.categories,Array.from({length:30},(_,i)=>`2013-03-${i+1}`));
for(let i=0;i<200;i++){
 const point=data.scatter[i];
 assert.equal(point.x,Math.round(calls[i*3]*29)+1);
 assert.equal(point.y,Number((calls[i*3+1]*30).toFixed(2)));
 assert.equal(point.value,Number((calls[i*3+2]*100).toFixed(2)));
 assert.equal(point.size,Math.round(point.value/10));
}
assert.deepEqual(data.line,calls.slice(600).map(value=>Math.round(value*30)));
const zero=createMixedScatterData(()=>0),high=createMixedScatterData(()=>1-Number.EPSILON);
assert.deepEqual([zero.scatter[0].x,zero.scatter[0].y,zero.scatter[0].value,zero.scatter[0].size],[1,0,0,0]);
assert.deepEqual([high.scatter[0].x,high.scatter[0].y,high.scatter[0].value,high.scatter[0].size],[30,30,100,10]);
console.log('mix4 数据：200 三元组、30 日期/折线、630 次随机调用顺序、原始取整与小数精度、零/最大半径通过。');
