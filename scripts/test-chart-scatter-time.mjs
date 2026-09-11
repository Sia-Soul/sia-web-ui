import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('apps/docs/src/pages/chartScatterTimeData.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createScatterTimeData,scatterTimeLabel}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const data=createScatterTimeData(31),base=new Date(2014,9,1).getTime();
assert.equal(data.length,1500);assert.deepEqual(data,createScatterTimeData(31));assert.notDeepEqual(data,createScatterTimeData(32));
for(const d of data){assert.equal(d.category,'series1');assert.ok(d.x>=base&&d.x<=base+10000*60000);assert.equal((d.x-base)%60000,0);assert.ok(d.y>=0&&d.y<=30);assert.ok(d.value>=0&&d.value<=100);assert.equal(Number(d.y.toFixed(2)),d.y);assert.equal(Number(d.value.toFixed(2)),d.value);}
const min=Math.min(...data.map(d=>d.x)),max=Math.max(...data.map(d=>d.x));
const visible=data.filter(d=>d.x>=min+(max-min)*.3&&d.x<=min+(max-min)*.7);
assert.notEqual(visible.length,600,'Uneven time density must not become a fixed 40% point slice');
assert.equal(scatterTimeLabel(new Date(2014,9,2,3,4).getTime()),'10/2 03:04');
console.log(`1,500 个原公式时间点、分钟精度/数据范围/种子复现检查通过；默认时间窗口 ${visible.length} 点。`);
