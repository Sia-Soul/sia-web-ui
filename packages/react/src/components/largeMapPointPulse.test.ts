import {test} from 'node:test';
import assert from 'node:assert/strict';
import {largeMapPointPulse,largeMapPointSize} from './largeMapPointPulse.ts';
test('large point 1500ms segments, delayed start, hold and loop',()=>{
 const at=(t:number)=>largeMapPointPulse(t,15,.2,300);
 assert.equal(at(0),.2);assert.equal(at(300),.2);assert.ok(Math.abs(at(1050)-.6)<1e-12);
 assert.equal(at(1800),1);assert.equal(at(2550),.5);assert.equal(at(3300),0);
 assert.equal(at(4050),.5);assert.equal(at(4800),1);assert.equal(at(5550),1);assert.equal(at(6300),.2);
});
test('symbol dimensions use square of pulse, not radius or opacity',()=>{
 assert.equal(largeMapPointSize(6,.5),1.5);assert.equal(largeMapPointSize(3,1),3);assert.equal(largeMapPointSize(2,0),0);
});
