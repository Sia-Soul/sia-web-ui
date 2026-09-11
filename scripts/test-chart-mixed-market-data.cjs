const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const snapshot=require('../apps/docs/src/pages/chartMixedMarketSource.json')[0];
const output=ts.transpileModule(fs.readFileSync('apps/docs/src/pages/chartMixedMarketData.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const loaded={exports:{}};new Function('module','exports','require',output)(loaded,loaded.exports,name=>{
 assert.equal(name,'./chartMixedMarketSource.json');return [snapshot];
});
const {mixedMarketRows:rows,mixedMarketWindow:window}=loaded.exports;
assert.equal(rows.length,88);assert.equal(new Set(rows.map(row=>row.date)).size,88);
assert.equal(rows[0].date,'2013/1/24');assert.equal(rows[87].date,'2013/6/13');
rows.forEach((row,index)=>{
 assert.equal(row.date,snapshot.bindings.axisData[index]);
 assert.deepEqual([row.open,row.close,row.low,row.high],snapshot.option.series[0].data[index]);
 assert.equal(row.amount,snapshot.bindings.option2.series[0].data[index]);
 assert.equal(row.virtual,snapshot.bindings.option3.series[0].data[index]);
 assert.ok([row.open,row.close,row.low,row.high,row.amount,row.virtual].every(Number.isFinite));
 // Historical source anomalies must not be silently normalized.
});
const original=JSON.stringify(rows);
assert.deepEqual(window(rows,[50,100]),rows.slice(44));
assert.deepEqual(window(rows,[100,50]),rows.slice(44));
assert.deepEqual(window(rows,[0,100]),rows);
assert.deepEqual(window(rows,[100,100]),rows.slice(-1));
assert.deepEqual(window(rows,[-10,110]),rows);
assert.deepEqual(window([], [0,100]),[]);
assert.throws(()=>window(rows,[NaN,100]),/有限/);
for(let start=0;start<=100;start+=5){
 const selected=window(rows,[start,Math.min(100,start+20)]);
 for(const row of selected)assert.equal(rows.find(item=>item.date===row.date),row);
}
assert.equal(JSON.stringify(rows),original);
console.log('mix8：88交易日、528原始数值逐项对应、统一50–100窗口、边界/反向范围及无修改通过。');
