import test from 'node:test';
import assert from 'node:assert/strict';
import {bundleEdges,bundleMeetPoints} from './edgeBundling.ts';
test('parallel routes share a shorter trunk with bounded 45-degree entry turns',()=>{
 const edges=[{source:[0,0] as const,target:[0,100] as const},{source:[10,0] as const,target:[10,100] as const}];
 const meeting=bundleMeetPoints(edges);assert.deepEqual(meeting.start,[5,5.000000000000001]);assert.ok(Math.abs(meeting.end[1]-95)<1e-10);assert.ok(meeting.ink<200);
 const output=bundleEdges(edges);assert.equal(output.length,2);
 for(const row of output){assert.deepEqual(row.points[0],edges[row.index]!.source);assert.deepEqual(row.points.at(-1),edges[row.index]!.target);assert.equal(row.points.length,4);}
 assert.deepEqual(output[0]!.points.slice(1,-1),output[1]!.points.slice(1,-1));
});
test('opposite directions, immutable input, zero-length and isolated edges',()=>{
 const edges=[{source:[0,0] as const,target:[0,100] as const},{source:[10,100] as const,target:[10,0] as const},{source:[300,300] as const,target:[300,300] as const}];
 const snapshot=JSON.stringify(edges),result=bundleEdges(edges);
 assert.equal(JSON.stringify(edges),snapshot);assert.equal(new Set(result.map(e=>e.index)).size,3);
 for(const row of result){assert.deepEqual(row.points[0],edges[row.index]!.source);assert.deepEqual(row.points.at(-1),edges[row.index]!.target);assert.ok(row.points.every(p=>p.every(Number.isFinite)));}
 assert.deepEqual(bundleEdges([]),[]);assert.equal(bundleEdges([edges[0]!])[0]!.points.length,2);
 assert.deepEqual(bundleEdges(edges),result);
});
test('hierarchy preserves every route and rejects invalid parameters',()=>{
 const edges=Array.from({length:60},(_,i)=>({source:[i%10,Math.floor(i/10)] as const,target:[100+i%10,200+Math.floor(i/10)] as const}));
 const result=bundleEdges(edges);assert.equal(result.length,60);assert.ok(result.some(row=>row.points.length>4));
 for(const row of result){assert.deepEqual(row.points[0],edges[row.index]!.source);assert.deepEqual(row.points.at(-1),edges[row.index]!.target);}
 assert.throws(()=>bundleEdges(edges,{nearest:0}),RangeError);assert.throws(()=>bundleEdges(edges,{maxIterations:-1}),RangeError);assert.throws(()=>bundleEdges(edges,{maxTurningAngle:0}),RangeError);assert.throws(()=>bundleEdges([{source:[NaN,0],target:[1,1]}]),RangeError);
});
