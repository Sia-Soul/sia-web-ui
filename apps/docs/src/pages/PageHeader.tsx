import { Breadcrumb } from "@sia-ui/react";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  const crumbs = eyebrow.split(" / ");

  return (
    <header className="page-header">
      <Breadcrumb style={{ marginBottom: 18 }} items={crumbs.map((crumb, index) => ({ key: String(index), title: crumb }))} />
      <h1>{title}</h1>
      <p className="lead">{description}</p>
    </header>
  );
}
