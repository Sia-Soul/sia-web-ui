import {test} from 'node:test';
import assert from 'node:assert/strict';
import {timelineRatios,nearestTimelineIndex} from './timelinePositions.ts';
test('date spacing preserves leap days and original endpoints',()=>{
 const dates=Array.from({length:10},(_,i)=>`${2002+i}-01-01`),ratios=timelineRatios(10,dates);
 assert.equal(ratios[0],0);assert.equal(ratios[9],1);
 assert.ok(Math.abs((ratios[3]!-ratios[2]!)/(ratios[2]!-ratios[1]!)-366/365)<1e-12);
 ratios.forEach((ratio,index)=>assert.equal(nearestTimelineIndex(ratios,ratio),index));
 assert.equal(nearestTimelineIndex(ratios,-1),0);assert.equal(nearestTimelineIndex(ratios,2),9);
});
test('empty, singleton and invalid dates have deterministic fallback',()=>{
 assert.deepEqual(timelineRatios(0),[]);assert.deepEqual(timelineRatios(1),[.5]);
 assert.deepEqual(timelineRatios(3,['bad']),[0,.5,1]);
 assert.deepEqual(timelineRatios(3,['2002-01-01','2001-01-01','2003-01-01']),[0,.5,1]);
});
