import { useState } from "react";
import { Button, Col, Divider, Flex, Row, Select, Space, Splitter } from "@sia.soul/sia-react-ui";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";
import { NativeLayoutDemo } from "./NativeLayoutDemo";
import nativeLayoutCode from "./NativeLayoutDemo.tsx?raw";

type DocPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  name: string;
  apiRows: readonly { property: string; description: string; type: string; defaultValue: string }[];
  children: React.ReactNode;
};

function DocPage({ eyebrow, title, description, name, apiRows, children }: DocPageProps) {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  return <>
    <PageHeader eyebrow={eyebrow} title={title} description={description} />
    <DocsTabs activeKey={tab} onChange={setTab} />
    {tab === "examples" ? <div className="demo-stack">{children}</div> : <ApiTable name={name} rows={apiRows} />}
  </>;
}

const flexCode = `import { Button, Flex } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return (
    <Flex wrap gap="medium" align="center" justify="space-between">
      <Button variant="primary">主要操作</Button>
      <Button>默认操作</Button>
      <Button variant="dashed">更多操作</Button>
    </Flex>
  );
}`;

export function FlexPage() {
  return <DocPage
    eyebrow="组件 / 布局 / Flex"
    title="Flex 弹性布局"
    description="不额外包裹子项的一维布局容器，支持方向、换行、对齐和间距。"
    name="Flex"
    apiRows={[
      { property: "orientation / vertical", description: "排列方向", type: "'horizontal' | 'vertical' / boolean", defaultValue: "'horizontal'" },
      { property: "justify", description: "主轴对齐", type: "start | center | end | space-*", defaultValue: "'normal'" },
      { property: "align", description: "交叉轴对齐", type: "start | center | end | stretch | baseline", defaultValue: "'normal'" },
      { property: "gap", description: "预设或自定义间距", type: "'small' | 'medium' | 'large' | number | string", defaultValue: "-" },
      { property: "wrap", description: "是否允许换行", type: "boolean | CSS flex-wrap", defaultValue: "false" },
    ]}
  >
    <DemoCard title="原生排序、尺寸与任务浮层" description="拖动手柄实时预览顺序，相邻项平滑让位；松手吸附后提交，Esc 或列表外松手取消，输入草稿保留。" code={nativeLayoutCode}><NativeLayoutDemo /></DemoCard>
    <DemoCard title="对齐、换行与间距" description="Flex 直接控制子元素布局，不会为每个子元素增加包装节点。" code={flexCode}>
      <Flex wrap gap="medium" align="center" justify="space-between" className="layout-demo-surface">
        <Button variant="primary">主要操作</Button>
        <Button>默认操作</Button>
        <Button variant="dashed">更多操作</Button>
      </Flex>
      <Divider />
      <Flex vertical gap="small">
        <div className="layout-demo-block">纵向内容 A</div>
        <div className="layout-demo-block">纵向内容 B</div>
      </Flex>
    </DemoCard>
  </DocPage>;
}

const gridCode = `import { Col, Row } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={12} lg={8}>A</Col>
      <Col xs={24} md={12} lg={8}>B</Col>
      <Col xs={24} md={24} lg={8}>C</Col>
    </Row>
  );
}`;

export function GridPage() {
  return <DocPage
    eyebrow="组件 / 布局 / Grid"
    title="Grid 栅格"
    description="基于 24 栅格的响应式 Row / Col 布局，支持间距、偏移和排序。"
    name="Row / Col"
    apiRows={[
      { property: "Row.gutter", description: "水平与垂直栅格间距", type: "number | string | [horizontal, vertical]", defaultValue: "0" },
      { property: "Row.justify / align", description: "水平和垂直对齐", type: "响应式对齐值", defaultValue: "start / top" },
      { property: "Col.span", description: "占据的栅格数", type: "0 - 24", defaultValue: "24" },
      { property: "Col.offset / push / pull / order", description: "偏移、移动和排序", type: "number", defaultValue: "0" },
      { property: "Col.xs - xxl", description: "响应式断点配置", type: "number | ColSize", defaultValue: "-" },
    ]}
  >
    <DemoCard title="24 栅格与响应式" description="缩放页面时，三列会依次变为两列和单列。" code={gridCode}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} lg={8}><div className="grid-demo-cell">Col A</div></Col>
        <Col xs={24} md={12} lg={8}><div className="grid-demo-cell">Col B</div></Col>
        <Col xs={24} md={24} lg={8}><div className="grid-demo-cell">Col C</div></Col>
      </Row>
      <Divider />
      <Row gutter={12}>
        <Col span={6}><div className="grid-demo-cell">6</div></Col>
        <Col span={12}><div className="grid-demo-cell">12</div></Col>
        <Col span={6}><div className="grid-demo-cell">6</div></Col>
      </Row>
    </DemoCard>
  </DocPage>;
}

const spaceCode = `import { Button, Divider, Select, Space } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return (
    <>
      <Space wrap size={["medium", "small"]} split={<Divider orientation="vertical" />}>
        <Button>编辑</Button><Button>复制</Button><Button>删除</Button>
      </Space>
      <Space.Compact block>
        <Button>左侧</Button><Button>中间</Button><Button>右侧</Button>
      </Space.Compact>
      <Space.Compact block>
        <Select style={{ width: 160 }} placeholder="标签匹配模式" placeholderMode="floating" defaultValue="include" options={[{ value: "include", label: "包含标签" }, { value: "exclude", label: "排除标签" }]} />
        <Select style={{ flex: 1, minWidth: 0 }} placeholder="品牌方标签" options={[{ value: "brand", label: "品牌方标签" }]} />
      </Space.Compact>
    </>
  );
}`;

export function SpacePage() {
  return <DocPage
    eyebrow="组件 / 布局 / Space"
    title="Space 间距"
    description="为同行或同列元素提供稳定间距、分隔内容和紧凑组合。"
    name="Space"
    apiRows={[
      { property: "direction", description: "间距方向", type: "'horizontal' | 'vertical'", defaultValue: "'horizontal'" },
      { property: "size", description: "水平/垂直间距", type: "LayoutGap | [LayoutGap, LayoutGap]", defaultValue: "'medium'" },
      { property: "align / wrap", description: "对齐和自动换行", type: "align / boolean", defaultValue: "center / false" },
      { property: "split", description: "相邻元素之间的分隔内容", type: "ReactNode", defaultValue: "-" },
      { property: "Space.Compact", description: "连接相邻控件边框", type: "direction / block", defaultValue: "-" },
    ]}
  >
    <DemoCard title="间距、分隔符与 Compact" description="Space 适合内联操作区，Compact 用于组成连续控件。" code={spaceCode}>
      <Space wrap size={["medium", "small"]} split={<Divider orientation="vertical" />}>
        <Button>编辑</Button><Button>复制</Button><Button danger>删除</Button>
      </Space>
      <Divider />
      <Space.Compact block>
        <Button>左侧</Button><Button>中间</Button><Button variant="primary">右侧</Button>
      </Space.Compact>
      <Divider />
      <Space.Compact block>
        <Select style={{ width: 160 }} placeholder="标签匹配模式" placeholderMode="floating" defaultValue="include" options={[{ value: "include", label: "包含标签" }, { value: "exclude", label: "排除标签" }]} />
        <Select style={{ flex: 1, minWidth: 0 }} placeholder="品牌方标签" options={[{ value: "brand", label: "品牌方标签" }]} />
      </Space.Compact>
    </DemoCard>
  </DocPage>;
}

const splitterCode = `import { Splitter } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return (
    <Splitter style={{ height: 240 }}>
      <Splitter.Panel defaultSize={35} min={20}>目录</Splitter.Panel>
      <Splitter.Panel min={30}>内容</Splitter.Panel>
    </Splitter>
  );
}`;

export function SplitterPage() {
  const [sizes, setSizes] = useState<readonly number[]>([35, 65]);
  return <DocPage
    eyebrow="组件 / 布局 / Splitter"
    title="Splitter 分隔面板"
    description="通过鼠标拖拽或方向键调整相邻面板尺寸。"
    name="Splitter"
    apiRows={[
      { property: "orientation", description: "面板排列方向", type: "'horizontal' | 'vertical'", defaultValue: "'horizontal'" },
      { property: "onResize / onResizeEnd", description: "调整中和完成回调", type: "(sizes: number[]) => void", defaultValue: "-" },
      { property: "Panel.defaultSize", description: "初始百分比", type: "number", defaultValue: "自动分配" },
      { property: "Panel.min / max", description: "尺寸边界百分比", type: "number", defaultValue: "0 / 100" },
      { property: "Panel.resizable", description: "是否允许调整", type: "boolean", defaultValue: "true" },
    ]}
  >
    <DemoCard title="水平面板" description={`当前尺寸：${sizes.map((item) => Math.round(item)).join("% / ")}%`} code={splitterCode}>
      <Splitter style={{ height: 240 }} onResize={setSizes}>
        <Splitter.Panel defaultSize={35} min={20}><div className="splitter-demo-panel">项目目录</div></Splitter.Panel>
        <Splitter.Panel min={30}><div className="splitter-demo-panel is-secondary">内容工作区</div></Splitter.Panel>
      </Splitter>
    </DemoCard>
  </DocPage>;
}
