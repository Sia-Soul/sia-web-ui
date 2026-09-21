import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, Modal } from "@sia.soul/sia-react-ui";
import "@sia.soul/sia-react-ui/styles.css";

/** 保持父子弹框挂载，验证遮罩动画、关闭回调及退出过程中重新打开。 */
function Fixture() {
  const [open, setOpen] = useState(false);
  const [child, setChild] = useState(false);
  const [closed, setClosed] = useState(0);
  return <>
    <Button onClick={() => setOpen(true)}>打开父弹框</Button>
    <output id="closed">{closed}</output>
    <Modal open={open} title="父弹框" onOpenChange={setOpen} afterOpenChange={value => { if (!value) setClosed(value => value + 1); }}>
      <Button onClick={() => setChild(true)}>打开子弹框</Button>
      <Button onClick={() => { setOpen(false); window.setTimeout(() => setOpen(true), 60); }}>快速重开</Button>
      <Modal open={child} title="子弹框" width={360} onOpenChange={setChild}>子弹框内容</Modal>
    </Modal>
  </>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
