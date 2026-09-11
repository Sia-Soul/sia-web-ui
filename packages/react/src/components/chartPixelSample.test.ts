import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chartPixelSample} from './chartPixelSample.ts';
test('像素预算只返回原始索引，不补造末点或改写输入',()=>{
 const indices=Array.from({length:3079},(_,i)=>i),sample=chartPixelSample(indices,835);
 assert.equal(sample.length,835);assert.deepEqual(sample.slice(0,10),[0,3,7,11,14,18,22,25,29,33]);assert.equal(sample.at(-1),3075);assert.equal(indices.length,3079);
});
test('短段、空段及无效预算有界',()=>{
 const indices=[10,11,12];assert.equal(chartPixelSample(indices,10),indices);assert.deepEqual(chartPixelSample([],0),[]);assert.deepEqual(chartPixelSample(indices,0),[10]);assert.equal(chartPixelSample(indices,NaN),indices);
});
