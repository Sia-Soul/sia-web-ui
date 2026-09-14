import { Button, Card, Icon } from "@sia.soul/sia-react-ui";
import type { NavItem } from "../navigation";
import { PageHeader } from "./PageHeader";

type PlaceholderPageProps = {
  item?: NavItem;
};

export function PlaceholderPage({ item }: PlaceholderPageProps) {
  if (!item) {
    return (
      <>
        <PageHeader eyebrow="404" title="页面未找到" description="这个地址还没有对应的文档页面。" />
        <Button variant="primary" onClick={() => window.location.assign("/introduction")}>返回介绍</Button>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow={item.eyebrow} title={item.title} description={item.description} />
      <Card className="placeholder-card">
        <div className="placeholder-content">
          <span className="placeholder-icon"><Icon name="component" size={28} /></span>
          <div><h2>独立页面已就绪</h2><p>该组件的示例、API 与设计令牌将在这里持续完善，不会与其他组件混在同一个长页面中。</p></div>
        </div>
      </Card>
    </>
  );
}
