import assert from 'node:assert/strict';
import test from 'node:test';
import {axisTooltipPosition} from './chartTooltipPosition.ts';
test('axis tooltip offsets and reference edge branches',()=>{
 assert.deepEqual(axisTooltipPosition([115,256.58],[120,50],[1015,398]),[125,266.58]);
 assert.deepEqual(axisTooltipPosition([980,100],[120,50],[1015,398]),[830,110]);
 assert.deepEqual(axisTooltipPosition([115,370],[140,90],[1015,398]),[125,310]);
 assert.deepEqual(axisTooltipPosition([115,-5],[140,90],[1015,398]),[125,0]);
});
