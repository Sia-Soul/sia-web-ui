import test from 'node:test';
import assert from 'node:assert/strict';
import {chordMatrixLayout,chordMultiMatrixLayout,chordScaleTicks,chordNodeLayout} from './chordMatrixLayout.ts';
test('non-ribbon chord allocates angles by scaled node radii, not degree',()=>{
 const nodes=Array.from({length:17},(_,i)=>({id:String(i)}));
 const links=Array.from({length:14},(_,i)=>({source:String(i<3?14:i<10?15:16),target:String(i),value:1}));
 const layout=chordNodeLayout(nodes,links,{minRadius:7,maxRadius:20,orbitRadius:113.7,sort:'ascending',padAngle:0});
 assert.equal(layout.length,17);
 assert.deepEqual(layout.map(n=>n.id),[...Array.from({length:15},(_,i)=>String(i)),'16','15']);
 assert.equal(layout[0]!.radius,7);assert.equal(layout.at(-1)!.radius,20);
 assert.ok(Math.abs(layout[14]!.radius-(7+13/3))<1e-10);
 assert.equal(layout[15]!.radius,13.5);
 assert.ok(Math.abs((layout.at(-1)!.end-layout.at(-1)!.start)/(layout[0]!.end-layout[0]!.start)-20/7)<1e-10);
 for(const node of layout)assert.ok(Math.abs(Math.hypot(node.x,node.y)-113.7)<1e-10);
});
test('non-ribbon layout removes isolated nodes, ignores invalid links and retains equal-degree legacy sizes',()=>{
 const layout=chordNodeLayout([{id:'a'},{id:'b'},{id:'isolated'}],[{source:'a',target:'b',value:1},{source:'missing',target:'a',value:100}],{minRadius:7,maxRadius:20,clockwise:false});
 assert.deepEqual(layout.map(n=>n.radius),[1,1]);
 assert.ok(layout.every(n=>n.end<n.start));
 assert.deepEqual(chordNodeLayout([],[]),[]);
});
test('inserted matrix series share arc totals without merging relationship ribbons',()=>{
 const layout=chordMultiMatrixLayout([[[0,10],[2,0]],[[0,3],[6,0]]],{padAngle:0});
 assert.equal(layout.total,21);
 assert.deepEqual(layout.groups.map(g=>g.value),[13,8]);
 assert.equal(layout.ribbons.length,2);
 assert.deepEqual(layout.ribbons.map(r=>r.seriesIndex),[0,1]);
 assert.equal(layout.ribbons[0]!.source.value,10);
 assert.equal(layout.ribbons[1]!.source.value,6);
 const group=layout.groups[0]!;
 assert.ok(Math.abs(group.end-group.start-2*Math.PI*13/21)<1e-10);
 assert.equal(layout.ribbons[0]!.source.end,layout.ribbons[1]!.target.start);
});
test('inserted matrices preserve base node ownership, reciprocal edges and counterclockwise layout',()=>{
 const layout=chordMultiMatrixLayout([[[0,10,0],[2,0,0],[0,0,0]],[[0,3,4],[0,0,0],[5,0,0]]],{clockwise:false});
 assert.deepEqual(layout.groups.map(g=>g.index),[0,1]);
 assert.deepEqual(layout.groups.map(g=>g.value),[17,2]);
 assert.equal(layout.ribbons.length,1);
 assert.ok(layout.groups.every(g=>g.end<g.start));
 assert.equal(chordMultiMatrixLayout([]).total,0);
 assert.equal(chordMultiMatrixLayout([[[NaN,-1],[Infinity,0]]]).groups.length,0);
});
test('explicit legacy ordering preserves insertion order without changing generic descending sorting',()=>{
 const matrix=[[5,10],[2,3]];
 const legacy=chordMatrixLayout(matrix,{sort:'ascending',sortSub:'descending',legacySubSort:true,startAngle:Math.PI/2});
 const standard=chordMatrixLayout(matrix,{sort:'ascending',sortSub:'descending',startAngle:Math.PI/2});
 assert.equal(legacy.groups[0]!.start,Math.PI/2);
 assert.deepEqual(legacy.groups.map(g=>g.index),[1,0]);
 const self=(layout:typeof legacy)=>layout.ribbons.find(r=>r.source.index===0&&r.target.index===0)!.source;
 const cross=(layout:typeof legacy)=>layout.ribbons.find(r=>r.source.index!==r.target.index)!.source;
 assert.ok(self(legacy).start<cross(legacy).start);
 assert.ok(self(standard).start>cross(standard).start);
 const descending=chordMatrixLayout(matrix,{sort:'descending',legacySubSort:true});
 assert.ok(self(descending).start>cross(descending).start);
});
test('legacy angular scales use incident weight and 20-degree label steps',()=>{
 const ticks=chordScaleTicks(0,Math.PI/2,100000,Math.PI/90);
 assert.equal(ticks.length,23);assert.equal(ticks[5]!.label,true);
 assert.ok(Math.abs(ticks[5]!.value-11173.1843575419)<1e-8);
 assert.equal(ticks[1]!.label,false);
 assert.ok(chordScaleTicks(0,-Math.PI/2,100000,Math.PI/90)[1]!.angle<0);
});
test('matrix groups use row totals and asymmetric ribbons preserve both weights',()=>{
 const layout=chordMatrixLayout([[5,10],[2,3]],{padAngle:0});
 assert.equal(layout.total,20);assert.deepEqual(layout.groups.map(g=>g.value),[15,5]);
 assert.ok(Math.abs(layout.groups[0]!.end-layout.groups[0]!.start-Math.PI*1.5)<1e-10);
 assert.equal(layout.ribbons.length,3);
 const link=layout.ribbons.find(r=>r.source.index!==r.target.index)!;
 assert.equal(link.source.value,10);assert.equal(link.target.value,2);
 assert.ok(Math.abs((link.source.end-link.source.start)/(link.target.end-link.target.start)-5)<1e-10);
});
test('sorting, counterclockwise direction and empty matrices',()=>{
 const layout=chordMatrixLayout([[5,10],[2,3]],{sort:'ascending',sortSub:'descending',clockwise:false});
 assert.deepEqual(layout.groups.map(g=>g.index),[1,0]);assert.ok(layout.groups.every(g=>g.end<g.start));
 assert.equal(chordMatrixLayout([]).ribbons.length,0);
 assert.equal(chordMatrixLayout([[NaN,-3],[Infinity,0]]).total,0);
});
