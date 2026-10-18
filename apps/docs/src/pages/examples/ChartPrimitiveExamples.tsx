import { useCallback, useState } from "react";
import { Button, ChartAxis, ChartDataEditor, ChartDataZoom, ChartLegend, ChartMapOverlay, ChartRoamController, ChartTimeline, ChartToolbox, ChartTooltip, ChartValueIsland, ChartVisualMap, ChartWhirlingLoading, SiaChart, Space, SvgMapPlot, Switch, Typography } from "@sia.soul/sia-react-ui";
import type { MapOverlayHost } from "@sia.soul/sia-react-ui";

/** 图表基础组件分别放入 SVG 或 HTML 容器，保持其真实运行环境。 */
export function ChartPrimitiveExamples() {
  const [event, setEvent] = useState("等待操作");
  const [value, setValue] = useState(50);
  const [zoom, setZoom] = useState<readonly [number, number]>([20, 80]);
  const [pieces, setPieces] = useState([true, true]);
  const [frame, setFrame] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [marks, setMarks] = useState(0);
  const [markActive, setMarkActive] = useState(false);
  const [magic, setMagic] = useState("折线");
  const [position, setPosition] = useState<readonly [number, number]>([300, 120]);
  const [scale, setScale] = useState(1);
  const [dataOpen, setDataOpen] = useState(false);
  // 本地宿主模拟地图投影，只订阅尺寸变化，卸载时释放观察器。
  const createHost = useCallback((element: HTMLDivElement): MapOverlayHost => {
    const listeners = new Set<() => void>();
    const observer = new ResizeObserver(() => listeners.forEach(listener => listener()));
    observer.observe(element);
    return { snapshot: () => ({ width: element.clientWidth, height: element.clientHeight, project: ([x, y]) => [x * element.clientWidth, (1 - y) * element.clientHeight] }), subscribe: (_event, listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, destroy: () => { observer.disconnect(); listeners.clear(); } };
  }, []);
  return <Space direction="vertical" style={{ width: "100%" }}>
    <Space><Switch checked={empty} onCheckedChange={setEmpty} label="空状态" /><Switch checked={loading} onCheckedChange={setLoading} label="加载" /><Switch checked={autoPlay} onCheckedChange={setAutoPlay} label="自动播放" /></Space>
    <SiaChart height={300} title="基础图层" titleVerticalAlign="bottom" svgOverlay={<text x={580} y={30}>叠加文字</text>} palette={["#0e7490"]} loading={loading} empty={empty} emptyContent="自定义空状态" animationDuration={300} tooltipProps={{ placement: "axis", enterable: true }} controlledTooltip={{ point: [350, 80], content: "受控图层提示" }} svgProps={{ onDoubleClick: () => setMarks(count => count + 1) }}>
      <ChartAxis x={50} y={220} length={560} orientation="bottom" labels={["甲", "乙", "丙"]} splitAreaPositions={[0, 0.5, 1]} splitAreaColors={["#e0f2fe", "#f0fdf4"]} gridLength={160} inverse tickInterval={1} showLine showLabels name="类别" axisColor="#0e7490" gridColor="#94a3b8" dashedGrid />
      <ChartLegend items={[{ name: "甲", color: "#0e7490" }, { name: "乙", color: "#16a34a" }]} x={70} y={25} rowGap={24} maxWidth={80} symbol="line" />
      <g transform={`scale(${scale})`}><ChartValueIsland name="拖动暂存值" value={value} x={position[0]} y={position[1]} color="#0e7490" resolveTarget={(element, x, y) => { const target = document.elementFromPoint(x, y)?.closest("[data-island-target]"); return target && element.ownerSVGElement?.contains(target) ? { chart: "demo", series: 0, index: 0 } : null; }} onDrop={(target, point) => { setPosition(point); setEvent(target ? "已放入目标区域" : "已移动暂存值"); }} /></g>
      <rect data-island-target x={500} y={90} width={100} height={60} fill="#e0f2fe" /><text x={510} y={120}>拖放目标</text>
      <ChartRoamController x={640} y={100} onPan={(x, y) => setPosition(([px, py]) => [px + x, py + y])} onZoom={factor => setScale(current => current * factor)} />
      <ChartVisualMap x={60} y={60} min={0} max={100} realtime value={value} onChange={setValue} calculable pieces={[{ max: 50, color: "#0e7490", label: "低值" }, { min: 50, color: "#16a34a", label: "高值" }]} selectedPieces={pieces} onPieceToggle={index => setPieces(current => current.map((selected, i) => i === index ? !selected : selected))} />
    </SiaChart>
    <ChartDataZoom value={zoom} onChange={setZoom} handleLabels={["起点", "终点"]} shadowBounds={{ width: 400, height: 40 }} dataShadow={[10, 30, 20, 60]} panEnabled min={0} max={100} orientation="horizontal" minSpan={10} formatter={number => `${number.toFixed(0)}%`} />
    <ChartTimeline labels={["第一期", "第二期"]} renderer="html" dates={["2026-10-01", "2026-10-02"]} x={0} y={0} width={500} value={frame} onChange={setFrame} autoPlay={autoPlay} loop={false} />
    <SiaChart height={140} timeline={{ labels: ["第一期", "第二期"], value: frame, onChange: setFrame, renderer: "nodes", dates: ["2026-10-01", "2026-10-02"], x: 40, y: 80, width: 600, autoPlay, loop: false }}><text x={100} y={40}>SVG 节点时间轴</text></SiaChart>
    {/* 工具箱使用绝对定位，独立样例需要提供自己的定位容器。 */}
    <div style={{ position: "relative", minHeight: 60, width: "100%" }}><ChartToolbox markActive={markActive} markCount={marks} onMarkUndo={() => setMarks(count => Math.max(0, count - 1))} onMarkClear={() => setMarks(0)} onDataView={() => setDataOpen(current => !current)} onSaveAsImage={() => setEvent("自定义导出回调已触发；完整图表的工具箱提供默认导出")} verticalAlign="bottom" show orientation="horizontal" features={["mark", "dataView", "dataZoom", "restore", "saveAsImage"]} magicTypes={["折线", "柱状"]} activeMagicType={magic} activeMagicTypes={[magic]} filename="基础图层" dataView={<Typography.Text>当前数值：{value}</Typography.Text>} dataViewReadOnly onZoom={() => setZoom([30, 60])} onZoomBack={() => setZoom([0, 100])} zoomBackDisabled={zoom[0] === 0} zoomActive={zoom[0] !== 0} onMark={() => setMarkActive(current => !current)} onMagicTypeChange={setMagic} onRestore={() => { setZoom([0, 100]); setMarks(0); setMagic("折线"); }} /></div>
    {dataOpen && <ChartDataEditor series={[{ name: "样例", data: [value, 40] }]} readOnly onApply={values => setValue(values[0][0])} />}
    <div style={{ position: "relative", height: 80 }}><ChartTooltip placement="above" inheritTextStyle enterable open left={120} top={55}><Button onClick={() => setEvent("点击提示内容")}>可交互提示</Button></ChartTooltip></div>
    <div style={{ position: "relative", height: 100 }}><ChartWhirlingLoading text="自定义加载" textWidth={90} frame={frame * 5} width={500} height={100} /></div>
    <SiaChart height={160}><SvgMapPlot source={'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path name="区域" d="M0 0H100V100H0Z"/></svg>'} name="本地 SVG" data={[{ name: "区域", value: 50 }]} x={50} y={20} width={200} height={120} domain={[0, 100]} colors={["#e0f2fe", "#0e7490"]}><text x={20} y={20}>附加图层</text></SvgMapPlot></SiaChart>
    <ChartMapOverlay createHost={createHost} className="property-map-host" style={{ height: 160, background: "#e0f2fe" }} ariaLabel="本地地图投影宿主" onError={error => setEvent(`地图错误：${String(error)}`)}>{snapshot => <svg width={snapshot.width} height={snapshot.height}><circle cx={snapshot.project([0.5, 0.5])[0]} cy={snapshot.project([0.5, 0.5])[1]} r={12} fill="#0e7490" /><text x={10} y={20}>中心点随容器宽度变化</text></svg>}</ChartMapOverlay>
    <Typography.Text role="status">{event}；标线计数 {marks}（双击图层增加）</Typography.Text>
  </Space>;
}
