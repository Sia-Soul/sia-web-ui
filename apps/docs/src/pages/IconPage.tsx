import { Icon, Space } from "@sia.soul/sia-react-ui";
import { IconGallery } from "../IconGallery";
import { DemoCard } from "./DemoCard";
import { PageHeader } from "./PageHeader";

const iconCode = `import { Icon, Space } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return <Space size={18}>
    <Icon name="search" size={24} />
    <Icon name="circle-check" variant="filled" size={24} />
    <Icon name="loader" size={24} spin />
    <Icon name="arrow-right" size={24} rotate={-45} />
  </Space>;
}`;

export function IconPage() {
  return (
    <>
      <PageHeader eyebrow="组件 / 通用 / Icon" title="Icon 图标" description="24×24 画布，主体最长边统一为 18 单位，等比居中；主体边界不含描边。size 控制整个画布的显示尺寸。" />
      <DemoCard title="基础用法" description="通过 name、variant、size、spin 和 rotate 组合图标样式。" code={iconCode}>
        <Space size={18}>
          <Icon name="search" size={24} />
          <Icon name="circle-check" variant="filled" size={24} />
          <Icon name="loader" size={24} spin />
          <Icon name="arrow-right" size={24} rotate={-45} />
        </Space>
      </DemoCard>
      {/* 常用工具栏图标并排比较，覆盖小尺寸下的描边及视觉比例。 */}
      <DemoCard title="统一主体尺寸" description="时钟、刷新、设置使用相同 size。分别展示 16、24、32 px 外框；对应主体最长边为 12、18、24 px。" code={'<Space><Icon name="clock" size={24} /><Icon name="refresh" size={24} /><Icon name="settings" size={24} /></Space>'}>
        <Space size={32}>
          {[16, 24, 32].map(size => <Space key={size} size={16}><span>{size}px</span><Icon name="clock" size={size} /><Icon name="refresh" size={size} /><Icon name="settings" size={size} /></Space>)}
        </Space>
      </DemoCard>
      <IconGallery />
    </>
  );
}
