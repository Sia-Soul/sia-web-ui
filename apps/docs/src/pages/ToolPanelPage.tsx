import { useState } from "react";
import { Button, Icon, Input, Space, Tag, ToolPanel } from "@sia.soul/sia-react-ui";
import { ComponentDocPage } from "./ComponentDocPage";
import { DemoCard } from "./DemoCard";

const toolPanelCode = `import { Icon, Input, ToolPanel } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return <div style={{ display: "flex", height: 320 }}>
    <ToolPanel
      title="资源"
      icon={<Icon name="folder" />}
      defaultSize={280}
      minSize={220}
      maxSize={420}
      onResizeEnd={(size) => console.log(size)}
    >
      <Input placeholder="搜索资源" />
    </ToolPanel>
    <main>工作区</main>
  </div>;
}`;

export function ToolPanelPage() {
  const [open, setOpen] = useState(true);
  const [size, setSize] = useState(280);
  const [activeKey, setActiveKey] = useState("resources");

  return <ComponentDocPage
    eyebrow="组件 / 布局 / ToolPanel"
    title="ToolPanel 工具面板"
    description="为编辑器和工作台提供支持多面板切换、可折叠、可拖拽调整宽度的左右工具栏。"
    name="ToolPanel"
    apiRows={[
      { property: "title / icon", description: "单面板模式的标题和图标，内容通过 children 传入", type: "ReactNode", defaultValue: "-" },
      { property: "items", description: "多面板配置；提供后优先于 title、icon 和 children。切换保留内容状态，共享面板宽度", type: "readonly ToolPanelItem[]", defaultValue: "-" },
      { property: "items[].key / title / icon / children / disabled", description: "唯一标识、入口标题、图标、面板内容与禁用状态", type: "string / ReactNode / ReactNode / ReactNode / boolean", defaultValue: "disabled: false" },
      { property: "activeKey / defaultActiveKey", description: "受控或初始活动面板；未匹配可用项时显示第一个可用面板", type: "string", defaultValue: "首个可用面板" },
      { property: "onActiveKeyChange", description: "切换面板时触发；再次点击当前入口仅切换展开状态", type: "(key: string) => void", defaultValue: "-" },
      { property: "placement", description: "工具面板位于工作区左侧或右侧", type: "'left' | 'right'", defaultValue: "'left'" },
      { property: "open / defaultOpen", description: "受控展开状态或初始状态", type: "boolean", defaultValue: "true" },
      { property: "defaultSize", description: "初始面板宽度", type: "number", defaultValue: "320" },
      { property: "minSize / maxSize", description: "拖拽调整的宽度范围", type: "number", defaultValue: "220 / 640" },
      { property: "onOpenChange", description: "活动栏切换展开状态时触发", type: "(open: boolean) => void", defaultValue: "-" },
      { property: "onResize", description: "拖拽调整过程中持续触发", type: "(size: number) => void", defaultValue: "-" },
      { property: "onResizeEnd", description: "鼠标或键盘调整结束时触发", type: "(size: number) => void", defaultValue: "-" },
    ]}
  >
    <DemoCard title="可折叠与调整尺寸" description="点击竖向入口展开或收起；拖动分隔线，或聚焦后使用左右方向键调整宽度。" code={toolPanelCode}>
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Space align="center">
          <Button size="small" onClick={() => setOpen((current) => !current)}>{open ? "收起" : "展开"}面板</Button>
          <Tag status="processing">当前宽度：{size}px</Tag>
        </Space>
        <div style={{ display: "flex", width: "100%", height: 330, overflow: "hidden", border: "1px solid var(--sia-color-border)", borderRadius: 8 }}>
          <ToolPanel
            title="资源"
            icon={<Icon name="folder" />}
            open={open}
            onOpenChange={setOpen}
            defaultSize={280}
            minSize={220}
            maxSize={420}
            onResize={setSize}
          >
            <div style={{ height: "100%", padding: 14, background: "var(--sia-color-surface)" }}>
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <strong>项目资源</strong>
                <Input aria-label="搜索资源" placeholder="搜索文件" prefix={<Icon name="search" />} />
                <Button block variant="text" icon={<Icon name="file" />}>需求说明.md</Button>
                <Button block variant="text" icon={<Icon name="image" />}>界面预览.png</Button>
              </Space>
            </div>
          </ToolPanel>
          <div style={{ display: "grid", minWidth: 0, flex: 1, placeItems: "center", color: "var(--sia-color-text-secondary)", background: "var(--sia-color-background)" }}>
            工作区会随工具面板尺寸自适应
          </div>
        </div>
      </Space>
    </DemoCard>
    <DemoCard title="多面板切换" description="同一活动栏配置资源、搜索和大纲等多个面板。切换时蓝色指示条以 240ms 滑动到对应入口，再次点击当前入口收起；输入内容和调整后的宽度会保留。" code={`import { useState } from "react";
import { Icon, Input, ToolPanel } from "@sia.soul/sia-react-ui";

export default function Demo() {
  const [activeKey, setActiveKey] = useState("resources");
  return <div style={{ display: "flex", height: 330 }}>
    <ToolPanel activeKey={activeKey} onActiveKeyChange={setActiveKey}
      defaultSize={260} minSize={200} maxSize={420}
      items={[
        { key: "resources", title: "资源", icon: <Icon name="folder" />, children: <Input placeholder="搜索文件" /> },
        { key: "search", title: "搜索", icon: <Icon name="search" />, children: <Input placeholder="搜索项目内容" /> },
        { key: "outline", title: "大纲", icon: <Icon name="list-unordered" />, children: <p>页面结构与章节</p> },
        { key: "history", title: "历史", icon: <Icon name="clock" />, disabled: true, children: null },
      ]}
    />
    <main style={{ flex: 1, minWidth: 0 }}>工作区</main>
  </div>;
}`}>
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Space wrap>
          <Button size="small" onClick={() => setActiveKey("resources")}>切换到资源</Button>
          <Button size="small" onClick={() => setActiveKey("search")}>切换到搜索</Button>
          <Tag status="processing">当前面板：{activeKey}</Tag>
        </Space>
        <div className="tool-panel-multiple-demo" style={{ display: "flex", width: "100%", height: 330, overflow: "hidden", border: "1px solid var(--sia-color-border)", borderRadius: 8 }}>
          <ToolPanel activeKey={activeKey} onActiveKeyChange={setActiveKey} defaultSize={260} minSize={200} maxSize={420} items={[
            { key: "resources", title: "资源", icon: <Icon name="folder" />, children: <Space direction="vertical" size={12} style={{ display: "flex", padding: 14 }}><strong>项目资源</strong><Input aria-label="多面板搜索文件" placeholder="搜索文件" /><Button variant="text" icon={<Icon name="file" />}>需求说明.md</Button><Button variant="text" icon={<Icon name="image" />}>界面预览.png</Button></Space> },
            { key: "search", title: "搜索", icon: <Icon name="search" />, children: <Space direction="vertical" size={12} style={{ display: "flex", padding: 14 }}><strong>全文搜索</strong><Input aria-label="搜索项目内容" placeholder="搜索项目内容" prefix={<Icon name="search" />} /><p className="demo-result">输入关键词后切换面板，再回来时内容仍会保留。</p></Space> },
            { key: "outline", title: "大纲", icon: <Icon name="list-unordered" />, children: <Space direction="vertical" size={12} style={{ display: "flex", padding: 14 }}><strong>页面大纲</strong><Button variant="text">项目介绍</Button><Button variant="text">功能设计</Button><Button variant="text">交互说明</Button></Space> },
            { key: "history", title: "历史", icon: <Icon name="clock" />, disabled: true, children: null },
          ]} />
          <div style={{ display: "grid", minWidth: 0, flex: 1, placeItems: "center", padding: 16, color: "var(--sia-color-text-secondary)", background: "var(--sia-color-background)" }}>切换左侧面板，工作区始终保留</div>
        </div>
      </Space>
    </DemoCard>
    <DemoCard title="右侧多面板" description="placement='right' 时活动栏、内容和拖拽手柄会自动镜像排列，同样支持多面板切换。" code={`<ToolPanel placement="right" defaultActiveKey="properties" items={[
  { key: "properties", title: "属性", icon: <Icon name="settings" />, children: <p>节点属性</p> },
  { key: "layers", title: "图层", icon: <Icon name="list-unordered" />, children: <p>画布图层</p> },
]} />`}>
      <div style={{ display: "flex", justifyContent: "flex-end", width: "100%", height: 220, overflow: "hidden", border: "1px solid var(--sia-color-border)", borderRadius: 8 }}>
        <div style={{ display: "grid", minWidth: 0, flex: 1, placeItems: "center", color: "var(--sia-color-text-secondary)" }}>画布</div>
        <ToolPanel placement="right" defaultActiveKey="properties" defaultSize={250} minSize={200} maxSize={360} items={[
          { key: "properties", title: "属性", icon: <Icon name="settings" />, children: <div style={{ padding: 14 }}><strong>节点属性</strong><p className="demo-result">在右侧调整当前节点的配置。</p><Input aria-label="节点名称" placeholder="节点名称" /></div> },
          { key: "layers", title: "图层", icon: <Icon name="list-unordered" />, children: <Space direction="vertical" size={12} style={{ display: "flex", padding: 14 }}><strong>画布图层</strong><Button variant="text">背景图层</Button><Button variant="text">内容图层</Button></Space> },
        ]} />
      </div>
    </DemoCard>
  </ComponentDocPage>;
}
