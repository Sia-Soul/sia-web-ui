import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
async function fixture(name){
 const js=ts.transpileModule(fs.readFileSync(`apps/docs/src/pages/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
}
const {chartAdditionalFixtures}=await fixture('chartAdditionalFixtures');
const {chartGaugeFixtures}=await fixture('chartGaugeFixtures');
const sources=JSON.parse(fs.readFileSync('apps/docs/src/pages/chartAdditionalSource.json','utf8'));
assert.equal(sources.length,14);
assert.equal(Object.keys(chartAdditionalFixtures).length+Object.keys(chartGaugeFixtures).length,14);
for(const {id,option,url,status} of sources){
 assert.equal(status,200);assert.ok(url.endsWith(`/${id}.html`));
 if(chartGaugeFixtures[id]){
  const data=chartGaugeFixtures[id].data;
  assert.deepEqual(data.map(d=>[d.name,d.value]),option.series.map(s=>[s.data[0].name,s.data[0].value]));
  option.series.forEach((series,index)=>{
   assert.equal(data[index].startAngle,0-(series.startAngle??225));
   assert.equal(data[index].endAngle,0-(series.endAngle??-45));
   assert.equal(data[index].axisWidth,series.axisLine?.lineStyle?.width??10);
  });
 }else{
  const f=chartAdditionalFixtures[id];
  assert.deepEqual(f.legendOrder,option.legend.data);
  if(f.kind==='funnel')assert.deepEqual(f.series.map(s=>s.data.map(d=>[d.name,d.value])),option.series.map(s=>s.data.map(d=>[d.name,d.value])));
  else assert.deepEqual(f.radars.flatMap(p=>p.series.map(s=>[s.name,s.data])),option.series.flatMap(s=>s.data.map(d=>[d.name,d.value])));
 }
 console.log(`PASS ${id}: 原始数值与对应系列一致`);
}
