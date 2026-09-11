import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {mapPointPulseDuration} from './mapPointPulse.ts';
test('point pulse preserves original randomized 100 × (period + 10 × sample) timing',()=>{
 let calls=0;assert.equal(mapPointPulseDuration(15,()=>{calls++;return .25;}),1750);assert.equal(calls,1);
 assert.equal(mapPointPulseDuration(15,()=>0),1500);
 assert.equal(mapPointPulseDuration(15,()=>.999),2499);
 assert.equal(mapPointPulseDuration(30,()=>.5),3500);
});
