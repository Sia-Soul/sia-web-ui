import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, Input, Modal, Select } from "@sia.soul/sia-react-ui";
import "@sia.soul/sia-react-ui/styles.css";

/** 覆盖默认、显式焦点、选择器、静态调用、嵌套弹框与焦点归还。 */
function Demo() {
  const [mode, setMode] = useState("");
  const [child, setChild] = useState(false);
  return <>
    {["默认", "关闭自动聚焦", "显式焦点", "选择器", "无输入"].map(value => <Button key={value} onClick={() => setMode(value)}>{value}</Button>)}
    <Button onClick={() => Modal.open({ title: "静态", children: <Input aria-label="静态输入" /> })}>静态调用</Button>
    <Modal open={!!mode} title="父弹框" autoFocus={mode !== "关闭自动聚焦"} onOpenChange={open => { if (!open) setMode(""); }}>
      {mode === "无输入" ? "说明内容" : mode === "选择器" ? <Select aria-label="首个选择器" options={[{value:"a",label:"选项"}]} /> : <>
        <div hidden><Input aria-label="隐藏字段" /></div>
        <div style={{ display: "none" }}><Input aria-label="样式隐藏字段" /></div>
        <fieldset disabled><Input aria-label="禁用字段" /></fieldset>
        <Input aria-label="只读字段" readOnly />
        <Input aria-label="首个输入" />
        <Input aria-label="第二个输入" autoFocus={mode === "显式焦点"} />
      </>}
      <Button onClick={() => setChild(true)}>打开子弹框</Button>
    </Modal>
    <Modal open={child} title="子弹框" onOpenChange={setChild}><Input aria-label="子输入" /></Modal>
  </>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Demo /></StrictMode>);
