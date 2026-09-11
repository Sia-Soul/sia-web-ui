import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
async function load(path){const js=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));}
const {createForceTreeData}=await load('apps/docs/src/pages/chartForceTreeData.ts');
const {graphLayout}=await load('packages/react/src/components/graphLayout.ts');
const data=createForceTreeData(53),nodes=data.nodes.map(n=>({...n,id:String(n.id)})),links=data.links.map(l=>({source:String(l.source),target:String(l.target),value:l.weight}));
const points=graphLayout(nodes,links,true,{model:'legacy',width:720,height:379,center:{x:360,y:189.5},minRadius:2,maxRadius:10,coolDown:.995,iterations:1000,maxNodes:500});
assert.equal(points.length,136);assert.ok(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
const clamped=points.filter(p=>p.x===52||p.x===668||p.y===44||p.y===318).length;
assert.equal(clamped,0);
console.log({nodes:points.length,clamped,x:[Math.min(...points.map(p=>p.x)),Math.max(...points.map(p=>p.x))],y:[Math.min(...points.map(p=>p.y)),Math.max(...points.map(p=>p.y))]});
