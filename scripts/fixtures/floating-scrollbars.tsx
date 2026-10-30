import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, FloatingScrollbarProvider } from "../../packages/react/src/core";
import { Switch } from "../../packages/react/src/components/Form";
import { ToolPanel } from "../../packages/react/src/components/ToolPanel";
import "../../packages/react/src/styles.css";
import "../../packages/react/src/components-extra.css";

// 不挂载 Provider 的初始页面验证发布入口默认行为；自有外层不能屏蔽后代。
function Fixture() {
  const [disabled, setDisabled] = useState<boolean | undefined>();
  const [native, setNative] = useState(false);
  const [dynamic, setDynamic] = useState(false);
  Object.assign(window, { setScrollbarDisabled: setDisabled, setNative, setDynamic });
  return <>
    <Button>默认入口</Button>
    {disabled !== undefined && <FloatingScrollbarProvider disabled={disabled} />}
    <div data-sia-native-scrollbar style={{ height: 360, overflow: "auto" }}>
      <div id="nested-scroll" data-sia-native-scrollbar={native ? "" : undefined} style={{ width: 240, height: 100, overflow: "auto" }}><div style={{ width: 600, height: 500 }}>内部双向滚动</div></div>
      {dynamic && <div id="dynamic-scroll" style={{ width: 240, height: 100, overflow: "auto" }}><div style={{ height: 500 }}>动态内容</div></div>}
    </div>
    <div style={{ height: 180, display: "flex" }}><ToolPanel title="资源">工具内容</ToolPanel></div>
    <Switch label="开关" /><Switch label="长文字" checkedContent="已开启同步" uncheckedContent="关闭" /><Switch variant="segmented" label="分段" />
  </>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
