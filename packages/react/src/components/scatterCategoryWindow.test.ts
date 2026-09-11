import test from 'node:test';
import assert from 'node:assert/strict';
import {scatterCategoryWindow} from './scatterCategoryWindow.ts';
test('category zoom uses stable axis categories including empty slots',()=>{
 const categories=Array.from({length:500},(_,i)=>i+1);
 const slice=scatterCategoryWindow(categories,[30,70]);
 assert.equal(slice.length,200);assert.equal(slice[0],151);assert.equal(slice.at(-1),350);
 assert.deepEqual(scatterCategoryWindow(categories,[70,30]),slice);
 assert.deepEqual(scatterCategoryWindow(categories,[0,100]),categories);
});
test('category zoom bounds, singleton and empty axis',()=>{
 assert.deepEqual(scatterCategoryWindow([1,2,3],[-20,200]),[1,2,3]);
 assert.deepEqual(scatterCategoryWindow([4],[30,70]),[4]);
 assert.deepEqual(scatterCategoryWindow([],[30,70]),[]);
});
