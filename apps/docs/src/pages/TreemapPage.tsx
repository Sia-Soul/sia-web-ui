import { useState } from "react";
import { Space, Tag, Treemap } from "@sia.soul/sia-react-ui";
import type { TreemapNode } from "@sia.soul/sia-react-ui";
import { ComponentDocPage } from "./ComponentDocPage";
import { DemoCard } from "./DemoCard";

const data: readonly TreemapNode[] = [
  {
    key: "source",
    label: "src",
    value: 62,
    kind: "directory",
    children: [
      { key: "components", label: "components", value: 30, kind: "directory", children: [
        { key: "table", label: "Table.tsx", value: 18, color: "#5b8ff9" },
        { key: "editor", label: "Editor.tsx", value: 12, color: "#61d9a5" },
      ] },
      { key: "styles", label: "styles.css", value: 19, color: "#f6bd16" },
      { key: "app", label: "App.tsx", value: 13, color: "#7262fd" },
    ],
  },
  { key: "tests", label: "tests", value: 20, kind: "directory", hasChildren: true, color: "#78d3f8" },
  { key: "docs", label: "README.md", value: 11, color: "#9661bc" },
  { key: "config", label: "package.json", value: 7, color: "#f6903d" },
];

const treemapCode = `import { Treemap } from "@sia.soul/sia-react-ui";

const data = [
  {
    key: "source",
    label: "src",
    value: 62,
    kind: "directory",
    children: [
      { key: "table", label: "Table.tsx", value: 30 },
      { key: "styles", label: "styles.css", value: 19 },
    ],
  },
  { key: "tests", label: "tests", value: 20, kind: "directory" },
];

export default function Demo() {
  return <Treemap data={data} defaultExpandedKeys={["source"]} />;
}`;

export function TreemapPage() {
  const [activeKey, setActiveKey] = useState<string | null>("table");
  const [expandedKeys, setExpandedKeys] = useState<string[]>(["source", "components"]);

  return <ComponentDocPage
    eyebrow="组件 / 数据展示 / Treemap"
    title="Treemap 矩形树图"
    description="按权重用嵌套矩形展示层级数据，支持目录展开、聚焦、选中和节点数量约束。"
    name="Treemap"
    apiRows={[
      { property: "data", description: "树图节点数据", type: "readonly TreemapNode[]", defaultValue: "[]" },
      { property: "activeKey", description: "高亮节点键值", type: "string | null", defaultValue: "null" },
      { property: "expandedKeys / defaultExpandedKeys", description: "受控展开键值或初始展开键值", type: "readonly string[]", defaultValue: "[]" },
      { property: "focusedKey / defaultFocusedKey", description: "占满视图的聚焦目录", type: "string | null", defaultValue: "null" },
      { property: "gap / headerHeight", description: "节点间距和展开目录标题高度", type: "number", defaultValue: "2 / 28" },
      { property: "minLabelWidth / minLabelHeight", description: "显示节点标签所需的最小尺寸", type: "number", defaultValue: "26 / 18" },
      { property: "minTileWidth / minTileHeight", description: "布局保留节点所需的最小尺寸", type: "number", defaultValue: "28 / 18" },
      { property: "maxVisibleNodes", description: "最大可见节点数，超出后合并为其他项", type: "number", defaultValue: "180" },
      { property: "valueFormatter", description: "自定义节点权重显示", type: "(value, node) => ReactNode", defaultValue: "本地化数字" },
      { property: "overflowLabel", description: "自定义合并节点文案", type: "(count: number) => string", defaultValue: "'其他 n 项'" },
      { property: "onExpandedChange / onFocusedChange", description: "目录展开和聚焦变化回调", type: "function", defaultValue: "-" },
      { property: "onNodeClick", description: "节点点击回调", type: "(info: TreemapNodeClickInfo) => void", defaultValue: "-" },
    ]}
  >
    <DemoCard title="目录展开、聚焦与高亮" description="点击目录切换展开；展开后可用右侧按钮聚焦。节点面积与 value 成比例。" code={treemapCode}>
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <div style={{ width: "100%", height: 430 }}>
          <Treemap
            data={data}
            activeKey={activeKey}
            expandedKeys={expandedKeys}
            onExpandedChange={setExpandedKeys}
            onNodeClick={({ node }) => setActiveKey(node.key)}
            valueFormatter={(value) => `${value} KB`}
          />
        </div>
        <Tag status="processing">当前节点：{activeKey ?? "未选择"}；展开：{expandedKeys.join("、") || "无"}</Tag>
      </Space>
    </DemoCard>
    <DemoCard title="空数据与密集数据控制" description="可以自定义空状态，并通过最小尺寸和最大节点数约束复杂数据。" code={`<Treemap data={[]} emptyContent="没有可展示的容量数据" />`}>
      <div style={{ width: "100%", height: 180 }}><Treemap data={[]} emptyContent="没有可展示的容量数据" /></div>
    </DemoCard>
  </ComponentDocPage>;
}
