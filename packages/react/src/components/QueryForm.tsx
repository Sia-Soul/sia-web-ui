import { Children, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Form, useForm } from "./Form";
import type { FormItemProps, FormProps, FormValues } from "./Form";
import { Button } from "./Button";
import type { ButtonSize } from "./Button";
import { Badge } from "./DataDisplay";
import type { BadgeProps } from "./DataDisplay";
import { Icon } from "./Icon";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { Space } from "./Layout";
import { Tag } from "./Tag";
import type { TagStatus } from "./Tag";

export interface QueryFormField extends FormItemProps {
  key: string;
  /** 字段占用宽度，默认由 fieldWidth 控制；组合字段可指定更大的宽度。 */
  width?: number | string;
}
export interface QueryFormShortcut<T extends FormValues = FormValues> {
  key: string;
  label: ReactNode;
  values: Partial<T>;
  disabled?: boolean;
  status?: TagStatus;
  /** 顶部快捷查询按钮尺寸，优先于 quickQuerySize。 */
  size?: ButtonSize;
  /** 该快捷查询对应的数据总量，由业务接口提供。 */
  count?: number;
  badgeProps?: Omit<BadgeProps, "children" | "count">;
}
export interface QueryFormSearchInfo {
  source: "submit" | "reset" | "quick" | "saved";
  shortcutKey?: string;
}
export interface QueryFormProps<T extends FormValues = FormValues> extends Omit<FormProps, "onFinish" | "children" | "onError"> {
  fields?: readonly QueryFormField[];
  /** 也可直接放入 Form.Item 或 Space.Compact，每个直接子项视为一个查询字段。 */
  children?: ReactNode;
  onSearch: (values: T, info: QueryFormSearchInfo) => void | Promise<void>;
  loading?: boolean;
  fieldWidth?: number | string;
  collapsible?: boolean;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  collapsedCount?: number;
  onCollapsedChange?: (collapsed: boolean) => void;
  quickQueries?: readonly QueryFormShortcut<T>[];
  quickQuerySize?: ButtonSize;
  savedQueries?: readonly QueryFormShortcut<T>[];
  shortcutsLoading?: boolean;
  onSaveQuery?: (query: { name: string; values: T }) => void | Promise<void>;
  onRemoveQuery?: (query: QueryFormShortcut<T>) => void | Promise<void>;
  onError?: (error: unknown, operation: "search" | "save" | "remove") => void;
  searchText?: ReactNode;
  resetText?: ReactNode;
  saveText?: ReactNode;
  resetSearch?: boolean;
  actionsExtra?: ReactNode;
}

/** 可复用的业务查询表单；快捷查询的存储和结果数据由业务方管理。 */
export function QueryForm<T extends FormValues = FormValues>({
  fields, children, form: providedForm, onSearch, loading = false, fieldWidth = 220,
  collapsible = true, collapsed: controlledCollapsed, defaultCollapsed = false, collapsedCount = 3,
  onCollapsedChange, quickQueries = [], quickQuerySize = "small", savedQueries = [], shortcutsLoading = false,
  onSaveQuery, onRemoveQuery, onError, searchText = "查询", resetText = "重置", saveText = "另存为快捷查询",
  resetSearch = true, actionsExtra, disabled = false, className = "", placeholderMode = "floating",
  onValuesChange, onFinishFailed, ...formProps
}: QueryFormProps<T>) {
  const [form] = useForm(providedForm);
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const collapsed = collapsible && (controlledCollapsed ?? internalCollapsed);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [error, setError] = useState("");
  const [activeShortcut, setActiveShortcut] = useState("");
  const source = useRef<QueryFormSearchInfo>({ source: "submit" });
  const searchLock = useRef(false);
  const saveLock = useRef(false);
  const removeLock = useRef(false);
  const snapshot = useRef<T>();
  const busy = disabled || loading || searching;
  const shortcutBusy = busy || shortcutsLoading || saving || removing;
  const entries = fields ? fields.map(({ key, width, ...item }) => ({ key, width, content: <Form.Item noStyle {...item} /> }))
    : Children.toArray(children).map((content, index) => ({ key: String(index), width: undefined, content }));
  const limit = Math.max(1, Math.floor(collapsedCount));
  const rowRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [fittingCount, setFittingCount] = useState(limit);
  useLayoutEffect(() => {
    if (!collapsed) return;
    const row = rowRef.current;
    const actions = actionsRef.current;
    if (!row || !actions) return;
    function measure() {
      if (!row || !actions) return;
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      let remaining = row.clientWidth - actions.getBoundingClientRect().width;
      let count = 0;
      for (const field of Array.from(row.querySelectorAll<HTMLElement>(":scope > .sia-query-form__field")).slice(0, limit)) {
        const width = parseFloat(getComputedStyle(field).width) || 220;
        if (remaining + .5 < width + gap) break;
        remaining -= width + gap;
        count++;
      }
      setFittingCount(count);
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row); observer.observe(actions);
    row.querySelectorAll(":scope > .sia-query-form__field").forEach(field => observer.observe(field));
    return () => observer.disconnect();
  }, [collapsed, limit, fieldWidth, fields, children]);

  async function search(values: FormValues) {
    const info = source.current;
    source.current = { source: "submit" };
    if (searchLock.current || disabled || loading) return;
    searchLock.current = true; setSearching(true); setError("");
    try { await onSearch(values as T, info); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "查询失败，请重试"); onError?.(reason, "search"); }
    finally { searchLock.current = false; setSearching(false); }
  }
  function applyShortcut(query: QueryFormShortcut<T>, kind: "quick" | "saved") {
    if (shortcutBusy || query.disabled) return;
    form.resetFields();
    form.setFieldsValue(query.values);
    source.current = { source: kind, shortcutKey: query.key };
    setActiveShortcut(`${kind}:${query.key}`);
    form.submit();
  }
  function reset() {
    if (busy) return;
    form.resetFields(); setActiveShortcut(""); setError("");
    if (resetSearch) { source.current = { source: "reset" }; form.submit(); }
  }
  async function save() {
    if (!onSaveQuery || saveLock.current) return false;
    const name = saveName.trim();
    if (!name) { setSaveError("请输入快捷查询名称"); return false; }
    if (!snapshot.current) return false;
    saveLock.current = true; setSaving(true); setSaveError("");
    try { await onSaveQuery({ name, values: snapshot.current }); setSaveOpen(false); }
    catch (reason) { setSaveError(reason instanceof Error ? reason.message : "保存失败，请重试"); onError?.(reason, "save"); return false; }
    finally { saveLock.current = false; setSaving(false); }
  }
  async function remove(query: QueryFormShortcut<T>) {
    if (!onRemoveQuery || shortcutBusy || removeLock.current) return;
    removeLock.current = true; setRemoving(true); setError("");
    try { await onRemoveQuery(query); if (activeShortcut === `saved:${query.key}`) setActiveShortcut(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "删除失败，请重试"); onError?.(reason, "remove"); }
    finally { removeLock.current = false; setRemoving(false); }
  }
  return <div className={`sia-query-form ${className}`.trim()}>
    <Form {...formProps} form={form} placeholderMode={placeholderMode} disabled={disabled} onFinish={values => { void search(values); }}
      onFinishFailed={info => { source.current = { source: "submit" }; onFinishFailed?.(info); }}
      onValuesChange={(changed, values) => { setActiveShortcut(""); onValuesChange?.(changed, values); }}>
      {quickQueries.length ? <div className="sia-query-form__quick" aria-label="预设快捷查询">{quickQueries.map(query =>
        <Badge key={query.key} className="sia-query-form__quick-badge" showZero size="small" title={query.count === undefined ? undefined : `共 ${query.count} 条`} {...query.badgeProps} count={query.count}>
        <Button size={query.size ?? quickQuerySize} aria-pressed={activeShortcut === `quick:${query.key}`} variant={activeShortcut === `quick:${query.key}` ? "primary" : "default"}
          disabled={shortcutBusy || query.disabled} onClick={() => applyShortcut(query, "quick")}>{query.label}</Button></Badge>)} </div> : null}
      <div ref={rowRef} className={`sia-query-form__fields${collapsed ? " is-collapsed" : ""}`} style={{ "--sia-query-field-width": typeof fieldWidth === "number" ? `${fieldWidth}px` : fieldWidth } as CSSProperties}>
        {entries.map((entry, index) => <div key={entry.key} className="sia-query-form__field" hidden={collapsed && index >= Math.min(limit, fittingCount)}
          style={entry.width !== undefined ? { flexBasis: entry.width, width: entry.width } : undefined}>{entry.content}</div>)}
        <div ref={actionsRef} className="sia-query-form__actions">
          <Space.Compact>
            <Button type="submit" variant="primary" loading={loading || searching} disabled={disabled}>{searchText}</Button>
            <Button disabled={busy} onClick={reset}>{resetText}</Button>
            {onSaveQuery ? <Button disabled={shortcutBusy} onClick={() => { snapshot.current = form.getFieldsValue() as T; setSaveName(""); setSaveError(""); setSaveOpen(true); }}>{saveText}</Button> : null}
          </Space.Compact>
          {collapsible && entries.length > 0 ? <Button variant="link" aria-expanded={!collapsed} icon={<Icon name={collapsed ? "chevron-down" : "chevron-up"} />} iconPosition="end"
            onClick={() => { setInternalCollapsed(!collapsed); onCollapsedChange?.(!collapsed); }}>{collapsed ? "展开" : "收起"}</Button> : null}
          {actionsExtra}
        </div>
      </div>
      {savedQueries.length && !collapsed ? <div className="sia-query-form__saved" aria-label="已保存快捷查询">{savedQueries.map((query, index) =>
        <Tag key={query.key} status={query.status ?? (["processing", "success", "warning", "error"] as const)[index % 4]} variant="soft" disabled={shortcutBusy || query.disabled}
          tabIndex={shortcutBusy || query.disabled ? -1 : 0} className={activeShortcut === `saved:${query.key}` ? "is-active" : ""}
          closable={Boolean(onRemoveQuery)} closeOnHover onClose={() => { void remove(query); }} onClick={() => applyShortcut(query, "saved")}
          onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); applyShortcut(query, "saved"); } }}>{query.label}</Tag>)} </div> : null}
      {error ? <p className="sia-query-form__error" role="alert">{error}</p> : null}
    </Form>
    <Modal open={saveOpen} title="另存为快捷查询" width={420} confirmLoading={saving} onOk={save} onOpenChange={next => { if (!saveLock.current) setSaveOpen(next); }}>
      <Input autoFocus aria-label="快捷查询名称" placeholder="快捷查询名称" value={saveName} maxLength={80} disabled={saving} status={saveError ? "error" : "default"}
        onChange={event => setSaveName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void save(); } }} />
      {saveError ? <p className="sia-query-form__error" role="alert">{saveError}</p> : null}
    </Modal>
  </div>;
}
