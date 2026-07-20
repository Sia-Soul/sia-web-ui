type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  const crumbs = eyebrow.split(" / ");

  return (
    <header className="page-header">
      <div className="breadcrumb">
        {crumbs.map((crumb, index) => <span key={crumb}>{index > 0 ? <i>/</i> : null}{crumb}</span>)}
      </div>
      <h1>{title}</h1>
      <p className="lead">{description}</p>
    </header>
  );
}
