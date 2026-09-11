import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
async function moduleFromFile(path){
 const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
const {scatterDistributionData:data}=await moduleFromFile('apps/docs/src/pages/chartScatterDistributionData.ts');
const {scatterStatistics}=await moduleFromFile('packages/react/src/components/scatterStatistics.ts');
const [{option}]=JSON.parse(fs.readFileSync('apps/docs/src/pages/chartScatterDistributionSource.json','utf8'));
assert.deepEqual(data,option.series.flatMap(series=>series.data.map(([x,y],i)=>({name:`${series.name} ${i+1}`,category:series.name,x,y,size:4}))));
assert.equal(data.length,507);
const stats=scatterStatistics(data,true);
assert.deepEqual(stats.map(s=>[s.category,s.count,s.minY,s.maxY,Number(s.averageY.toFixed(2))]),[['女性',260,42,105.2,60.6],['男性',247,53.9,116.4,78.14]]);
assert.deepEqual(scatterStatistics(data.filter(d=>d.category==='男性'),true),[stats[1]]);
console.log('507 个原站坐标逐点一致；女性 260 / 男性 247，分组极值、均值及图例过滤统计检查通过。');
