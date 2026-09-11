import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
async function load(file){const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));}
const {createReferenceHeatData,customHeatGradient}=await load('apps/docs/src/pages/chartHeatmapData.ts');
const {rasterizeHeatmap}=await load('packages/react/src/components/heatmapRaster.ts');
const data=createReferenceHeatData(41);assert.equal(data.length,320);assert.deepEqual(data,createReferenceHeatData(41));assert.notDeepEqual(data,createReferenceHeatData(42));
for(const [i,p] of data.entries()){
 const [xmin,xmax,ymin,ymax,vmax]=i<20?[400,700,5,15,1]:i<120?[100,700,150,200,1]:[0,1000,0,800,.5];
 assert.ok(p.x>=xmin&&p.x<=xmax&&p.y>=ymin&&p.y<=ymax&&p.value>=0&&p.value<=vmax);
}
assert.ok(data.some(p=>p.x>663||p.y>379));
const plain=rasterizeHeatmap(663,379,data),custom=rasterizeHeatmap(663,379,data,{gradient:customHeatGradient,minAlpha:.2,valueScale:2,opacity:.6});
assert.equal(plain.length,663*379*4);assert.notDeepEqual(plain,custom);
for(let i=3;i<custom.length;i+=4)assert.ok(custom[i]<=153);
assert.ok(plain.some(v=>v>0));
console.log('两页 320 个三区域原公式热点、保留越界坐标、自定义透明度上限和差异化渐变渲染检查通过。');
