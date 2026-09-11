export type ChartMotionPoint = readonly [number, number];

/** Collapse the entire shape, including area boundaries, onto its first point. */
export function chartMotionBaseline(points: readonly ChartMotionPoint[], horizontal = false): ChartMotionPoint[] {
  return points.map((point) => horizontal
    ? [points[0]?.[0] ?? point[0], point[1]]
    : [point[0], points[0]?.[1] ?? point[1]]);
}

export function interpolateChartPoints(from: readonly ChartMotionPoint[], to: readonly ChartMotionPoint[], progress: number): ChartMotionPoint[] {
  const t = Math.max(0, Math.min(1, progress));
  const eased = t === 1 ? 1 : 1 - 2 ** (-10 * t);
  return to.map((point, index) => {
    if (!point.every(Number.isFinite)) return [point[0], point[1]];
    const candidate = from[index];
    const origin = candidate?.every(Number.isFinite) ? candidate : point;
    return [origin[0] + (point[0] - origin[0]) * eased, origin[1] + (point[1] - origin[1]) * eased];
  });
}
