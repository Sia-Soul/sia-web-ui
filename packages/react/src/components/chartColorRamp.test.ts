import assert from 'node:assert/strict';
import test from 'node:test';
import {chartColorRamp} from './chartColorRamp.ts';
test('世界人口三段渐变端点、中点和分段插值',()=>{
 const colors=['lightskyblue','yellow','orangered'];
 assert.equal(chartColorRamp(colors,0),'#87cefa');assert.equal(chartColorRamp(colors,.5),'#ffff00');assert.equal(chartColorRamp(colors,1),'#ff4500');
 assert.equal(chartColorRamp(colors,.25),'#c3e77d');assert.equal(chartColorRamp(colors,.75),'#ffa200');
 assert.equal(chartColorRamp(colors,-1),'#87cefa');assert.equal(chartColorRamp(colors,2),'#ff4500');
});
test('两色及退化色带保持稳定',()=>{
 assert.equal(chartColorRamp(['#000','#fff'],.5),'#808080');assert.equal(chartColorRamp(['#ccc'],.8),'#cccccc');
 assert.equal(chartColorRamp([],0),'#ccc');assert.equal(chartColorRamp(['yellow','orange'],NaN),'#ffff00');
});
test('迁徙图 aqua/lime 与其余色阶连续插值',()=>{
 const colors=['aqua','lime','yellow','orange','#ff3333'];
 assert.equal(chartColorRamp(colors,0),'#00ffff');assert.equal(chartColorRamp(colors,.1),'#00ff99');
 assert.equal(chartColorRamp(colors,.25),'#00ff00');assert.equal(chartColorRamp(colors,.4),'#99ff00');
 assert.equal(chartColorRamp(colors,1),'#ff3333');
});
