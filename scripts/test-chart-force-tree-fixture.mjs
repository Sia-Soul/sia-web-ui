import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('apps/docs/src/pages/chartForceTreeData.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {createForceTreeData}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const first=createForceTreeData(53);
assert.deepEqual(first,createForceTreeData(53));assert.notDeepEqual(first,createForceTreeData(54));
for(let seed=50;seed<65;seed++){
 const {nodes,links}=createForceTreeData(seed);assert.equal(links.length,nodes.length-1);
 assert.equal(nodes[0].name,'ROOT');assert.equal(nodes[0].category,2);
 for(const node of nodes){
  assert.ok(node.value>=2&&node.value<10);
  const children=links.filter(l=>l.source===node.id);
  if(node.category===0){assert.equal(node.depth,2);assert.equal(children.length,0);}
  else {assert.ok(children.length>=4&&children.length<=7);for(const edge of children){assert.equal(edge.weight,1);assert.ok(edge.target>edge.source);assert.equal(nodes[edge.target].depth,node.id===0?0:node.depth+1);}}
 }
}
console.log(`随机力导向树规则检查通过：默认 ${first.nodes.length} 节点 / ${first.links.length} 边，15 个种子的层级、孩子数和权重范围通过。`);
