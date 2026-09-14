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
  return <>
    <PageHeader eyebrow="组件 / 数据展示 / Card" title="Card 卡片" description="把标题、说明、分割线和内容区域组织为统一的信息容器。" />
    <DocsTabs activeKey={tab} onChange={setTab} />
    {tab === "examples" ? <div className="demo-stack">
      <DemoCard title="基础卡片" description="通过强调色快速建立卡片标题的视觉层级。" code={basicCode}>
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
