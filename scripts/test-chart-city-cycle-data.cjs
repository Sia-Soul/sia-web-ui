const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),{execFileSync}=require('node:child_process');
const source=require('../apps/docs/src/pages/chartCityCycleSource.json');
const online=JSON.parse(execFileSync(process.execPath,['scripts/inspect-chart-references.mjs','--options','--bindings=cityMap','--match=^map20$'],{encoding:'utf8'}));assert.deepEqual(online,source);
const code=ts.transpileModule(fs.readFileSync('apps/docs/src/pages/chartCityCycleData.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const target={exports:{}};new Function('module','exports','require',code)(target,target.exports,()=>({default:source}));const {cityCycleEntries,cityCycleNext}=target.exports;
assert.equal(cityCycleEntries.length,344);assert.equal(new Set(cityCycleEntries.map(entry=>entry[1])).size,344);assert.deepEqual(cityCycleEntries[0],['北京市','110100']);assert.deepEqual(cityCycleEntries.at(-1),['澳门特别行政区','820000']);
let regions=0,points=0;
for(const [i,[name,id]] of cityCycleEntries.entries()){
 const geo=JSON.parse(fs.readFileSync(`apps/docs/src/pages/chartCityMaps/${id}.json`,'utf8'));assert.equal(geo.type,'FeatureCollection');assert.ok(geo.features.length>0,name);
 for(const f of geo.features){regions++;assert.equal(typeof f.properties.name,'string');assert.ok(['Polygon','MultiPolygon'].includes(f.geometry.type));const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;for(const polygon of polygons)for(const ring of polygon){assert.ok(ring.length>=3);for(const point of ring){points++;assert.ok(point.length>=2&&point.every(Number.isFinite),name);}}}
 assert.equal(cityCycleNext(i,1),(i+1)%344);assert.equal(cityCycleNext(i,-1),(i+343)%344);assert.equal(cityCycleNext(i,0),i);
}
assert.throws(()=>cityCycleNext(-1,1),RangeError);assert.throws(()=>cityCycleNext(344,1),RangeError);assert.equal(cityCycleNext(0,NaN),0);
(async()=>{for(const id of ['110100','310200','429000','522200','522400','820000']){const response=await fetch(`http://static.dtws110.com/echarts-2.2.7/doc/example/geoJson/china-main-city/${id}.json`);assert.ok(response.ok);assert.deepEqual(await response.json(),JSON.parse(fs.readFileSync(`apps/docs/src/pages/chartCityMaps/${id}.json`,'utf8')));}console.log(`map20 数据：344 原顺序入口、${regions} 区域、${points} 坐标点、完整目录/配置线上复核、六份边界复核与循环规则通过；未注册。`);})().catch(error=>{console.error(error);process.exitCode=1;});
