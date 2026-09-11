import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync('packages/react/src/components/mapProjection.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {fitMapBounds}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
for(const plot of [{x:20,y:30,width:500,height:350},{x:20,y:30,width:200,height:600}]){
 const fit=fitMapBounds({minX:70,maxX:135,minY:15,maxY:55},plot,.75);
 assert.ok(Math.abs((fit.width/65)/(fit.height/40)-.75)<1e-9);
 assert.ok(fit.width<=plot.width+1e-9&&fit.height<=plot.height+1e-9);
 assert.ok(Math.abs(fit.x+fit.width/2-(plot.x+plot.width/2))<1e-9);
 assert.ok(Math.abs(fit.y+fit.height/2-(plot.y+plot.height/2))<1e-9);
}
assert.throws(()=>fitMapBounds({minX:0,maxX:1,minY:0,maxY:1},{x:0,y:0,width:10,height:10},0));
const map=JSON.parse(fs.readFileSync('apps/docs/src/pages/chartChinaSource.json','utf8')).geography;
const data=JSON.parse(fs.readFileSync('apps/docs/src/pages/chartMixedGdpSource.json','utf8'))[0].option.series[0].data;
assert.equal(map.features.length,34);assert.equal(data.length,31);
for(const item of data)assert.ok(map.features.some(feature=>feature.properties.name===item.name));
console.log('地图比例：横/纵受限适配、0.75 经纬比例、居中、非法比例、34 区域覆盖 31 GDP 数据通过。');
