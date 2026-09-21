import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, Drawer, Form, Input, Modal, Tooltip } from "@sia.soul/sia-react-ui";
import "@sia.soul/sia-react-ui/styles.css";

/** 受控校验错误始终保留，用于验证子弹框只能遮挡提示，不能清空父表单状态。 */
function Fixture() {
  const [parent, setParent] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [child, setChild] = useState(false);
  const fields = <div style={{ padding: "50px 140px", height: 360 }}>
    <Form><Form.Item label="吊牌编码" validateStatus="error" help="请输入吊牌编码"><Input /></Form.Item></Form>
    <Button onClick={() => setChild(true)}>打开子弹框</Button>
  </div>;
  return <>
    <Tooltip open title="页面提示"><span>页面锚点</span></Tooltip>
    <Button onClick={() => setParent(true)}>打开父弹框</Button>
    <Button onClick={() => setDrawer(true)}>打开父抽屉</Button>
    <Modal open={parent} title="父弹框" width={1000} zIndex={2000} onOpenChange={setParent}>{fields}</Modal>
    <Drawer open={drawer} title="父抽屉" size={1000} zIndex={2000} onOpenChange={setDrawer}>{fields}</Drawer>
    <Modal open={child} title="子弹框" width={900} height={620} zIndex={2001} onOpenChange={setChild}>
      <div style={{ paddingTop: 280 }}><Form><Form.Item validateStatus="error" help="子级必填提示"><Input /></Form.Item></Form></div>
    </Modal>
  </>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
