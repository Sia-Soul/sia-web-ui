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
      <PageHeader eyebrow="组件 / 通用 / Icon" title="Icon 图标" description="语义清晰、转角柔和的通用线性图标。" />
      <DemoCard title="基础用法" description="通过 name、variant、size、spin 和 rotate 组合图标样式。" code={iconCode}>
        <Space size={18}>
          <Icon name="search" size={24} />
          <Icon name="circle-check" variant="filled" size={24} />
          <Icon name="loader" size={24} spin />
          <Icon name="arrow-right" size={24} rotate={-45} />
        </Space>
      </DemoCard>
      <IconGallery />
    </>
  );
}
