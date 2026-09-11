type Point = readonly [number, number];

/** Distance-weighted cubic tangents; each disconnected segment owns its endpoints. */
export function smoothLineControls(points: readonly Point[], tension = 0.3) {
  const minimum = [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1]))];
  const maximum = [Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
  const constrain = (point: number[]) => point.map((value, axis) => Math.max(minimum[axis]!, Math.min(maximum[axis]!, value)));
  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) {
      return {incoming: [...point], outgoing: [...point]};
    }
    const before = points[index - 1]!, after = points[index + 1]!;
    const a = Math.hypot(point[0] - before[0], point[1] - before[1]);
    const b = Math.hypot(after[0] - point[0], after[1] - point[1]);
    const total = a + b || 1;
    return {
      incoming: constrain([point[0] - (after[0] - before[0]) * tension * a / total, point[1] - (after[1] - before[1]) * tension * a / total]),
      outgoing: constrain([point[0] + (after[0] - before[0]) * tension * b / total, point[1] + (after[1] - before[1]) * tension * b / total]),
    };
  });
}
