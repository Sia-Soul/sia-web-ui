import { useMemo, useState } from "react";
import { Button, Icon, Space, Table, Toolbar, createColumnSettingPlugin, createLocalStorageTableSettingsAdapter, createToolbarPlugin } from "@sia.soul/sia-react-ui";

/** 对比直接按钮、Space 和 Toolbar 组合，右侧图标按钮均与设置入口保持等距。 */
export function TableToolbarSpacingDemo() {
  const [action, setAction] = useState("尚未操作");
  const adapter = useMemo(() => createLocalStorageTableSettingsAdapter("sia-docs-toolbar-spacing"), []);
  const buttons = [
    <Button key="history" variant="text" title="历史" aria-label="历史" icon={<Icon name="clock" size={16} />} onClick={() => setAction("已查看历史")} />,
    <Button key="refresh" variant="text" title="刷新" aria-label="刷新" icon={<Icon name="refresh" size={16} />} onClick={() => setAction("已刷新")} />,
  ];
  return <Space direction="vertical" style={{ width: "100%" }}>
    {(["direct", "space", "toolbar"] as const).map(mode => <Table key={mode} className={`toolbar-spacing-${mode}`}
      columns={[{ key: "name", name: "商品简称", dataIndex: "name" }]}
      dataSource={[{ id: 1, name: "示例商品" }]} rowKey="id"
      plugins={[
        createToolbarPlugin({ start: mode, end: mode === "space" ? <Space>{buttons}</Space> : mode === "toolbar" ? <Toolbar items={[
          { key: "history", label: null, icon: <Icon name="clock" size={16} label="历史" /> },
          { key: "refresh", label: null, icon: <Icon name="refresh" size={16} label="刷新" /> },
        ]} onAction={setAction} /> : buttons }),
        createColumnSettingPlugin({ adapter, scope: { moduleName: "docs", businessKey: `toolbar-spacing-${mode}` } }),
      ]} />)}
    <span aria-live="polite">{action}</span>
  </Space>;
}
