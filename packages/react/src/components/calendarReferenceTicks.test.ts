import assert from 'node:assert/strict';
import test from 'node:test';
import {calendarReferenceTicks} from './calendarReferenceTicks.ts';
test('事件河流范围选择周刻度并保留端点',()=>{
 const min=new Date(2014,3,30,6).getTime(),max=new Date(2014,4,17,12).getTime();
 const ticks=calendarReferenceTicks([min,max]);
 assert.deepEqual(ticks.map(t=>t.label),['04 - 30\n2014','05 - 05\n2014','05 - 12\n2014','05 - 17\n2014']);
 assert.deepEqual(ticks.map(t=>(t.value-min)/86400000),[0,5,12,17.25]);
});
test('短时间格式、单点、无效范围',()=>{
 const min=new Date(2014,4,1,1).getTime();assert.ok(calendarReferenceTicks([min,min+4000]).every(t=>t.label.split(' : ').length===3));
 assert.equal(calendarReferenceTicks([min,min]).length,1);assert.deepEqual(calendarReferenceTicks([2,1]),[]);
});
