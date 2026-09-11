import assert from 'node:assert/strict';
import test from 'node:test';
import {lineSegments} from './lineSegments.ts';
test('缺失类别断开折线且不污染邻接控制点',()=>{
 const points=[[0,2],[1,NaN],[2,4],[3,5]] as const;
 assert.deepEqual(lineSegments(points),[[[0,2]],[[2,4],[3,5]]]);assert.equal(points[1][1],NaN);
 assert.deepEqual(lineSegments([[NaN,0],[0,Infinity]]),[]);
});
