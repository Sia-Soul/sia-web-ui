import { useState } from "react";
import { Button, Drawer, Input, Space, Tag, message } from "@sia.soul/sia-react-ui";
import type { DrawerPlacement } from "@sia.soul/sia-react-ui";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

const placementCode = `import { useState } from "react";
import { Button, Drawer } from "@sia.soul/sia-react-ui";
import type { DrawerPlacement } from "@sia.soul/sia-react-ui";

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

const apiCode = `import { Button, Drawer, Input } from "@sia.soul/sia-react-ui";

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

const nestedCode = `import { useState } from "react";
import { Button, Drawer } from "@sia.soul/sia-react-ui";

export default function Demo() {
  const [parentOpen, setParentOpen] = useState(false);
  const [childOpen, setChildOpen] = useState(false);

  return <>
    <Button onClick={() => setParentOpen(true)}>打开任务抽屉</Button>
    <Drawer
      open={parentOpen}
      title="任务详情"
      push={{ distance: 140 }}
      onOpenChange={setParentOpen}
      afterOpen={() => console.log("展开完成")}
      afterClose={() => console.log("收起完成")}
    >
      <Button onClick={() => setChildOpen(true)}>编辑负责人</Button>
      <Drawer open={childOpen} title="编辑负责人" size={420} onOpenChange={setChildOpen}>
        子抽屉打开时，父抽屉自动向内推移。
      </Drawer>
    </Drawer>
  </>;
}`;

const apiRows = [
  { property: "open", description: "是否显示抽屉", type: "boolean", defaultValue: "false" },
  { property: "placement", description: "出现方向", type: "'left' | 'right' | 'top' | 'bottom'", defaultValue: "'right'" },
  { property: "size", description: "抽屉宽度或高度", type: "number | string", defaultValue: "760 / 320" },
  { property: "title / extra / footer", description: "标题、额外操作和底部区域", type: "ReactNode", defaultValue: "-" },
  { property: "maskClosable / keyboard", description: "遮罩和 Esc 是否允许关闭", type: "boolean", defaultValue: "true" },
  { property: "push", description: "子抽屉展开时是否推移父抽屉及推移距离", type: "boolean | { distance?: number | string }", defaultValue: "true" },
  { property: "pushDepth", description: "同级 Portal 场景下手动指定累计推移层数", type: "number", defaultValue: "0" },
  { property: "afterOpen / afterClose", description: "展开或收起动画完全结束后的回调", type: "() => void", defaultValue: "-" },
  { property: "Drawer.open", description: "通过 API 打开抽屉", type: "(config) => { destroy, update }", defaultValue: "-" },
] as const;

export function DrawerPage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<DrawerPlacement>("right");
  const [parentOpen, setParentOpen] = useState(false);
  const [childOpen, setChildOpen] = useState(false);
  const [lifecycle, setLifecycle] = useState("等待打开");

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
      <DemoCard title="多层推移与动画回调" description="子抽屉出现时父抽屉自动推移；afterOpen 和 afterClose 只在动画稳定后触发。" code={nestedCode}>
        <Space align="center" wrap>
          <Button variant="primary" onClick={() => { setLifecycle("正在展开"); setParentOpen(true); }}>打开任务抽屉</Button>
          <Tag status="processing">{lifecycle}</Tag>
        </Space>
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
      <Drawer
        open={parentOpen}
        title="任务详情"
        push={{ distance: 140 }}
        onOpenChange={(nextOpen) => { setParentOpen(nextOpen); if (!nextOpen) setChildOpen(false); }}
        afterOpen={() => setLifecycle("父抽屉展开完成")}
        afterClose={() => setLifecycle("父抽屉收起完成")}
        footer={<Button block variant="primary" onClick={() => setParentOpen(false)}>完成</Button>}
      >
        <p>打开子抽屉后，可以观察父抽屉向页面内侧平滑推移。</p>
        <Button onClick={() => setChildOpen(true)}>编辑负责人</Button>
        <Drawer open={childOpen} title="编辑负责人" size={420} onOpenChange={setChildOpen}>
          <Input aria-label="负责人" defaultValue="张敏" />
        </Drawer>
      </Drawer>
    </div> : <ApiTable name="Drawer" rows={apiRows} />}
  </>;
}
