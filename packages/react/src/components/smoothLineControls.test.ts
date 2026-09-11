import assert from 'node:assert/strict';
import test from 'node:test';
import {smoothLineControls} from './smoothLineControls.ts';
import {lineSegments} from './lineSegments.ts';

test('原站 bar 切换折线：0.3 距离加权控制点及端点约束', () => {
  const points = [[140.14285714285714,158.54],[259.42857142857144,129.644],[378.7142857142857,137.64200000000002],[498.00000000000006,129.12800000000001],[617.2857142857143,88.88],[736.5714285714286,78.55999999999997],[855.8571428571429,106.94000000000003]] as const;
  const controls = smoothLineControls(points);
  assert.deepEqual(controls[0]!.outgoing, points[0]);
  assert.deepEqual(controls.at(-1)!.incoming, points.at(-1));
  const close = (actual: number[], expected: number[]) => actual.forEach((n, i) => assert.ok(Math.abs(n - expected[i]!) < 1e-9));
  close(controls[1]!.incoming, [223.17285290925955,132.81987068222517]);
  close(controls[1]!.outgoing, [294.74428148068813,126.5504706822252]);
  close(controls[5]!.incoming, [701.2115721047072,78.55999999999997]);
});

test('缺口独立平滑，空数据和重合点不生成无效控制点', () => {
  assert.deepEqual(smoothLineControls([]), []);
  const segments = lineSegments([[0,1],[1,NaN],[2,3],[2,3],[4,5]]);
  const controls = segments.map(points => smoothLineControls(points));
  assert.deepEqual(controls[0], [{incoming:[0,1],outgoing:[0,1]}]);
  assert.deepEqual(controls[1]![0]!.outgoing, [2,3]);
  assert.ok(controls.flat().every(p => [...p.incoming,...p.outgoing].every(Number.isFinite)));
});
