import type { TableRow } from "./types";

// 共享前缀高度模型：虚拟窗口、按行定位和拖动调整使用同一组偏移，避免变高行后的定位漂移。
export function createRowHeightLayout<T>(rows: readonly TableRow<T>[], baseHeight: number, heights: Readonly<Record<string, number>>, minimumHeight = 1) {
  const offsets = [0];
  const sizes = rows.map(row => {
    const configured = heights[String(row.key)];
    const size = Number.isFinite(configured) && configured > 0 ? Math.max(minimumHeight, configured) : baseHeight;
    offsets.push(offsets[offsets.length - 1] + size);
    return size;
  });
  const indexAt = (position: number) => {
    let low = 0, high = sizes.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (offsets[middle + 1] <= position) low = middle + 1;
      else high = middle;
    }
    return Math.min(low, Math.max(0, sizes.length - 1));
  };
  return { sizes, offsets, total: offsets[offsets.length - 1], indexAt };
}
