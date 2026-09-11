const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const world=require('../apps/docs/src/pages/chartWorldSource.json'),source=require('../apps/docs/src/pages/chartWorldPopulationSource.json')[0];
assert.equal(world.module,'world_geo');assert.equal(world.geography.features.length,177);
const data=source.option.series[0].data;assert.equal(data.length,177);assert.equal(new Set(data.map(d=>d.name)).size,177);
assert.deepEqual(world.geography.features.map(f=>f.properties.name).sort(),data.map(d=>d.name).sort());
let points=0;
for(const feature of world.geography.features){
 assert.ok(['Polygon','MultiPolygon'].includes(feature.geometry.type));
 const coordinates=feature.geometry.type==='Polygon'?feature.geometry.coordinates.flat():feature.geometry.coordinates.flat(2);
 assert.ok(coordinates.length);points+=coordinates.length;
 for(const [x,y] of coordinates)assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&x>=-180&&x<=180&&y>=-90&&y<=90);
}
for(const datum of data)assert.ok(Number.isFinite(datum.value));
assert.equal(data.find(d=>d.name==='China').value,1359821.465);
assert.equal(data.find(d=>d.name==='India').value,1205624.648);
// Preserve source anomalies, not silently replace them with current population figures.
assert.equal(data.find(d=>d.name==='Russia').value,21861.476);
const file=path.resolve('apps/docs/src/pages/chartWorldPopulationData.ts'),mod={exports:{}};
const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
new Function('require','module','exports',output)(name=>require(path.resolve(path.dirname(file),name)),mod,mod.exports);
assert.deepEqual(mod.exports.worldPopulationData,data);
assert.equal(mod.exports.formatWorldPopulation(1359821.465),'1,359,821.465');
assert.equal(mod.exports.formatWorldPopulation(1000),'1,000.undefined');
assert.equal(mod.exports.formatWorldPopulation('-'),'-.undefined');
console.log(`map4：177项原始人口值、177区域、${points}个有效地理坐标及原始提示格式通过。`);
