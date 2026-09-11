import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=path=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const dependency='data:text/javascript;base64,'+Buffer.from(compile('apps/docs/src/pages/chartTreeRoamFixture.ts')).toString('base64');
const source=compile('apps/docs/src/pages/chartTreeFixtures.ts').replace('./chartTreeRoamFixture',dependency);
const {chartTreeFixtures}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const originals=JSON.parse(fs.readFileSync('apps/docs/src/pages/chartTreeSource.json','utf8'));
for(const original of originals){
 const fixture=chartTreeFixtures[original.id],series=original.option.series[0];
 assert.deepEqual(fixture.data,series.data[0]);
 assert.equal(fixture.orientation,series.orient);
 assert.equal(fixture.title,original.option.title.text);
 assert.equal(fixture.description,original.option.title.subtext);
 assert.equal(fixture.nodePadding,series.nodePadding);
 assert.equal(fixture.edgeColor,series.itemStyle.normal.lineStyle.color);
 assert.equal(fixture.linkStyle,series.itemStyle.normal.lineStyle.type);
 assert.equal(fixture.showLabels,series.itemStyle.normal.label.show);
 assert.equal(fixture.emphasisShowLabels,series.itemStyle.emphasis.label.show);
 assert.equal(fixture.rootPosition[1],series.rootLocation.y);
 assert.equal(fixture.edgeShadow.blur,series.itemStyle.normal.lineStyle.shadowBlur);
}
console.log(`树图原始层级数据与关键配置检查通过：${originals.length} 页。`);
const originalRoam=JSON.parse(fs.readFileSync('apps/docs/src/pages/chartTreeRoamSource.json','utf8'))[0].option.series[0],roam=chartTreeFixtures.tree2;
assert.deepEqual(roam.data,originalRoam.data[0]);
assert.equal(roam.roam,originalRoam.roam);assert.equal(roam.hoverable,originalRoam.hoverable);
assert.equal(roam.nodeSize,originalRoam.symbolSize);assert.equal(roam.nodePadding,originalRoam.nodePadding);assert.equal(roam.layerPadding,originalRoam.layerPadding);
assert.equal(roam.labelFontSize,originalRoam.itemStyle.normal.label.textStyle.fontSize);
function count(node){return 1+(node.children??[]).reduce((sum,child)=>sum+count(child),0);}
console.log(`大树漫游原始数据验证通过：${count(roam.data)} 个节点（保留同名节点、空格及完整层级）。`);
