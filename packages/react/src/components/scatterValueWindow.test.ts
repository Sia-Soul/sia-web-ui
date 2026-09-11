import test from 'node:test';
import assert from 'node:assert/strict';
import {scatterValueWindow} from './scatterValueWindow.ts';
test('continuous zoom does not use point density or series order',()=>{
 assert.deepEqual(scatterValueWindow([0,1,2,3,100],[30,70]),[30,70]);
 assert.deepEqual(scatterValueWindow([100,3,2,1,0],[70,30]),[30,70]);
 const base=Date.UTC(2014,9,1);assert.deepEqual(scatterValueWindow([base,base+10000],[30,70]),[base+3000,base+7000]);
});
test('continuous zoom handles invalid, equal and empty input',()=>{
 assert.deepEqual(scatterValueWindow([NaN,Infinity,0,100],[-20,120]),[0,100]);
 assert.deepEqual(scatterValueWindow([4,4],[0,100]),[4,5]);
 assert.deepEqual(scatterValueWindow([],[0,100]),[0,1]);
});
