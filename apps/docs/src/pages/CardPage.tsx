import { Button, Card } from "@sia.soul/sia-react-ui";
import { useState } from "react";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

const basicCode = `import { Card } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return <Card
    accent="primary"
    title="基础卡片"
    description="标题、说明、分割线和内容区由 Card 统一组织。"
  >
    <div className="content">这里是基础卡片的内容。</div>
  </Card>;
}`;

const collapseCode = `import { Button, Card } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return <Card
    accent="warning"
    title="可收缩卡片"
    description="点击标题区或右侧箭头切换；也可以用 Enter、空格键操作。"
    collapsible
  >
    <div className="content">
      <p>这里是由 Card 自己管理显示状态的内容区域。</p>
      <Button variant="primary" block>内容中的按钮仍参与焦点遍历</Button>
    </div>
  </Card>;
}`;

const scrollCode = `import { Card } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return <Card
    accent="success"
    title="内容滚动模式"
    description="固定 120px 内容视口；内容不会继续撑高 Card，而是在内部滚动。"
    bodyHeight={120}
  >
    {Array.from({ length: 8 }, (_, index) => <p key={index}>滚动内容第 {index + 1} 行</p>)}
  </Card>;
}`;

const apiRows = [
  // 无边框模式统一取消卡片内部留白，业务可通过 bodyStyle 显式调整正文间距。
  { property: "bordered", description: "是否显示外边框及默认内部留白；false 同时移除选中描边、标题左右留白和说明、正文、悬浮操作区内边距，保留内部分割线", type: "boolean", defaultValue: "true" },
  { property: "showSelectedIndicator", description: "是否显示选中角标；关闭后保留选择交互，选中边框仅在 bordered 为 true 时显示", type: "boolean", defaultValue: "true" },
  // 业务仅维护受控值，交互与动画由 Card 提供。
  { property: "selectable / disabled", description: "启用整卡选择；disabled 仅禁用选择", type: "boolean", defaultValue: "false" },
  { property: "selected / defaultSelected", description: "受控选中值与非受控初值", type: "boolean", defaultValue: "false" },
  { property: "onSelectedChange", description: "用户切换时通知新值，内部按钮不触发", type: "(selected: boolean) => void", defaultValue: "-" },
  { property: "hoverActions", description: "悬停或键盘聚焦时从底部滑入，触屏常显", type: "ReactNode", defaultValue: "-" },
  { property: "title / description / extra", description: "标题、说明与标题栏额外内容", type: "ReactNode", defaultValue: "-" },
  { property: "accent / accentColor", description: "标题左侧强调色或自定义色", type: "CardAccent | string", defaultValue: "-" },
  { property: "collapsible", description: "允许收起内容区域", type: "boolean", defaultValue: "false" },
  { property: "collapsed / defaultCollapsed", description: "受控收起状态与默认状态", type: "boolean", defaultValue: "false" },
  { property: "onCollapsedChange", description: "收起状态变化回调", type: "(collapsed: boolean) => void", defaultValue: "-" },
  { property: "bodyHeight", description: "固定内容区高度并开启内部滚动", type: "number | string", defaultValue: "-" },
  { property: "bodyClassName / bodyStyle", description: "内容区类名与样式", type: "string | CSSProperties", defaultValue: "-" },
] as const;

export function CardPage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [selected, setSelected] = useState(false);
  const [detailCount, setDetailCount] = useState(0);
  return <>
    <PageHeader eyebrow="组件 / 数据展示 / Card" title="Card 卡片" description="把标题、说明、分割线和内容区域组织为统一的信息容器。" />
    <DocsTabs activeKey={tab} onChange={setTab} />
    {tab === "examples" ? <div className="demo-stack">
      {/* 展示无边框正文直接贴合容器，背景、圆角与标题分割线仍由 Card 管理。 */}
      <DemoCard title="无边框卡片" description="bordered={false} 同时移除外边框和内部留白；标题分割线仍保留，可通过 bodyStyle 自定义正文间距。" code={'<Card bordered={false} title="无边框卡片" description="说明与正文均无默认内边距。">这里是卡片内容。</Card>'}>
        <Card bordered={false} title="无边框卡片" description="说明与正文均无默认内边距。">这里是卡片内容。</Card>
      </DemoCard>
      <DemoCard title="整卡选择与悬浮操作" description="选中时右上角显示三角勾选标记，重复点击取消选择；详情按钮不改变选中状态。" code={'<Card selectable selected={selected} onSelectedChange={setSelected} hoverActions={<Button>查看详情</Button>}>接口内容</Card>'}>
        <Card selectable selected={selected} onSelectedChange={setSelected} aria-label="示例接口"
          hoverActions={<Button variant="link" onClick={() => setDetailCount(count => count + 1)}>查看详情</Button>}>
          <p>合作关系查询接口</p><p>点击卡片选中，再次点击取消。</p><p>详情查看次数：{detailCount}</p>
        </Card>
      </DemoCard>
      <DemoCard title="仅边框选中" description="筛选卡片可关闭右上角勾选标记，保留选中边框及键盘操作。" code={'<Card selectable showSelectedIndicator={false}>库存紧张</Card>'}>
        <Card selectable showSelectedIndicator={false} defaultSelected aria-label="库存紧张筛选示例">库存紧张</Card>
      </DemoCard>
      {/* 展示默认紧凑间距，正文左右留白仍跟随框架间距配置。 */}
      <DemoCard title="基础卡片" description="标题区最小高度为 40px，正文上下内边距为 6px，左右沿用框架间距；通过强调色区分标题层级。" code={basicCode}>
        <Card accent="primary" title="基础卡片" description="标题、说明、分割线和内容区由 Card 统一组织。">
          <div className="card-demo-surface">这里是基础卡片的内容。</div>
        </Card>
      </DemoCard>
      <DemoCard title="可收缩卡片" description="Card 可自行管理收起状态，也支持 collapsed 受控模式。" code={collapseCode}>
        <Card accent="warning" title="可收缩卡片" description="点击标题区或右侧箭头切换；也可以用 Enter、空格键操作。" collapsible>
          <div className="card-demo-surface">
            <p>这里是由 Card 自己管理显示状态的内容区域。</p>
            <Button variant="primary" block>内容中的按钮仍参与焦点遍历</Button>
          </div>
        </Card>
      </DemoCard>
      <DemoCard title="内容滚动模式" description="固定内容区高度，在卡片内部承载较长信息。" code={scrollCode}>
        <Card accent="success" title="内容滚动模式" description="固定 120px 内容视口；内容不会继续撑高 Card，而是在内部滚动。" bodyHeight={120} bodyClassName="card-demo-scroll">
          {Array.from({ length: 8 }, (_, index) => <p key={index}>滚动内容第 {index + 1} 行</p>)}
        </Card>
      </DemoCard>
    </div> : <ApiTable name="Card" rows={apiRows} />}
  </>;
}
