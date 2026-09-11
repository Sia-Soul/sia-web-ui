import assert from 'node:assert/strict';
import test from 'node:test';
import {changeCartesianMagic} from './cartesianMagicState.ts';
test('图形和布局独立：堆叠后切折线，再平铺，再回柱图',()=>{
 const start={shape:'bar',layout:'original'} as const;
 const stack=changeCartesianMagic(start,'stack');const line=changeCartesianMagic(stack,'line');
 assert.deepEqual(line,{shape:'line',layout:'stack'});
 assert.deepEqual(changeCartesianMagic(line,'tiled'),{shape:'line',layout:'tiled'});
 assert.deepEqual(changeCartesianMagic(changeCartesianMagic(line,'tiled'),'bar'),{shape:'bar',layout:'tiled'});
 assert.deepEqual(start,{shape:'bar',layout:'original'});assert.equal(changeCartesianMagic(start,'unknown'),start);
});
