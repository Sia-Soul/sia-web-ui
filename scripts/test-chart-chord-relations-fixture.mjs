import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const saved=JSON.parse(fs.readFileSync('apps/docs/src/pages/chartChordRelationsSource.json','utf8'));
const [live]=JSON.parse(execFileSync(process.execPath,['scripts/inspect-chart-references.mjs','--options','--match=^chord2$'],{encoding:'utf8'}));
assert.equal(live.status,200);
assert.deepEqual(saved.option,live.option);
assert.deepEqual(saved.option.series.map(s=>s.matrix.flat().reduce((a,b)=>a+b,0)),[2090,2200,220]);
assert.deepEqual(saved.option.series.map(s=>s.matrix.flat().filter(v=>v>0).length),[38,40,4]);
for(const series of saved.option.series){assert.equal(series.data.length,15);assert.equal(series.matrix.length,15);assert.ok(series.matrix.every(row=>row.length===15));}
console.log('chord2 原站实时配置逐项一致：15 个节点、3 份矩阵、675 个数值，权重合计 4510。');
