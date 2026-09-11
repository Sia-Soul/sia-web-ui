const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const source=require('../apps/docs/src/pages/chartProvinceSelectorCities.json');
const code=ts.transpileModule(fs.readFileSync('apps/docs/src/pages/chartProvinceSelectorData.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const moduleValue={exports:{}};
new Function('require','exports','module',code)(name=>{assert.equal(name,'./chartProvinceSelectorCities.json');return source;},moduleValue.exports,moduleValue);
let calls=0;
const values=moduleValue.exports.createProvinceSelectorValues(()=>{const result=(calls%100)/100;calls++;return result;});
assert.equal(calls,363);assert.equal(values.length,363);assert.equal(new Set(values.map(item=>item.name)).size,363);
values.forEach((item,index)=>{assert.equal(item.name,source.names[index]);assert.equal(item.value,Math.round(index%100/100*1000));});
assert.ok(moduleValue.exports.createProvinceSelectorValues(()=>0).every(item=>item.value===0));
assert.ok(moduleValue.exports.createProvinceSelectorValues(()=>1-Number.EPSILON).every(item=>item.value===1000));
const china=require('../apps/docs/src/pages/chartChinaSource.json').geography;
let regions=0,points=0;
for(const province of china.features){
 const file=JSON.parse(fs.readFileSync(`apps/docs/src/pages/chartProvinceMaps/${province.id}.json`,'utf8'));
 assert.equal(file.module,`${province.id}_geo`);
 assert.ok(file.geography.features.length>0,province.properties.name);
 for(const region of file.geography.features){
  assert.ok(region.properties.name);regions++;
  const rings=region.geometry.type==='Polygon'?region.geometry.coordinates:region.geometry.coordinates.flat();
  for(const ring of rings){assert.ok(ring.length>=3);for(const point of ring){assert.equal(point.length,2);assert.ok(point.every(Number.isFinite));points++;}}
 }
}
console.log(`mix5 数据：363 个原始名称及随机调用顺序，34 份原始省级地图、${regions} 个区域、${points} 个坐标点通过。`);
