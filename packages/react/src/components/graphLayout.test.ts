import test from 'node:test';
import assert from 'node:assert/strict';
import {graphLayout,advanceGraphLayout,reheatGraphLayout} from './graphLayout.ts';
test('drag reheating revives a cooled graph without resetting positions, velocities or iteration',()=>{
 const nodes=[{id:'a',x:200,y:20,fixY:true},{id:'b',x:400,y:200}];
 const options={model:'legacy' as const,coolDown:.99,iterations:1};
 const cold=[{x:200,y:20,vx:0,vy:0,iteration:2000},{x:400,y:200,vx:0,vy:0,iteration:2000}];
 const before=JSON.stringify(cold),hot=reheatGraphLayout(cold);
 assert.equal(JSON.stringify(cold),before);
 assert.deepEqual(hot[0],{...cold[0],temperature:.8});
 const resting=advanceGraphLayout(nodes,[],cold,options),resumed=advanceGraphLayout(nodes,[],hot,options);
 assert.ok(Math.abs(resumed[0]!.x-200)>Math.abs(resting[0]!.x-200)*1000);
 assert.equal(resumed[0]!.y,20);assert.equal(resumed[0]!.iteration,2001);
 assert.equal(resumed[0]!.temperature,.8*.99);
 const twice=advanceGraphLayout(nodes,[],resumed,options);
 assert.deepEqual(twice,advanceGraphLayout(nodes,[],hot,{...options,iterations:2}));
 assert.deepEqual(reheatGraphLayout([]),[]);
 assert.throws(()=>reheatGraphLayout(cold,NaN),RangeError);
 assert.throws(()=>reheatGraphLayout(cold,1.1),RangeError);
});
test('axis constraints preserve only the specified coordinate while retaining solver velocity',()=>{
 const nodes=[{id:'a',x:200,y:20,fixY:true},{id:'b',x:400,y:200,fixX:true}];
 for(const model of ['native','legacy'] as const){
  const points=graphLayout(nodes,[{source:'a',target:'b'}],true,{model,iterations:50});
  assert.equal(points[0]!.y,20);assert.equal(points[1]!.x,400);
  assert.notEqual(points[0]!.x,200);assert.notEqual(points[1]!.y,200);
  assert.notEqual(points[0]!.vy,0);assert.notEqual(points[1]!.vx,0);
 }
});
test('legacy model uses density-scaled repulsion without a hard rectangular clamp',()=>{
 const nodes=[{id:'a',x:0,y:0,radius:10},{id:'b',x:100,y:0,radius:10}];
 const result=graphLayout(nodes,[],true,{model:'legacy',width:100,height:100,maxRadius:10,gravity:0,iterations:1});
 const speed=32/30,expected=speed*speed/(speed+.1);
 assert.ok(Math.abs(result[0]!.x+expected)<1e-10);
 assert.ok(Math.abs(result[1]!.x-100-expected)<1e-10);
 assert.equal(result[0]!.iteration,1);
});
test('legacy cooling and velocities are preserved across frame boundaries',()=>{
 const nodes=[{id:'a',value:2},{id:'b',value:10},{id:'c',value:5}],links=[{source:'a',target:'b',value:2},{source:'b',target:'c',value:1}];
 const options={model:'legacy' as const,coolDown:.995,width:720,height:379,seed:53};
 let frames=graphLayout(nodes,links,false,options);
 for(let i=0;i<50;i++)frames=advanceGraphLayout(nodes,links,frames,{...options,iterations:1});
 assert.deepEqual(frames,graphLayout(nodes,links,true,{...options,iterations:50}));
 assert.ok(frames.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.iteration===50));
});
test('incremental force steps match batch solve and do not mutate prior frame',()=>{
 const nodes=[{id:'a'},{id:'b'},{id:'c'}],links=[{source:'a',target:'b',value:6},{source:'b',target:'c',value:1}];
 const options={gravity:1.1,scaling:1.1,weightedLinks:true};
 const initial=graphLayout(nodes,links,false),snapshot=JSON.stringify(initial);
 let frame=initial;
 for(let i=0;i<140;i++)frame=advanceGraphLayout(nodes,links,frame,{...options,iterations:1});
 assert.deepEqual(frame,graphLayout(nodes,links,true,options));
 assert.equal(JSON.stringify(initial),snapshot);
 assert.notDeepEqual(frame,initial);
 assert.throws(()=>advanceGraphLayout(nodes,links,[]),RangeError);
});
test('pinned drag state resumes at its current location with no stale velocity',()=>{
 const nodes=[{id:'a',fixed:true},{id:'b'}],links=[{source:'a',target:'b',value:1}];
 const previous=[{x:260,y:120,vx:100,vy:-100},{x:420,y:180,vx:0,vy:0}];
 const held=advanceGraphLayout(nodes,links,previous,{iterations:1});
 assert.deepEqual(held[0],{x:260,y:120,vx:0,vy:0});
 const resumed=advanceGraphLayout([{id:'a'},{id:'b'}],links,held,{iterations:1});
 assert.ok(Math.abs(resumed[0]!.x-260)<10);
 assert.notEqual(resumed[0]!.x,260);
});
test('native force parameters are explicit and deterministic without mutating nodes',()=>{
 const nodes=[{id:'a',x:200,y:180},{id:'b',x:400,y:180}],links=[{source:'a',target:'b',value:1}];
 const before=JSON.stringify(nodes);
 const still=graphLayout(nodes,links,true,{gravity:0,scaling:0,linkDistance:200,iterations:1});
 assert.deepEqual(still.map(p=>[p.x,p.y]),[[200,180],[400,180]]);
 const move=graphLayout(nodes,links,true,{gravity:0,scaling:0,linkDistance:100,iterations:1});
 assert.ok(Math.abs(move[0]!.x-200.984)<1e-10);
 assert.ok(Math.abs(move[1]!.x-399.016)<1e-10);
 assert.deepEqual(move,graphLayout(nodes,links,true,{gravity:0,scaling:0,linkDistance:100,iterations:1}));
 assert.equal(JSON.stringify(nodes),before);
});
test('weighted links, fixed nodes and missing endpoints preserve solver invariants',()=>{
 const nodes=[{id:'a',x:200,y:180,fixed:true},{id:'b',x:400,y:180}];
 const zero=graphLayout(nodes,[{source:'a',target:'b',value:0}],true,{gravity:0,scaling:0,weightedLinks:true,iterations:1});
 assert.equal(zero[1]!.x,400);
 const fixed=graphLayout(nodes,[{source:'a',target:'b',value:6},{source:'missing',target:'b',value:1}],true,{weightedLinks:true});
 assert.equal(fixed[0]!.x,200);assert.equal(fixed[0]!.y,180);
 assert.ok(fixed.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 assert.deepEqual(graphLayout([],[],true),[]);
});
