import assert from 'node:assert/strict';
import test from 'node:test';
import {mixedValueDomain} from './mixedValueDomain.ts';
test('target sections choose readable steps without forcing a fixed section count',()=>{
 const options={targetSplitNumber:5,preferredSteps:[1,2,3,5,10]};
 assert.deepEqual(mixedValueDomain([10,11,15],options),[0,15,3]);
 assert.deepEqual(mixedValueDomain([-2,15],options),[-5,15,5]);
 assert.deepEqual(mixedValueDomain([-2,5],options),[-2,6,2]);
 assert.deepEqual(mixedValueDomain([10,15]),[0,15,2.5],'default remains unchanged');
 assert.deepEqual(mixedValueDomain([10,15],{...options,preferredSteps:[NaN,-1,3,2,1,5,3]}),[0,15,3]);
});
test('original axis dynamic ranges including independent padding and fixed split count',()=>{
 assert.deepEqual(mixedValueDomain([2,182.2],{boundaryGap:[0,.1]}),[0,250,50]);
 assert.deepEqual(mixedValueDomain([2.3,1000],{boundaryGap:[0,.1]}),[0,1200,200]);
 assert.deepEqual(mixedValueDomain([-100,182.2],{boundaryGap:[0,.1]}),[-100,300,100]);
 assert.deepEqual(mixedValueDomain([2,33.4],{splitNumber:10}),[0,50,5]);
 assert.deepEqual(mixedValueDomain([2,100],{splitNumber:10}),[0,100,10]);
});
test('finite inputs, negative ranges and fractional tick steps remain usable',()=>{
 assert.ok(mixedValueDomain([])[1]>0);
 const negative=mixedValueDomain([-20,-5],{splitNumber:10});assert.equal(negative[1],0);assert.ok(negative[0]<=-20);
 const small=mixedValueDomain([.001,.007],{splitNumber:10});assert.ok(small[0]<=.001&&small[1]>=.007&&small[2]>0);
 assert.deepEqual(mixedValueDomain([NaN,Infinity,2,33.4],{splitNumber:10}),[0,50,5]);
});
