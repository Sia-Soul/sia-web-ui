import { useState } from "react";
import { Button, Drawer, Input, Space, message } from "@sia-ui/react";
import type { DrawerPlacement } from "@sia-ui/react";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

const placementCode = `import { useState } from "react";
import { Button, Drawer } from "@sia-ui/react";
import type { DrawerPlacement } from "@sia-ui/react";

export default function Demo() {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<DrawerPlacement>("right");
  return <>
    {(["left", "right", "top", "bottom"] as DrawerPlacement[]).map((value) => (
      <Button key={value} onClick={() => { setPlacement(value); setOpen(true); }}>{value}</Button>
    ))}
    <Drawer open={open} placement={placement} title={placement + " 抽屉"} onOpenChange={setOpen}>
      这里可以承载表单、详情信息或分步任务。
    </Drawer>
  </>;
}`;

const apiCode = `import { Button, Drawer, Input } from "@sia-ui/react";

export default function Demo() {
  function openDrawer() {
    const handle = Drawer.open({
      title: "API 抽屉",
      children: <Input placeholder="请输入备注" />,
      footer: <Button variant="primary" onClick={() => handle.destroy()}>提交</Button>,
    });
  }
  return <Button onClick={openDrawer}>Drawer.open()</Button>;
}`;

const apiRows = [
  { property: "open", description: "是否显示抽屉", type: "boolean", defaultValue: "false" },
  { property: "placement", description: "出现方向", type: "'left' | 'right' | 'top' | 'bottom'", defaultValue: "'right'" },
  { property: "size", description: "抽屉宽度或高度", type: "number | string", defaultValue: "420 / 320" },
  { property: "title / extra / footer", description: "标题、额外操作和底部区域", type: "ReactNode", defaultValue: "-" },
  { property: "maskClosable / keyboard", description: "遮罩和 Esc 是否允许关闭", type: "boolean", defaultValue: "true" },
  { property: "Drawer.open", description: "通过 API 打开抽屉", type: "(config) => { destroy, update }", defaultValue: "-" },
] as const;

export function DrawerPage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<DrawerPlacement>("right");

  function showDrawer(nextPlacement: DrawerPlacement) {
    setPlacement(nextPlacement);
    setOpen(true);
  }

  function openFromApi() {
    const handle = Drawer.open({
      title: "API 抽屉",
      children: <><p>抽屉通过静态方法创建，可在任意业务逻辑中调用。</p><Input aria-label="API 抽屉备注" placeholder="请输入备注" /></>,
      footer: <Button block variant="primary" onClick={() => {
        handle.destroy();
        message.success("抽屉内容已提交");
      }}>提交</Button>,
    });
  }

  return <>
    <PageHeader eyebrow="组件 / 反馈 / Drawer" title="Drawer 抽屉" description="从屏幕边缘滑出的任务面板，支持四个方向和静态 API。" />
    <DocsTabs activeKey={tab} onChange={setTab} />
    {tab === "examples" ? <div className="demo-stack">
      <DemoCard title="出现方向" description="左、右、上、下四个方向共用一致的交互能力。" code={placementCode}>
        <Space wrap>
          {(["left", "right", "top", "bottom"] as DrawerPlacement[]).map((value) => <Button key={value} onClick={() => showDrawer(value)}>{value}</Button>)}
        </Space>
      </DemoCard>
      <DemoCard title="API 调用" description="无需在当前组件维护 open 状态。" code={apiCode}>
        <Button variant="primary" onClick={openFromApi}>Drawer.open()</Button>
      </DemoCard>
      <Drawer
        open={open}
        placement={placement}
        title={`${placement} 抽屉`}
        onOpenChange={setOpen}
        extra={<Button size="small">帮助</Button>}
        footer={<><Button onClick={() => setOpen(false)}>取消</Button><Button variant="primary" onClick={() => setOpen(false)}>保存</Button></>}
      >
        <p>这里可以承载表单、详情信息或分步任务。</p>
        <Input aria-label="抽屉中的名称" placeholder="请输入名称" />
      </Drawer>
    </div> : <ApiTable name="Drawer" rows={apiRows} />}
  </>;
}
