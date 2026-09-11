import assert from 'node:assert/strict';
import test from 'node:test';
import {chartStarPoints} from './chartStarPoints.ts';
test('原站五角星与六角星绘制顶点对应',()=>{
 const six=chartStarPoints(637.1666666666666,145.63999999999996,40,6);
 const five=chartStarPoints(358.8333333333333,188.98399999999998,30,5);
 assert.equal(six.length,12);assert.equal(five.length,10);
 const close=(actual:readonly number[],expected:number[])=>actual.forEach((n,i)=>assert.ok(Math.abs(n-expected[i]!)<1e-9));
 close(six[0]!,[637.1666666666666,125.63999999999996]);
 close(six[1]!,[642.9401693585629,135.63999999999996]);
 close(six[2]!,[654.4871747423554,135.63999999999996]);
 close(five[1]!,[362.2010431576802,184.34874508437576]);
 close(five[2]!,[373.0991810777606,184.34874508437576]);
});
