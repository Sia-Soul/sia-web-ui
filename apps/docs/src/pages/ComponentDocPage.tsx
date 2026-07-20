import { useState } from "react";
import type { ReactNode } from "react";
import { ApiTable } from "./ApiTable";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

export type ComponentApiRow = { property: string; description: string; type: string; defaultValue: string };
export function ComponentDocPage({
  eyebrow, title, description, name, apiRows, children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  name: string;
  apiRows: readonly ComponentApiRow[];
  children: ReactNode;
}) {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  return <>
    <PageHeader eyebrow={eyebrow} title={title} description={description} />
    <DocsTabs activeKey={tab} onChange={setTab} />
    {tab === "examples" ? <div className="demo-stack">{children}</div> : <ApiTable name={name} rows={apiRows} />}
  </>;
}
