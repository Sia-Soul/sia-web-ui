import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync('apps/docs/src/pages/chartWordCloudData.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {chartWordCloudData}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const original=JSON.parse(fs.readFileSync('apps/docs/src/pages/chartWordCloudSource.json','utf8'))[0].option.series[0];
assert.deepEqual(chartWordCloudData,original.data.map(({name,value})=>({name,value})));
assert.equal(chartWordCloudData.length,20);
console.log('字符云全部 20 个原始词条与数值检查通过。');
