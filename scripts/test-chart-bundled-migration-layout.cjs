const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const source=require('../apps/docs/src/pages/chartBundledMigrationSource.json')[0],raw=require('../apps/docs/src/pages/chartBundledMigrationData.json');
const code=ts.transpileModule(fs.readFileSync('packages/react/src/components/edgeBundling.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const target={exports:{}};new Function('module','exports',code)(target,target.exports);
const point=name=>{const p=source.bindings.geoCoord[name.split('_').at(-1)];return [p[0]*.75*10,-p[1]*10];};
const edges=raw.allLine.map((line,index)=>({...line,index})).sort((a,b)=>b.num-a.num||a.index-b.index).slice(0,3000).map(line=>({source:point(line.start),target:point(line.end)}));
const snapshot=JSON.stringify(edges),started=performance.now(),output=target.exports.bundleEdges(edges),elapsed=performance.now()-started;
assert.equal(output.length,3000);assert.equal(new Set(output.map(row=>row.index)).size,3000);assert.equal(JSON.stringify(edges),snapshot);
let bent=0,segments=0;const shared=new Map();
for(const row of output){assert.deepEqual(row.points[0],edges[row.index].source);assert.deepEqual(row.points.at(-1),edges[row.index].target);assert.ok(row.points.every(p=>p.every(Number.isFinite)));if(row.points.length>2)bent++;
 for(let i=1;i<row.points.length;i++){const pair=[row.points[i-1].join(','),row.points[i].join(',')].sort().join('|');shared.set(pair,(shared.get(pair)||0)+1);segments++;}
}
assert.ok(bent>1500,'多数实际路线必须参与捆绑，不是普通直线占位');assert.ok([...shared.values()].some(n=>n>=10),'存在多线路真正共享的主干');
console.log(`map22 完整布局：3000路线全部保留、${bent}条多段路线、${segments}段、${[...shared.values()].filter(n=>n>1).length}个共享段、端点/方向/有限性通过；耗时${elapsed.toFixed(1)}ms。`);
