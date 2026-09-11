const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const output=ts.transpileModule(fs.readFileSync('apps/docs/src/pages/chartMixedPieScatterData.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const loaded={exports:{}};new Function('module','exports',output)(loaded,loaded.exports);
const {createMixedPieScatterData,mixedPieScatterGlyphs}=loaded.exports;
let calls=0;const data=createMixedPieScatterData(()=>{const n=calls++;return n<200?[.2,.6,.3,.5,.75][n%5]:.4;});
assert.equal(calls,240);assert.equal(data.first.length,40);assert.equal(data.second.length,40);
for(let i=0;i<40;i++){assert.deepEqual(data.first[i],[2,-3,15]);assert.deepEqual(data.second[i],[2,-3,6]);}
const glyphs=mixedPieScatterGlyphs(data);assert.deepEqual(glyphs.map(g=>g.index),Array.from({length:40},(_,i)=>39-i));
for(const g of glyphs){assert.equal(g.radius,21);assert.deepEqual(g.values,[15,6]);}
for(const random of [()=>0,()=>1]){
 const d=createMixedPieScatterData(random),g=mixedPieScatterGlyphs(d);
 assert.equal(g[0].radius,random()===0?0:35);
 assert.ok(d.first.every((p,i)=>p[0]===d.second[i][0]&&p[1]===d.second[i][1]));
}
console.log('mix7：两组各40点、240次随机调用顺序、共用坐标、倒序绘制、半径求和与0/35边界通过。');
