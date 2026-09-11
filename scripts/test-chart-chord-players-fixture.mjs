import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const saved=JSON.parse(fs.readFileSync('apps/docs/src/pages/chartChordPlayersSource.json','utf8'));
const [live]=JSON.parse(execFileSync(process.execPath,['scripts/inspect-chart-references.mjs','--options','--match=^chord3$'],{encoding:'utf8'}));
assert.equal(live.status,200);assert.deepEqual(saved.option,live.option);
const {nodes,links}=saved.option.series[0];
assert.equal(nodes.length,17);assert.equal(links.length,28);
assert.equal(links.filter(l=>l.weight===.9).length,14);
assert.equal(links.filter(l=>l.weight===1).length,14);
for(const link of links){assert.ok(nodes.some(n=>n.name===link.source));assert.ok(nodes.some(n=>n.name===link.target));assert.ok(links.some(l=>l.source===link.target&&l.target===link.source));}
console.log('chord3 原站配置一致：17 节点、28 有向关系、14 组 0.9/1 不对称双向权重。');
