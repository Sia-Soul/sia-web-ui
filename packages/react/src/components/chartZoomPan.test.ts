import assert from 'node:assert/strict';
import test from 'node:test';
import {chartZoomPan} from './chartZoomPan.ts';
test('pan preserves span and clamps at both ends',()=>{
 assert.deepEqual(chartZoomPan([40,60],10),[50,70]);
 assert.deepEqual(chartZoomPan([40,60],-100),[0,20]);
 assert.deepEqual(chartZoomPan([40,60],100),[80,100]);
 assert.deepEqual(chartZoomPan([0,100],20),[0,100]);
 assert.deepEqual(chartZoomPan([60,40],5),[45,65]);
 assert.deepEqual(chartZoomPan([-5,5],20,-10,10),[0,10]);
});
