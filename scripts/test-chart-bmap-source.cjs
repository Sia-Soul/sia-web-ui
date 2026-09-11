const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const saved=require('../apps/docs/src/pages/chartBMapSource.json');
const current=JSON.parse(execFileSync(process.execPath,['scripts/inspect-chart-bmap-source.mjs'],{encoding:'utf8'}));
assert.deepEqual(saved,current);
for(const page of saved){
 const series=page.bindings.option.series,coordinates=Object.assign({},...series.map(s=>s.geoCoord));
 assert.deepEqual(series.map(s=>s.markLine.data.length),[10,10,10,150]);
 assert.deepEqual(series.slice(0,3).map(s=>s.markPoint.data.length),[10,10,10]);
 for(const s of series){
  for(const line of s.markLine.data)for(const endpoint of line){assert.ok(coordinates[endpoint.name],`${page.id}: ${endpoint.name}`);assert.ok(coordinates[endpoint.name].every(Number.isFinite));}
  for(const point of s.markPoint?.data??[]){assert.ok(coordinates[point.name]);assert.ok(Number.isFinite(point.value));}
 }
 assert.deepEqual(page.bindings.startPoint,{x:104.114129,y:37.550339});
 assert.equal(page.calls.find(c=>c.method==='map.centerAndZoom').arguments[1],5);
}
assert.equal(saved[0].calls.some(c=>c.method==='map.setMapStyle'),false);
assert.equal(saved[1].calls.find(c=>c.method==='map.setMapStyle').arguments[0].styleJson.length,18);
console.log('BMap 两页原始配置深比较、各 180 路/30 点坐标、中心/缩放及独立 18 项底图样式通过；未注册。');
