export interface BarLayoutDatum { value: number; start?: number; hidden?: boolean }
export interface BarLayoutSeries { stack?: string; overlayGroup?: string; data: readonly (number | BarLayoutDatum)[] }

/** Separate stack groups and signs; explicit waterfall offsets do not pollute a stack. */
export function layoutBarValues(series: readonly BarLayoutSeries[], categoryCount: number, stacked = false) {
  const keys = series.map((item, index) => stacked ? "all" : item.stack != null ? `stack:${item.stack}` : `series:${index}`);
  // Overlay groups share a visual slot, but never share cumulative totals.
  const slots = series.map((item,index)=>!stacked && item.overlayGroup != null ? `overlay:${item.overlayGroup}` : keys[index]!);
  const groups = [...new Set(slots)];
  const totals = new Map<string, { positive: number[]; negative: number[] }>();
  const bounds = [0];
  const rows = series.map((item, seriesIndex) => {
    const key = keys[seriesIndex]!;
    const group = totals.get(key) ?? { positive: Array(categoryCount).fill(0) as number[], negative: Array(categoryCount).fill(0) as number[] };
    totals.set(key, group);
    return Array.from({ length: categoryCount }, (_, index) => {
      const input = item.data[index];
      const datum = typeof input === "number" ? { value: input } : input;
      if (!datum || datum.hidden || !Number.isFinite(datum.value)) return null;
      const sign = datum.value >= 0 ? group.positive : group.negative;
      const start = datum.start ?? sign[index]!;
      const end = start + datum.value;
      if (datum.start == null) sign[index] = end;
      bounds.push(start, end);
      return { start, end, value: datum.value, group: groups.indexOf(slots[seriesIndex]!) };
    });
  });
  return { rows, bounds, groups };
}
