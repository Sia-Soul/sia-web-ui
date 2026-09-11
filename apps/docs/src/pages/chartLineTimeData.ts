/** Preserve line8's local-calendar overflow and two independent random draws per point. */
export function createLineTimeData(random: () => number = Math.random): [number, number, number][] {
  return Array.from({length: 200}, (_, index) => [
    new Date(2014, 9, 1, 0, (index + 1) * 10000).getTime(),
    Number((random() * 30).toFixed(2)),
    Number((random() * 100).toFixed(2)),
  ]);
}

export function lineTimeSymbolRadius(point: readonly [number, number, number?]): number {
  return Math.round((point[2] ?? 0) / 10) + 2;
}
