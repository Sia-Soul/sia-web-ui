import test from 'node:test';
import assert from 'node:assert/strict';
import {chartTimeTicks} from './chartTimeTicks.ts';
test('time ticks align to six-hour calendar boundaries with exact endpoints',()=>{
 const start=new Date(2014,9,3,2,6).getTime(),end=new Date(2014,9,5,20,30).getTime();
 const ticks=chartTimeTicks([start,end],10);
 assert.equal(ticks[0],start);assert.equal(ticks.at(-1),end);
 for(const t of ticks.slice(1,-1)){const d=new Date(t);assert.equal(d.getHours()%6,0);assert.equal(d.getMinutes(),0);}
 assert.equal(ticks.length,13);assert.equal(new Set(ticks).size,ticks.length);
});
test('calendar tick edge cases and month starts',()=>{
 assert.deepEqual(chartTimeTicks([1,1]),[1]);assert.deepEqual(chartTimeTicks([3,2]),[]);
 const ticks=chartTimeTicks([new Date(2024,0,15).getTime(),new Date(2024,5,15).getTime()],5);
 for(const t of ticks.slice(1,-1))assert.equal(new Date(t).getDate(),1);
});
