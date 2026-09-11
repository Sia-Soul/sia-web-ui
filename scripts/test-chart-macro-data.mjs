import assert from 'node:assert/strict';
import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync('apps/docs/src/pages/chartMacroTimelineData.json','utf8'));
assert.equal(data.provinces.length,31);
assert.equal(new Set(data.provinces).size,31);
assert.equal(data.provinces[0],'北京');
assert.equal(data.provinces[30],'新疆');
assert.deepEqual(Object.keys(data.tables).sort(),['dataEstate','dataFinancial','dataGDP','dataPI','dataSI','dataTI']);
let count=0;
for(const table of Object.values(data.tables)){
 assert.equal(Object.keys(table).length,10);
 for(let year=2002;year<=2011;year++){
  assert.equal(table[year].length,31);
  assert.ok(table[year].every(value=>Number.isFinite(value)&&value>=0));
  count+=table[year].length;
 }
}
assert.equal(count,1860);
assert.equal(data.tables.dataGDP['2002'][0],4315);
assert.equal(data.tables.dataGDP['2011'][18],53210.28);
assert.deepEqual(data.mixes,[{name:'dataGDP_Estate',tables:['dataEstate','dataGDP']}]);
console.log('原站时间轴数据：6 指标 × 10 年 × 31 地区 = 1860 数值，混合坐标顺序及端点通过。');
