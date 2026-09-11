import assert from 'node:assert/strict';import test from 'node:test';import {chartZoomShadow} from './chartZoomShadow.ts';
test('overview normalizes extrema, rounds y and closes on baseline',()=>{
 assert.deepEqual(chartZoomShadow([0,15,30],100,20),[[0,19],[50,14],[100,9],[100,20],[0,20]]);
 assert.deepEqual(chartZoomShadow([5,5],100,20),[[0,19],[100,19],[100,20],[0,20]]);
 assert.deepEqual(chartZoomShadow([],100,20),[]);
 assert.ok(chartZoomShadow(Array.from({length:150},(_,i)=>i),30,20).length<152);
});
