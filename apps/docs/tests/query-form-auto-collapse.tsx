import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, Input, QueryForm } from "@sia.soul/sia-react-ui";
import type { QueryFormProps, TableSettingsAdapter } from "@sia.soul/sia-react-ui";
import "@sia.soul/sia-react-ui/styles.css";

/** 无记录不能被错误解释为用户选择展开；已保存的 false 则应优先于三行规则。 */
const emptyAdapter: TableSettingsAdapter = { load: async () => ({}), save: async () => {} };
const expandedAdapter: TableSettingsAdapter = { load: async () => ({ queryForm: { fields: [], defaultCollapsed: false } }), save: async () => {} };
const collapsedAdapter: TableSettingsAdapter = { load: async () => ({ queryForm: { fields: [], defaultCollapsed: true } }), save: async () => {} };

/** 使用真实浏览器布局测试，不使用字段个数代替测量结果。 */
function Fixture() {
  const [width, setWidth] = useState(380);
  const [count, setCount] = useState(6);
  const [events, setEvents] = useState(0);
  const rows = (id: string, count: number, props: Partial<QueryFormProps> = {}) => <div id={id} style={{ width }}><QueryForm fieldWidth={160} fields={Array.from({ length: count }, (_, index) => ({ key: String(index), name: String(index), children: <Input placeholder={`条件${index}`} /> }))} onSearch={() => {}} onCollapsedChange={() => setEvents(value => value + 1)} {...props} /></div>;
  return <>
    <Button onClick={() => setWidth(560)}>加宽</Button><Button onClick={() => setWidth(380)}>缩窄</Button><Button onClick={() => setCount(4)}>减少字段</Button><Button onClick={() => setCount(6)}>增加字段</Button>
    <output id="events">{events}</output>
    {rows("auto", count)}{rows("two", 4)}{rows("more", 8)}
    {rows("default-open", 6, { defaultCollapsed: false })}{rows("default-closed", 4, { defaultCollapsed: true })}
    {rows("controlled-open", 6, { collapsed: false })}{rows("controlled-closed", 4, { collapsed: true })}
    {rows("disabled-collapse", 6, { collapsible: false })}
    {rows("cloud-empty", 6, { settings: { adapter: emptyAdapter, scope: { moduleName: "test", businessKey: "empty" } } })}
    {rows("cloud-open", 6, { settings: { adapter: expandedAdapter, scope: { moduleName: "test", businessKey: "open" } } })}
    {rows("cloud-closed", 4, { settings: { adapter: collapsedAdapter, scope: { moduleName: "test", businessKey: "closed" } } })}
  </>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><Fixture /></React.StrictMode>);
