import { Checkbox, Space } from "@sia.soul/sia-react-ui";
import { ComponentDocPage } from "./ComponentDocPage";
import { DemoCard } from "./DemoCard";

const providerCode = `import { FloatingScrollbarProvider } from "@sia.soul/sia-react-ui";

export default function App() {
  return <>
    <FloatingScrollbarProvider />
    <main>{/* 应用内容 */}</main>
  </>;
}`;

export function FloatingScrollbarPage({ enabled, onEnabledChange }: { enabled: boolean; onEnabledChange: (enabled: boolean) => void }) {

  return <ComponentDocPage
    eyebrow="组件 / 布局 / FloatingScrollbarProvider"
    title="FloatingScrollbarProvider 浮动滚动条"
    description="为页面中的原生滚动容器绘制不占布局空间的滚动条：默认 3px，鼠标靠近时平滑加宽至 6px，移开后自动收窄，离开容器后自动隐藏。"
    name="FloatingScrollbarProvider"
    apiRows={[
      { property: "disabled", description: "停止扫描滚动容器，移除浮动滚动条并恢复原生滚动条", type: "boolean", defaultValue: "false" },
      { property: "data-sia-native-scrollbar", description: "标记需要保留自身滚动条、不由 Provider 接管的容器", type: "HTML attribute", defaultValue: "-" },
    ]}
  >
    <DemoCard title="应用级自动接管" description="Provider 通常只在应用根节点挂载一次；将鼠标移入下方区域并滚动，离开后浮动轨道会自动隐藏。" code={providerCode}>
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Checkbox checked={enabled} onChange={onEnabledChange}>启用全局浮动滚动条</Checkbox>
        <div style={{ width: "100%", height: 220, overflow: "auto", padding: 14, background: "var(--sia-color-background)", border: "1px solid var(--sia-color-border)", borderRadius: 8 }}>
          <div style={{ width: 920 }}>
            {Array.from({ length: 14 }, (_, index) => <p key={index} style={{ margin: "0 0 12px" }}>
              第 {index + 1} 行：内容区域同时支持横向和纵向滚动，滚动条覆盖在容器边缘，不会挤压正文宽度。
            </p>)}
          </div>
        </div>
      </Space>
    </DemoCard>
    <DemoCard title="保留组件自有滚动条" description="复杂组件已经管理滚动交互时，可用 data-sia-native-scrollbar 跳过自动接管。" code={`<div data-sia-native-scrollbar style={{ overflow: "auto" }}>
  使用容器自己的滚动条
</div>`}>
      <div data-sia-native-scrollbar style={{ width: "100%", maxHeight: 120, overflow: "auto", padding: 12, border: "1px solid var(--sia-color-border)", borderRadius: 8 }}>
        <div style={{ width: 720 }}>这个区域通过 data-sia-native-scrollbar 保留自己的滚动策略，不会生成浮动轨道。</div>
      </div>
    </DemoCard>
  </ComponentDocPage>;
}
