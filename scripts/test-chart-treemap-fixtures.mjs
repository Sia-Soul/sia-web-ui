import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync('apps/docs/src/pages/chartTreemapFixtures.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {chartTreemapFixtures}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const originals=JSON.parse(fs.readFileSync('apps/docs/src/pages/chartTreemapSource.json','utf8'));
function checkStyle(actual,expected){
 if(!expected)return;
 for(const [key,value] of Object.entries(expected)) {
  if(key==='label'){
   for(const [k,v] of Object.entries(value)) {
    if(k==='textStyle'){for(const [textKey,textValue] of Object.entries(v))assert.equal(actual.label[textKey],textValue);}
    else assert.equal(actual.label[k],v);
   }
  }else assert.deepEqual(actual[key],value);
 }
}
let nodeCount=0;
function checkNodes(actual,expected){
 assert.equal(actual.length,expected.length);
 expected.forEach((node,index)=>{
  const local=actual[index];nodeCount++;
  assert.equal(local.name,node.name);assert.equal(local.value,node.value);
  checkStyle(local.style,node.itemStyle?.normal);checkStyle(local.emphasis,node.itemStyle?.emphasis);
  if(node.children)checkNodes(local.children,node.children);
 });
}
for(const original of originals){
 const local=chartTreemapFixtures[original.id],series=original.option.series[0];
 assert.equal(local.title,original.option.title.text);
 assert.equal(local.description,original.option.title.subtext);
 checkNodes(local.data,series.data);
 checkStyle(local.itemStyle,series.itemStyle.normal);checkStyle(local.emphasis,series.itemStyle.emphasis);
}
console.log(`矩形树图原始配置验证通过：${originals.length} 页、${nodeCount} 个层级节点，含普通与强调样式。`);
