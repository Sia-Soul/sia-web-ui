import { useRef, useState } from "react";
import { BarChart, LineChart, Space, Typography } from "@sia.soul/sia-react-ui";
import type { BarChartProps, BarSeries, LineSeries } from "@sia.soul/sia-react-ui";

/** 共享转移适配器：拖动柱形或折线点，把数值合并到同一图表的目标数据点。 */
export function TransferExamples() {
  const initial = [{ name: "样例", data: [20, 40, 30] }];
  const [series, setSeries] = useState<readonly BarSeries[]>(initial);
  const [event, setEvent] = useState("将一个数据点拖到另一个数据点；源值变为 0，目标值增加");
  const source = useRef<{ row: number; index: number; x: number; y: number } | null>(null);
  const transfer: NonNullable<BarChartProps["valueTransfer"]> = {
    islands: [],
    reset: () => { source.current = null; setSeries(initial); },
    props: (row, index) => ({
      "data-bar-transfer-series": row, "data-bar-transfer-index": index,
      style: { cursor: "move", touchAction: "none", pointerEvents: undefined },
      transform: undefined,
      onPointerMove: () => { /* 此适配器只在松手时提交，不绘制拖动中的偏移。 */ },
      onPointerDown: event => { if (event.button !== 0) return; event.stopPropagation(); source.current = { row, index, x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); },
      onPointerCancel: () => { source.current = null; },
      onPointerUp: event => {
        const start = source.current; source.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        if (!start || Math.hypot(start.x - event.clientX, start.y - event.clientY) < 4) return;
        // 限定同一 SVG，避免跨实例拖动误改另一个图表的数据。
        const hit = document.elementsFromPoint(event.clientX, event.clientY).map(element => element.closest("[data-bar-transfer-index]")).find(element => element && element !== event.currentTarget && event.currentTarget.ownerSVGElement?.contains(element));
        if (!hit) { setEvent("请放到同一图表的另一个数据点上"); return; }
        const targetRow = Number(hit.getAttribute("data-bar-transfer-series"));
        const targetIndex = Number(hit.getAttribute("data-bar-transfer-index"));
        if (start.row === targetRow && start.index === targetIndex) return;
        setSeries(current => {
          const next = current.map(item => ({ ...item, data: item.data.map(value => typeof value === "number" ? value : value.value) }));
          next[targetRow].data[targetIndex] += next[start.row].data[start.index];
          next[start.row].data[start.index] = 0;
          return next;
        });
        setEvent(`第 ${start.index + 1} 项已合并到第 ${targetIndex + 1} 项`);
      },
    }),
  };
  // 数字系列同时满足柱形与折线格式；转换保留受控数据更新。
  const lineSeries: readonly LineSeries[] = series.map(item => ({ name: item.name, data: item.data.map(value => typeof value === "number" ? value : value.value) }));
  return <Space direction="vertical" style={{ width: "100%" }}>
    <BarChart title="自定义柱形转移" categories={["甲", "乙", "丙"]} series={series} valueTransfer={transfer} calculable calculableMode="transfer" onDataChange={setSeries} toolbox />
    <LineChart title="共享同一转移策略的折线" categories={["甲", "乙", "丙"]} series={lineSeries} valueTransfer={transfer} calculable calculableMode="transfer" toolbox />
    <Typography.Text role="status">{event}</Typography.Text>
  </Space>;
}
