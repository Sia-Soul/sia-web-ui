import assert from "node:assert/strict";
import test from "node:test";
import { chartMotionBaseline, interpolateChartPoints } from "./chartMotion.ts";

test('缺失点在所有动画帧保持缺失，回填不从 NaN 插值',()=>{
 for(const progress of [0,.1,.5,1]) {
  const frame=interpolateChartPoints([[0,0],[1,NaN]],[[0,2],[1,NaN]],progress);
  assert.ok(Number.isNaN(frame[1]![1]));
  assert.deepEqual(interpolateChartPoints([[1,NaN]],[[1,4]],progress),[[1,4]]);
 }
});

test("折线起点为首点水平基线，横向图为竖直基线", () => {
  const points = [[10, 20], [30, 60], [50, -10]] as const;
  assert.deepEqual(chartMotionBaseline(points), [[10, 20], [30, 20], [50, 20]]);
  assert.deepEqual(chartMotionBaseline(points, true), [[10, 20], [10, 60], [10, -10]]);
  assert.deepEqual(chartMotionBaseline([]), []);
});

test("指数缓出中间帧、边界和最终帧精确可复现", () => {
  const from = [[0, 0]] as const;
  const to = [[100, 200]] as const;
  assert.deepEqual(interpolateChartPoints(from, to, 0), from);
  assert.deepEqual(interpolateChartPoints(from, to, .1), [[50, 100]]);
  assert.deepEqual(interpolateChartPoints(from, to, .5), [[96.875, 193.75]]);
  assert.deepEqual(interpolateChartPoints(from, to, 1), to);
  assert.deepEqual(interpolateChartPoints(from, to, -1), from);
  assert.deepEqual(interpolateChartPoints(from, to, 2), to);
});

test("面积图的上下边界从同一基线插值，首帧面积为零", () => {
  const polygon = [[0, 30], [10, 10], [0, 100], [10, 70]] as const;
  const baseline = chartMotionBaseline(polygon);
  assert.deepEqual(baseline.map((point) => point[1]), [30, 30, 30, 30]);
  assert.deepEqual(interpolateChartPoints(baseline, polygon, .1), [[0, 30], [10, 20], [0, 65], [10, 50]]);
});

test("更新可从当前中间帧续接且不修改输入数据", () => {
  const from = [[0, 0]] as const;
  const first = interpolateChartPoints(from, [[100, 100]], .1);
  assert.deepEqual(interpolateChartPoints(first, [[200, 0]], 0), first);
  assert.deepEqual(interpolateChartPoints(first, [[200, 0]], .1), [[125, 25]]);
  assert.deepEqual(from, [[0, 0]]);
  assert.deepEqual(interpolateChartPoints([], [[1, 2]], .5), [[1, 2]]);
});
