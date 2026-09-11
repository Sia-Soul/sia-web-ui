import test from 'node:test';
import assert from 'node:assert/strict';
import {visualPieceIndex} from './visualPiece.ts';
test('piece boundaries have one owner including zero and maximum',()=>{
 const pieces=[{min:0,max:20},{min:20,max:40},{min:40,max:100}];
 assert.deepEqual([0,20,20.01,40,100,-1,101,NaN].map(v=>visualPieceIndex(v,pieces)),[0,0,1,1,2,-1,-1,-1]);
});
test('descending display order does not change interval semantics',()=>{
 const pieces=[{min:80,max:100},{min:60,max:80},{min:40,max:60},{min:20,max:40},{min:0,max:20}];
 assert.deepEqual([0,20,40,60,80,100].map(v=>visualPieceIndex(v,pieces)),[4,4,3,2,1,0]);
 assert.equal(visualPieceIndex(1,[]),-1);
});
