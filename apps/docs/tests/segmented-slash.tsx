import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Segmented, Space } from "@sia.soul/sia-react-ui";
import "@sia.soul/sia-react-ui/styles.css";
// 框架独立验收左右闪电折线、长文案、鼠标与键盘，业务接入等待正式发布。
function Fixture() {
  const [value, setValue] = useState<string | number>("materials");
  const options = [{ value: "materials", label: "吊牌视图" }, { value: "categories", label: "商品分类视图" }];
  return <main style={{ padding: 24, background: "#f5f7fa" }}><Space direction="vertical" style={{ alignItems: "flex-start" }}>
    <Segmented aria-label="视图切换" variant="zigzag" value={value} onChange={setValue} options={options} />
    <output>{value}</output>
    <Segmented aria-label="矩形" variant="zigzag" shape="rectangle" options={options} />
    <Segmented aria-label="圆角矩形" variant="zigzag" shape="rounded" options={options} />
    <Segmented aria-label="默认样式" options={options} />
    <Segmented aria-label="禁用样式" variant="zigzag" disabled options={options} />
    <Segmented aria-label="纵向回退" variant="zigzag" vertical options={options} />
  </Space></main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
