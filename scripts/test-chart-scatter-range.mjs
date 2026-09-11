import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('apps/docs/src/pages/chartScatterRangeData.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createScatterRangeData}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const data=createScatterRangeData(37);
assert.equal(data.length,500);assert.deepEqual(data,createScatterRangeData(37));assert.notDeepEqual(data,createScatterRangeData(38));
for(const d of data){assert.ok(d.value>=0&&d.value<=100);assert.ok(d.x>=d.value-.005&&d.x<=2*d.value+.005);assert.ok(d.y>=0&&d.y<=d.value+.005);assert.equal(d.size,5);for(const v of [d.x,d.y,d.value])assert.equal(Number(v.toFixed(2)),v);}
console.log(`500 点相关随机规则与精度通过；值域 50–100 为 ${data.filter(d=>d.value>=50).length} 点。`);
