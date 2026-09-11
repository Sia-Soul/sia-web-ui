import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('apps/docs/src/pages/chartChordData.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {chordReferenceNames:names,chordReferenceMatrix:matrix}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const [{option}]=JSON.parse(fs.readFileSync('apps/docs/src/pages/chartChordSource.json','utf8'));
assert.deepEqual(matrix,option.series[0].matrix);assert.deepEqual(names,option.series[0].data.map(d=>d.name));
assert.equal(matrix.flat().length,16);assert.equal(matrix.flat().reduce((sum,v)=>sum+v,0),100000);
console.log('chord1 的 4 个原始分组与 16 个矩阵数值逐项一致，总权重 100,000。');
