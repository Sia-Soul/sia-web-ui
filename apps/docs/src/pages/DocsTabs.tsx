import { Tabs } from "@sia.soul/sia-react-ui";
import type { TabItem } from "@sia.soul/sia-react-ui";

export type DocsTabKey = "examples" | "api";

const exampleItems: readonly TabItem[] = [{ key: "examples", label: "示例" }];
const exampleApiItems: readonly TabItem[] = [...exampleItems, { key: "api", label: "API" }];

interface DocsTabsProps {
  activeKey?: DocsTabKey;
  onChange?: (key: DocsTabKey) => void;
  showApi?: boolean;
}

export function DocsTabs({ activeKey = "examples", onChange, showApi = true }: DocsTabsProps) {
  return (
    <Tabs
      className="docs-tabs"
      items={showApi ? exampleApiItems : exampleItems}
      activeKey={activeKey}
      onChange={(key) => onChange?.(key as DocsTabKey)}
    />
  );
}
