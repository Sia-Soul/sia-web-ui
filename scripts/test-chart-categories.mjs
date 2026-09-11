import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

async function load(path) {
 const source=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
const {chartCategories,chartCategoryForUrl}=await load('apps/docs/src/pages/chartCategories.ts');
const {chartReferenceExamples}=await load('apps/docs/src/pages/chartReferenceExamples.ts');
assert.equal(chartCategories.length,21);
assert.equal(new Set(chartCategories.map(x=>x.id)).size,21);
assert.equal(new Set(chartCategories.map(x=>x.path)).size,21);
for(const [id,category] of Object.entries({bar15:'bar',line11:'line',pie7:'pie',gauge5:'gauge',treemap2:'treemap',tree1:'tree',lasagna:'pie',wormhole:'radar',dataRange1:'scatter',heatmap_map:'heatmap',event:'dynamic',theme:'dynamic',dynamic1:'dynamic',axis:'components'})) {
 assert.equal(chartCategoryForUrl(`http://static.dtws110.com/echarts-2.2.7/doc/example/${id}.html`),category,id);
}
const counts={};
for(const entry of chartReferenceExamples) {
 const category=chartCategoryForUrl(entry.url);
 assert.ok(chartCategories.some(x=>x.id===category),entry.url);
 counts[category]=(counts[category]??0)+1;
}
assert.equal(Object.values(counts).reduce((sum,n)=>sum+n,0),chartReferenceExamples.length);
console.log(`分类检查通过：${chartCategories.length} 个分类，${chartReferenceExamples.length} 个示例均有唯一归属。`,counts);
