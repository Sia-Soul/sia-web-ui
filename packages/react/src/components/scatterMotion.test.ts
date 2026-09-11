import assert from 'node:assert/strict';
import test from 'node:test';
import {scatterMotionEase} from './scatterMotion.ts';
test('散点使用全局 ExponentialOut 而非 icon 默认 QuinticOut',()=>{
 assert.equal(scatterMotionEase(0),0);
 assert.equal(scatterMotionEase(.1),.5);
 assert.equal(scatterMotionEase(.5),.96875);
 assert.equal(scatterMotionEase(1),1);
 assert.equal(scatterMotionEase(-1),0);
 assert.equal(scatterMotionEase(2),1);
});
