import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, Table, createSelectionPlugin } from "@sia.soul/sia-react-ui";
import "@sia.soul/sia-react-ui/styles.css";

/** 验证全选入口切换不会清空行选择，默认值保持历史行为。 */
function Fixture() {
  const [show, setShow] = useState<boolean>();
  return <><Button onClick={() => setShow(value => value === false)}>切换全选</Button>
    <Table rowKey="id" showIndex={false} striped={false} rowHeight={60} height={300}
      dataSource={[{ id: 1, name: "分类一" }, { id: 2, name: "分类二" }]}
      columns={[{ key: "name", name: "分类", dataIndex: "name" }]}
      plugins={[createSelectionPlugin({ showSelectAll: show })]} />
  </>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
