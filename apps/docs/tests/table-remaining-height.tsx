import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Table, createPaginationPlugin, createToolbarPlugin } from "@sia.soul/sia-react-ui";
import "@sia.soul/sia-react-ui/styles.css";

/** 独立浏览器回归入口，覆盖视口、固定容器、隐藏面板和旧高度配置。 */
function Fixture() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const mode = new URLSearchParams(location.search).get("mode");
  const fillRemaining = useMemo(() => ({
    ...(mode === "container" ? { container: () => containerRef.current } : {}),
    bottomOffset: 12,
    minHeight: mode === "minimum" ? 180 : 0,
  }), [mode]);
  return <div ref={containerRef} id="container" style={mode === "container" ? { height: 500, padding: 10, boxSizing: "border-box" } : undefined}>
    <button onClick={() => setExpanded(value => !value)}>切换查询</button>
    <div id="query" style={{ height: expanded ? 150 : 50 }}>查询条件</div>
    <div id="panel" style={mode === "hidden" ? { display: "none" } : undefined}>
      <Table id="table" fillRemaining={mode === "boolean" ? true : fillRemaining} height={mode === "explicit" ? 240 : undefined}
        columns={[{ key: "name", name: "名称", dataIndex: "name" }]}
        dataSource={Array.from({ length: mode === "empty" ? 0 : 300 }, (_, id) => ({ id, name: `记录 ${id}` }))}
        plugins={[createPaginationPlugin({ defaultPageSize: 200 }), createToolbarPlugin({ start: "工具栏" })]} />
    </div>
  </div>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
