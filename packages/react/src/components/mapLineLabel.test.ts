import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {mapLineEndLabel} from './mapLineLabel.ts';
test('map16 male and female labels follow opposite end alignment',()=>{
 assert.deepEqual(mapLineEndLabel([138,126],[268,56]),{x:273,y:56,anchor:'start',baseline:'central'});
 assert.deepEqual(mapLineEndLabel([118,126],[-22,56]),{x:-27,y:56,anchor:'end',baseline:'central'});
 assert.equal(mapLineEndLabel([0,0],[0,-10]).baseline,'text-after-edge');
 assert.equal(mapLineEndLabel([0,0],[0,10]).baseline,'text-before-edge');
});
