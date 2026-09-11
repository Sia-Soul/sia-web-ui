import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('apps/docs/src/pages/chartScatterCategoryData.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createScatterCategoryData,scatterCategories,scatterCategorySize,scatterCategoryPieces}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const data=createScatterCategoryData(29);
assert.equal(data.length,1000);assert.equal(scatterCategories.length,500);
assert.deepEqual(data,createScatterCategoryData(29));assert.notDeepEqual(data,createScatterCategoryData(30));
for(const category of ['series1','series2'])assert.deepEqual(data.filter(d=>d.category===category).map(d=>d.x),scatterCategories);
for(const d of data){assert.ok(d.y>=0&&d.y<=30);assert.ok(d.value>=0&&d.value<=100);assert.equal(Number(d.y.toFixed(2)),d.y);assert.equal(Number(d.value.toFixed(2)),d.value);assert.equal(scatterCategorySize(d),Math.round(d.value/10));}
assert.equal(scatterCategoryPieces.length,5);assert.equal(scatterCategoryPieces[4].color,'rgb(255,165,0)');assert.equal(scatterCategoryPieces[0].color,'rgb(144,238,144)');
assert.equal(data.filter(d=>d.x>=151&&d.x<=350).length,400);
console.log('类目 1–500、两组 1,000 点、二维随机范围与精度、第三维大小/五段配色及默认 400 点窗口检查通过。');
