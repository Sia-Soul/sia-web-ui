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
      {/* 业务图标与既有圆角图标同尺寸并排，便于检查轮廓、线重及小尺寸细节是否协调。 */}
      <DemoCard title="圆角业务图标" description="每行前四个为原有图标，后六个为业务图标。箱体、单据与屋顶使用圆弧轮廓，沿用默认描边。" code={'<Icon name="package" size={16} />\n<Icon name="order-receipt" size={16} />'}>
        <Space direction="vertical" align="start" size={20}>
          {[16, 24, 32].map(size => (
            <Space key={size} size={20} wrap>
              <span>{size}px</span>
              {(["copy", "calendar", "mail", "lock", "package", "order-receipt", "warehouse", "after-sales", "stocktaking", "platform-message"] as const).map(name => (
                <Icon key={name} name={name} size={size} title={name} />
              ))}
            </Space>
          ))}
        </Space>
      </DemoCard>
      {/* 文件系列同时展示轮廓与实心版本，检查真实圆弧和小尺寸辨识度。 */}
      <DemoCard title="圆角文件图标" description="文件外框、折页和文件夹标签使用真实圆弧；ChooseBox 与其他组件共用这些图标。" code={'<Icon name="file" size={24} />\n<Icon name="folder" size={24} />\n<Icon name="folder" variant="filled" size={24} />'}>
        <Space direction="vertical" align="start" size={20}>
          {[16, 24, 32].map(size => <Space key={size} size={20} wrap><span>{size}px</span>
            {(["file", "folder", "folder-plus", "file-plus", "file-check", "file-warning", "file-spreadsheet"] as const).map(name => <Icon key={name} name={name} size={size} title={name} />)}
            <Icon name="file" variant="filled" size={size} title="实心文件" /><Icon name="folder" variant="filled" size={size} title="实心文件夹" />
          </Space>)}
        </Space>
      </DemoCard>
      {/* 并排检查内部符号留白及同系列主体比例，切换主题时沿用当前页面主题。 */}
      <DemoCard title="圆角轮廓与内部对齐" description="加号、勾号按内容区居中；音量开关保持主体一致。对比三种尺寸下的留白、圆角和描边。" code={'<Icon name="folder-plus" size={24} />\n<Icon name="square-check" size={24} />\n<Icon name="camera" size={24} />'}>
        <Space direction="vertical" align="start" size={20}>
          {[16, 24, 32].map(size => <Space key={size} size={20} wrap><span>{size}px</span>
            {(["folder-plus", "tab-plus", "file-check", "square-check", "clipboard-check", "shield-check", "camera", "printer", "book", "mobile", "volume-up", "volume-off"] as const).map(name => <Icon key={name} name={name} size={size} title={name} />)}
          </Space>)}
        </Space>
      </DemoCard>
      <IconGallery />
      {/* 语义色使用主题变量，图标颜色不影响相邻说明文字。 */}
      <DemoCard title="语义颜色" description="tone 默认继承文字颜色；primary、success、warning、danger 跟随主题。" code={'<Icon name="shop" tone="primary" />'}>
        <Space>{(["inherit", "primary", "success", "warning", "danger"] as const).map(tone => <Space key={tone}><Icon name="shop" tone={tone} /><span>{tone}</span></Space>)}</Space>
      </DemoCard>
    </>
  );
}
