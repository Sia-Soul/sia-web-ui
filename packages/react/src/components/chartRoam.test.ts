import assert from 'node:assert/strict';
import test from 'node:test';
import {zoomChartViewport} from './chartRoam.ts';
test('显式取消限制和单边限制不继承通用缩放上限',()=>{
 const view={x:0,y:0,scale:1};
 assert.equal(zoomChartViewport(view,100,[450,250],null).scale,100);
 assert.equal(zoomChartViewport(view,.001,[450,250],null).scale,.001);
 assert.equal(zoomChartViewport(view,100,[0,0],{min:.5}).scale,100);
 assert.equal(zoomChartViewport(view,.001,[0,0],{min:.5}).scale,.5);
 assert.equal(zoomChartViewport(view,100,[0,0],{max:8}).scale,8);
 assert.equal(zoomChartViewport(view,2,[0,0],{min:8,max:2}),view);
 assert.equal(zoomChartViewport(view,Number.MAX_VALUE,[450,250],null),view);
});
test('以鼠标位置为锚点缩放，锚点下的数据坐标不漂移',()=>{
 const before={x:40,y:-10,scale:2},at=[200,100] as const,after=zoomChartViewport(before,1.5,at);
 assert.equal((at[0]-after.x)/after.scale,(at[0]-before.x)/before.scale);
 assert.equal((at[1]-after.y)/after.scale,(at[1]-before.y)/before.scale);
});
test('缩放上下限和非法输入保护',()=>{
 const view={x:0,y:0,scale:1};assert.equal(zoomChartViewport(view,100,[0,0]).scale,20);assert.equal(zoomChartViewport(view,.0001,[0,0]).scale,.05);assert.equal(zoomChartViewport(view,NaN,[0,0]),view);
});
