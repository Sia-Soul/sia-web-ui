import { useState } from "react";
import { Button, Icon, Input, Space, Tag, ToolPanel } from "@sia-ui/react";
import { ComponentDocPage } from "./ComponentDocPage";
import { DemoCard } from "./DemoCard";

const toolPanelCode = `import { Icon, Input, ToolPanel } from "@sia-ui/react";

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

  return <ComponentDocPage
    eyebrow="组件 / 布局 / ToolPanel"
    title="ToolPanel 工具面板"
    description="为编辑器和工作台提供可折叠、可拖拽调整宽度的左右工具栏。"
    name="ToolPanel"
    apiRows={[
      { property: "title / icon", description: "竖向活动栏的标题和图标", type: "ReactNode", defaultValue: "title 必填" },
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
    <DemoCard title="右侧工具面板" description="placement='right' 时活动栏、内容和拖拽手柄会自动镜像排列。" code={`<ToolPanel placement="right" title="属性" icon={<Icon name="setting" />}>属性内容</ToolPanel>`}>
      <div style={{ display: "flex", justifyContent: "flex-end", width: "100%", height: 220, overflow: "hidden", border: "1px solid var(--sia-color-border)", borderRadius: 8 }}>
        <div style={{ display: "grid", minWidth: 0, flex: 1, placeItems: "center", color: "var(--sia-color-text-secondary)" }}>画布</div>
        <ToolPanel placement="right" title="属性" icon={<Icon name="settings" />} defaultSize={250} minSize={200} maxSize={360}>
          <div style={{ padding: 14 }}><strong>节点属性</strong><p className="demo-result">在右侧调整当前节点的配置。</p></div>
        </ToolPanel>
      </div>
    </DemoCard>
  </ComponentDocPage>;
}
