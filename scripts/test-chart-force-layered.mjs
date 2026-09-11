import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
async function load(path){const js=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));}
const {createForceLayeredData}=await load('apps/docs/src/pages/chartForceLayeredData.ts');
const {graphLayout}=await load('packages/react/src/components/graphLayout.ts');
const first=createForceLayeredData(53);
assert.deepEqual(first,createForceLayeredData(53));assert.notDeepEqual(first,createForceLayeredData(54));
for(let seed=50;seed<65;seed++){
 const {nodes,links}=createForceLayeredData(seed);
 assert.equal(links.length,nodes.length-1);assert.equal(nodes[0].name,'ROOT');assert.equal(nodes[0].category,2);
 for(const node of nodes){
  assert.ok(node.value>=2&&node.value<10);assert.ok(node.x>260&&node.x<=460);
  assert.equal(node.y,359*node.depth/5+20);assert.equal(node.fixY,true);
  const children=links.filter(l=>l.source===node.id);
  if(node.category===0){assert.equal(node.depth,4);assert.equal(children.length,0);}
  else {assert.ok(children.length>=2&&children.length<=3);for(const edge of children){assert.equal(edge.weight,1);assert.ok(edge.target>edge.source);assert.equal(nodes[edge.target].depth,node.depth+1);}}
 }
 const points=graphLayout(nodes.map(n=>({...n,id:String(n.id)})),links.map(l=>({source:String(l.source),target:String(l.target),value:l.weight})),true,{model:'legacy',width:720,height:379,center:{x:360,y:189.5},minRadius:2,maxRadius:10,iterations:700,maxNodes:500});
 assert.ok(points.every((p,i)=>Number.isFinite(p.x)&&p.y===nodes[i].y));
 assert.ok(points.some((p,i)=>p.x!==nodes[i].x));
}
console.log({nodes:first.nodes.length,edges:first.links.length,leaves:first.nodes.filter(n=>n.category===0).length,levels:[...new Set(first.nodes.map(n=>n.y))],verifiedSeeds:15});
