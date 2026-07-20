import { useState } from "react";
import { Icon, Switch } from "@sia-ui/react";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

const basicCode = `import { useState } from "react";
import { Switch } from "@sia-ui/react";

export default function Demo() {
  const [enabled, setEnabled] = useState(true);
  return <>
    <Switch checked={enabled} onCheckedChange={setEnabled} label={enabled ? "已开启" : "已关闭"} />
    <Switch defaultChecked label="默认开启" />
    <Switch disabled label="禁用" />
  </>;
}`;

const iconCode = `import { useState } from "react";
import { Icon, Switch } from "@sia-ui/react";

export default function Demo() {
  const [dark, setDark] = useState(false);
  return <Switch
    aria-label="显示模式"
    variant="segmented"
    checked={dark}
    onCheckedChange={setDark}
    uncheckedContent={<Icon name="sun" size={20} />}
    checkedContent={<Icon name="moon" size={20} />}
  />;
}`;

const textCode = `import { Switch } from "@sia-ui/react";

export default function Demo() {
  return <>
    <Switch checkedContent="开启" uncheckedContent="关闭" label="自动更新" />
    <Switch variant="segmented" uncheckedContent="月付" checkedContent="年付" />
  </>;
}`;

const apiRows = [
  { property: "checked / defaultChecked", description: "受控值与初始值", type: "boolean", defaultValue: "false" },
  { property: "variant", description: "普通滑块或双选项样式", type: "'standard' | 'segmented'", defaultValue: "'standard'" },
  { property: "checkedContent", description: "选中状态的文字、图标或自定义内容", type: "ReactNode", defaultValue: "-" },
  { property: "uncheckedContent", description: "未选中状态的文字、图标或自定义内容", type: "ReactNode", defaultValue: "-" },
  { property: "label", description: "开关右侧的可见标签", type: "ReactNode", defaultValue: "-" },
  { property: "disabled", description: "禁用开关", type: "boolean", defaultValue: "false" },
  { property: "onCheckedChange", description: "状态变化时返回最新布尔值", type: "(checked: boolean) => void", defaultValue: "-" },
  { property: "onChange", description: "原生 input change 回调", type: "ChangeEventHandler<HTMLInputElement>", defaultValue: "-" },
] as const;

export function SwitchPage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [enabled, setEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [annualBilling, setAnnualBilling] = useState(false);

  return (
    <>
      <PageHeader eyebrow="组件 / 数据录入 / Switch" title="Switch 开关" description="在两个互斥状态之间即时切换，支持普通、图标和文字样式。" />
      <DocsTabs activeKey={tab} onChange={setTab} />
      {tab === "examples" ? <div className="demo-stack">
        <DemoCard title="基础开关" description="支持受控、非受控、标签和禁用状态。" code={basicCode}>
          <div className="component-demo">
            <Switch aria-label="基础开关" checked={enabled} onCheckedChange={setEnabled} label={enabled ? "已开启" : "已关闭"} />
            <Switch aria-label="默认开启的开关" defaultChecked label="默认开启" />
            <Switch aria-label="禁用的开关" disabled label="禁用" />
          </div>
        </DemoCard>
        <DemoCard title="图标双选项" description="适合主题、视图等两个含义明确的互斥选项。" code={iconCode}>
          <div className="component-demo">
            <Switch
              aria-label="显示模式"
              variant="segmented"
              checked={darkMode}
              onCheckedChange={setDarkMode}
              uncheckedContent={<Icon name="sun" size={20} />}
              checkedContent={<Icon name="moon" size={20} />}
            />
            <span className="demo-result">当前模式：{darkMode ? "暗色" : "亮色"}</span>
          </div>
        </DemoCard>
        <DemoCard title="文字内容" description="普通滑块和双选项样式都可以使用文字内容。" code={textCode}>
          <div className="component-demo">
            <Switch
              aria-label="自动更新"
              checked={autoUpdate}
              onCheckedChange={setAutoUpdate}
              checkedContent="开启"
              uncheckedContent="关闭"
              label="自动更新"
            />
            <Switch
              aria-label="计费周期"
              variant="segmented"
              checked={annualBilling}
              onCheckedChange={setAnnualBilling}
              uncheckedContent="月付"
              checkedContent="年付"
            />
            <span className="demo-result">计费周期：{annualBilling ? "年付" : "月付"}</span>
          </div>
        </DemoCard>
      </div> : <ApiTable name="Switch" rows={apiRows} />}
    </>
  );
}
