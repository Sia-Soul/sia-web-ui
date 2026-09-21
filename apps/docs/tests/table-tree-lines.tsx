import React from "react";
import { createRoot } from "react-dom/client";
import { Table, createTreePlugin, createSelectionPlugin } from "@sia.soul/sia-react-ui";
import "@sia.soul/sia-react-ui/styles.css";

/** 覆盖多级分支、末尾节点、跨行延续、禁选和虚拟滚动后的独立连线。 */
const data = [{ id: "root", name: "手机配件", children: [
  { id: "case", name: "手机壳", children: [{ id: "red", name: "红色" }] },
  { id: "charger", name: "充电器（已关联其他吊牌）" },
  { id: "ear", name: "耳机" },
] }, ...Array.from({ length: 100 }, (_, i) => ({ id: `root${i}`, name: `鞋子${i}`, children: [
  { id: `child${i}`, name: "小白鞋", children: [{ id: `leaf${i}`, name: "运动款" }] },
] }))];
createRoot(document.getElementById("root")!).render(<Table rowKey="id" showIndex={false} height={420}
  dataSource={data} columns={[{ key: "name", name: "商品分类", dataIndex: "name" }]}
  plugins={[createTreePlugin({ ignoreChildrenColumn: false, defaultExpandAllRows: true, showLine: true }),
    createSelectionPlugin({ mode: "multiple", getCheckboxDisabled: row => row.id === "charger" })]} />);
