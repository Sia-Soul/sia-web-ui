const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const file=path.resolve('apps/docs/src/pages/chartMapSwitchData.ts');
const source=require('../apps/docs/src/pages/chartMapSwitchSource.json')[0];
const moduleObject={exports:{}};
const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
new Function('require','module','exports',output)(name=>require(path.resolve(path.dirname(file),name)),moduleObject,moduleObject.exports);
const {mapSwitchTypes,createMapSwitchValues,wheelMapSwitchIndex,clickMapSwitchIndex}=moduleObject.exports;
assert.equal(mapSwitchTypes.length,35);assert.equal(new Set(mapSwitchTypes).size,35);
assert.deepEqual(mapSwitchTypes,source.bindings.mapType);
let draws=0;const data=createMapSwitchValues(()=>draws++/363);
assert.equal(draws,363);assert.deepEqual(data.map(d=>d.name),source.option.series[0].data.map(d=>d.name));
assert.deepEqual(data.map(d=>d.value),Array.from({length:363},(_,i)=>Math.round(i/363*1000)));
for(const item of source.option.series[0].data)assert.equal(item.value.$expression,'Math.round(Math.random()*1000)');
assert.ok(createMapSwitchValues(()=>0).every(d=>d.value===0));assert.ok(createMapSwitchValues(()=>.999999).every(d=>d.value===1000));
for(const value of [-.1,1,NaN,Infinity])assert.throws(()=>createMapSwitchValues(()=>value));
let index=0;
for(let i=0;i<70;i++){index=wheelMapSwitchIndex(index,100);assert.equal(index,(i+1)%35);}
assert.equal(wheelMapSwitchIndex(0,-100),34);assert.equal(wheelMapSwitchIndex(34,100),0);assert.equal(wheelMapSwitchIndex(0,0),0);
for(let i=1;i<35;i++){assert.equal(clickMapSwitchIndex(0,mapSwitchTypes[i]),i);assert.equal(clickMapSwitchIndex(i,'任意市县'),0);}
assert.equal(clickMapSwitchIndex(0,'未知地区'),0);assert.equal(draws,363);
const china=require('../apps/docs/src/pages/chartChinaSource.json').geography;
for(const name of mapSwitchTypes.slice(1)){const feature=china.features.find(f=>f.properties.name===name);assert.ok(feature,name);const geo=require('../apps/docs/src/pages/chartProvinceMaps/'+feature.id+'.json').geography;assert.ok(geo.features.length,name);}
console.log('map3：363次随机值与原始顺序、35地图循环/点击返回、34份真实地理数据可用性通过。');
