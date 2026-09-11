import assert from 'node:assert/strict';
import test from 'node:test';
import {mixedBarSlots} from './mixedBarSlots.ts';
const spacing={categoryGap:.2,seriesGap:.3,pixelAlign:true};
test('mixed bar reference spacing is calculated, not a fixed 25px snapshot',()=>{
 const slots=mixedBarSlots(835/12,[undefined,undefined],spacing);
 assert.equal(slots[0]!.width,24.2);
 assert.equal(Math.ceil(slots[0]!.width),25);
 assert.equal(Math.floor(80.5+slots[0]!.offset),87);
 assert.equal(Math.floor(80.5+slots[1]!.offset),118);
 assert.equal(Math.ceil(mixedBarSlots(835/12,[undefined],spacing)[0]!.width),56);
 assert.equal(Math.ceil(mixedBarSlots(835/12,Array(4).fill(undefined),spacing)[0]!.width),12);
});
test('explicit widths, overflow fallback and fractional layouts',()=>{
 assert.deepEqual(mixedBarSlots(100,[20],spacing),[{offset:40,width:20}]);
 assert.deepEqual(mixedBarSlots(100,[20,30],spacing),[{offset:10,width:20},{offset:60,width:30}]);
 assert.deepEqual(mixedBarSlots(100,[100,100],spacing),[{offset:0,width:50},{offset:50,width:50}]);
 assert.deepEqual(mixedBarSlots(100,[],spacing),[]);
 const fractional=mixedBarSlots(100/3,[undefined,undefined],{categoryGap:.2,seriesGap:.3});
 assert.ok(Math.abs(fractional[0]!.width-(100/3*.8/2.3))<1e-10);
});
