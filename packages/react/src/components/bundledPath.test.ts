import assert from 'node:assert/strict';
import test from 'node:test';
import {smoothBundledPath,sampleBundledPath} from './bundledPath.ts';
test('open chain endpoints and distance-weighted interior handles',()=>{
 const points=[[0,0],[10,0],[10,20]] as const,c=smoothBundledPath(points,.1);
 assert.deepEqual(c[0]!.c1,[0,0]);assert.deepEqual(c[1]!.c2,[10,20]);
 assert.ok(Math.abs(c[0]!.c2[0]-(10-1/3))<1e-12);assert.ok(Math.abs(c[0]!.c2[1]+2/3)<1e-12);
 assert.deepEqual(sampleBundledPath(c,0),[0,0]);assert.deepEqual(sampleBundledPath(c,1),[10,20]);
 const p=sampleBundledPath(c,c[0]!.until/c[1]!.until);assert.ok(Math.abs(p[0]-10)<1e-10&&Math.abs(p[1])<1e-10);
});
test('degenerate segments and controls remain finite',()=>{
 for(const points of [[],[[0,0]],[[0,0],[0,0],[0,0]],[[0,0],[10,10]]] as const){const c=smoothBundledPath(points);assert.ok(c.every(s=>Number.isFinite(s.until)));assert.ok(sampleBundledPath(c,.5).every(Number.isFinite));}
 assert.throws(()=>smoothBundledPath([],NaN),RangeError);
});
