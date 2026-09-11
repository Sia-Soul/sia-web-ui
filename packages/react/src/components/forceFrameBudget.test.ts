import test from 'node:test';
import assert from 'node:assert/strict';
import {forceFrameBudget} from './forceFrameBudget.ts';
test('force steps=10 advances ten solver steps per 60 Hz interval, not ten frames',()=>{
 assert.deepEqual(forceFrameBudget(0,1000/60,100,10),{steps:10,carry:0,remaining:90});
 assert.equal(forceFrameBudget(0,1000/60,100).steps,1);
 assert.equal(forceFrameBudget(0,1000/60,3,10).steps,3);
});
test('force clock preserves fractional time and caps suspended-tab catch-up',()=>{
 let carry=0,remaining=10000,total=0;
 for(let i=0;i<120;i++){const next=forceFrameBudget(carry,1000/120,remaining,10);carry=next.carry;remaining=next.remaining;total+=next.steps;}
 assert.equal(total,600);
 assert.equal(forceFrameBudget(0,60000,10000,10).steps,60);
 assert.equal(forceFrameBudget(0,-100,100,10).steps,0);
 assert.equal(forceFrameBudget(0,1000/60,100,NaN).steps,1);
 assert.equal(forceFrameBudget(0,1000/60,0,10).steps,0);
});
