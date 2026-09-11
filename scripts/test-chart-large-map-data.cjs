const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const source=require('../apps/docs/src/pages/chartLargeMapPointSource.json')[0],places=source.bindings.placeList;
const compiled=ts.transpileModule(fs.readFileSync('apps/docs/src/pages/chartLargeMapPointData.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const loaded={exports:{}};new Function('module','exports',compiled)(loaded,loaded.exports);
const generate=loaded.exports.createLargeMapPointData;
assert.equal(places.length,190);
let calls=0;const data=generate(places,()=>{calls++;return .5;});assert.equal(calls,8000);
assert.deepEqual(data.map(g=>g.data.length),[3000,1000,190]);assert.deepEqual(data.map(g=>g.size),[2,3,6]);
for(const [groupIndex,count] of [3000,1000].entries())for(let i=0;i<count;i++){const len=count-1-i,place=places[len%190],point=data[groupIndex].data[i];assert.equal(point.name,place.name+len);assert.equal(point.value,[10,50][groupIndex]);assert.ok(point.geoCoord.every((v,j)=>Math.abs(v-place.geoCoord[j])<1e-12));}
assert.deepEqual(data[2].data,places.slice().reverse().map(p=>({name:p.name,value:90,geoCoord:p.geoCoord})));
const low=generate(places,()=>0),high=generate(places,()=>1-Number.EPSILON);
for(let g=0;g<2;g++)for(let i=0;i<data[g].data.length;i++){const center=data[g].data[i].geoCoord;assert.ok(Math.abs(low[g].data[i].geoCoord[0]-(center[0]-2.5))<1e-12);assert.ok(Math.abs(low[g].data[i].geoCoord[1]-(center[1]-1.5))<1e-12);assert.ok(high[g].data[i].geoCoord[0]<=center[0]+2.5);assert.ok(high[g].data[i].geoCoord[1]<=center[1]+1.5);}
assert.deepEqual(generate([]),[]);assert.equal(new Set(data[0].data.map(p=>p.name)).size,3000);
console.log('map15：190基础地点、4190点数量、全部名称/逆序/数值、8000次随机调用及坐标扰动边界通过。');
