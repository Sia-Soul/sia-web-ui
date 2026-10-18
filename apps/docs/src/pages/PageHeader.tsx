import { Breadcrumb, Button } from "@sia.soul/sia-react-ui";
import { useLocation, useNavigate } from "react-router-dom";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  const crumbs = eyebrow.split(" / ");
  // 从现有组件页直接进入属性索引，保留组件上下文。
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <header className="page-header">
      <Breadcrumb style={{ marginBottom: 18 }} items={crumbs.map((crumb, index) => ({ key: String(index), title: crumb }))} />
      <h1>{title}</h1>
      <p className="lead">{description}</p>
      {location.pathname.startsWith("/components/") && location.pathname !== "/components/property-examples" ? <Button variant="link" onClick={() => navigate(`/components/property-examples?component=${encodeURIComponent(title.split(" ")[0])}`)}>查看属性样例索引与补充演示</Button> : null}
    </header>
  );
}
