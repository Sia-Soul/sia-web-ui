import React from "react";
import { createRoot } from "react-dom/client";
import { Table, createSelectionPlugin } from "@sia.soul/sia-react-ui";
import "@sia.soul/sia-react-ui/styles.css";

// 重复 id 和首列值不应影响内部主键，缺失显式字段时也必须独立选择。
const rows = [{ id: 1, name: "重复值", note: "第一行" }, { id: 1, name: "重复值", note: "第二行" }];
function Fixture() {
  return <>{[undefined, "missing"].map((key, index) => <section key={index} aria-label={index ? "字段缺失" : "默认主键"}>
    <Table rowKey={key} dataSource={rows} height={200} showIndex={false}
      columns={[{ key: "name", name: "名称", dataIndex: "name" }, { key: "note", name: "说明", dataIndex: "note" }]}
      plugins={[createSelectionPlugin()]} />
  </section>)}</>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
