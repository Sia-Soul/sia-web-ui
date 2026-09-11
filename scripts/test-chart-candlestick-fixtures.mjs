import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync('apps/docs/src/pages/chartCandlestickFixtures.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {chartCandlestickFixtures}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const originals=JSON.parse(fs.readFileSync('apps/docs/src/pages/chartCandlestickSource.json','utf8'));
for(const original of originals){
 const fixture=chartCandlestickFixtures[original.id],option=original.option,series=option.series[0];
 assert.equal(fixture.data.length,88);
 assert.deepEqual(fixture.data.map(d=>[d.open,d.close,d.low,d.high]),series.data.map(d=>Array.isArray(d)?d:d.value));
 assert.deepEqual(fixture.data.map(d=>d.name),option.xAxis[0].data);
 assert.deepEqual(fixture.defaultZoom,[option.dataZoom.start,option.dataZoom.end]);
 assert.equal(fixture.title,option.title?.text);
 if(original.id==='k'){
  assert.equal(fixture.risingColor,series.itemStyle.normal.color);assert.equal(fixture.fallingColor,series.itemStyle.normal.color0);
  assert.equal(fixture.risingBorderColor,series.itemStyle.normal.lineStyle.color);assert.equal(fixture.fallingBorderColor,series.itemStyle.normal.lineStyle.color0);
  assert.equal(fixture.data[0].color,series.data[0].itemStyle.normal.color0);
  assert.equal(fixture.markPoints[0].value,series.markPoint.data[0].value);assert.equal(fixture.markPoints[0].y,series.markPoint.data[0].yAxis);
 }
}
console.log('K 线两页各 88 条 OHLC、全部日期、初始范围、标题、个性化样式及星形标注检查通过。');
