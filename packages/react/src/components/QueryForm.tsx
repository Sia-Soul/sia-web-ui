import { Children, isValidElement, useLayoutEffect, useRef, useState } from "react";
import { useQueryFormSettings } from "./QueryFormSettings";
import { reconcileQueryFields } from "./queryFormSettingsUtils";
import type { QueryFormSettingsConfig } from "./queryFormSettingsTypes";
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

/** 查询区中的一个字段，复用 Form.Item 绑定能力并增加布局宽度配置。 */
export interface QueryFormField extends FormItemProps {
  /** 字段布局的稳定唯一标识；用于 React 渲染，不替代 Form.Item 的 name 字段路径。 */
  key: string;
  /** 查询设置面板中的名称；默认取 label、控件 placeholder，最后回退为 key，不影响表单标签。 */
  settingsLabel?: ReactNode;
  /** 字段占用宽度，优先于自动布局。未指定时普通控件占一列，日期／时间区间及横向组合控件占两列，SelectDateRange 占三列，均包含跨列间距。 */
  width?: number | string;
}
/** 预设或已保存的快捷查询，包含名称、条件、颜色和可选数量徽标。 */
export interface QueryFormShortcut<T extends FormValues = FormValues> {
  /** 快捷查询的稳定唯一标识，用于选中态和 onSearch 的 info.shortcutKey；建议使用后端主键，不使用可变排序索引。 */
  key: string;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label: ReactNode;
  /** 该快捷查询保存的条件。点击时先恢复表单初始值，再用这些字段覆盖；支持与 Form 字段一致的嵌套数据结构。 */
  values: Partial<T>;
  /** 是否禁用交互。 */
  disabled?: boolean;
  /** 底部已保存快捷标签的颜色状态；未指定时使用组件分配的配色。 */
  status?: TagStatus;
  /** 顶部快捷查询按钮尺寸，优先于 quickQuerySize。 */
  size?: ButtonSize;
  /** 该快捷查询对应的数据总量，由业务接口提供。 */
  count?: number;
  /** 顶部数量徽标的附加属性，例如 overflowCount、showZero 和颜色；徽标数量由同一快捷项的 count 提供。 */
  badgeProps?: Omit<BadgeProps, "children" | "count">;
}
/** 本次查询的触发来源及关联快捷查询标识。 */
export interface QueryFormSearchInfo {
  /** 查询来源：submit 为查询按钮或表单提交，reset 为重置后查询，quick 为顶部预设，saved 为底部已保存条件。 */
  source: "submit" | "reset" | "quick" | "saved";
  /** 触发查询的快捷项标识；普通查询或重置时可能未提供。 */
  shortcutKey?: string;
}
/** 查询表单的属性配置。 */
export interface QueryFormProps<T extends FormValues = FormValues> extends Omit<
  FormProps,
  "onFinish" | "children" | "onError"
> {
  /** 查询字段配置，每项包含稳定 key、可选宽度以及 Form.Item 属性；提供后优先于 children。 */
  fields?: readonly QueryFormField[];
  /** 云设置入口，在查询操作按钮组末尾显示竖向三点图标；复用表格 adapter 和 scope，读写共用快照的 queryForm 属性。未提供时不显示入口。隐藏字段保留挂载和值；children 模式需提供稳定 React key。 */
  settings?: QueryFormSettingsConfig;
  /** 也可直接放入 Form.Item 或 Space.Compact，每个直接子项视为一个查询字段。 */
  children?: ReactNode;
  /** 表单校验通过后执行查询。values 是完整条件；info.source 区分 submit（查询）、reset（重置）、quick（顶部预设）和 saved（已保存条件）。返回 Promise 时自动显示加载状态并阻止重复提交。 */
  onSearch: (values: T, info: QueryFormSearchInfo) => void | Promise<void>;
  /**
   * 是否处于加载状态。
   * @defaultValue false
   */
  loading?: boolean;
  /**
   * 单列查询字段的默认宽度，数值单位为像素，可传 CSS 尺寸字符串。区间及横向组合控件默认占两列，SelectDateRange 占三列，均包含跨列间距；行列间距可通过 --sia-query-field-gap 调整（默认 8px）。
   * @defaultValue 220
   */
  fieldWidth?: number | string;
  /**
   * 是否允许展开和收起；仅全部字段与操作区无法在一行内显示时提供入口，false 时始终展示全部字段。
   * @defaultValue true
   */
  collapsible?: boolean;
  /** 受控收起状态，需在 onCollapsedChange 中更新；全部字段能单行显示时不执行收起。收起时保留字段挂载和值，只隐藏放不下的字段，底部快捷标签始终保留。 */
  collapsed?: boolean;
  /**
   * 非受控模式的初始收起状态；默认展开全部查询条件。启用 settings 后，云端 defaultCollapsed 在加载完成时优先；受控 collapsed 始终优先。
   * @defaultValue false
   */
  defaultCollapsed?: boolean;
  /**
   * 收起时最多保留的字段数；默认按可用宽度自动填满一行，并预留操作区宽度。显式指定时作为数量上限，空间不足会进一步减少；全部字段能单行显示时不限制字段数。
   * @defaultValue Infinity
   */
  collapsedCount?: number;
  /** 收起状态变化回调 */
  onCollapsedChange?: (collapsed: boolean) => void;
  /**
   * 顶部预设快捷查询按钮。点击后先恢复 initialValues，再覆盖该项 values，校验并自动触发 onSearch。
   * @defaultValue []
   */
  quickQueries?: readonly QueryFormShortcut<T>[];
  /**
   * 顶部快捷查询按钮的默认尺寸，单项 size 优先。
   * @defaultValue "small"
   */
  quickQuerySize?: ButtonSize;
  /**
   * 底部已保存快捷查询标签。点击回填该项条件并查询；收起时仍可使用。业务方负责加载数据，并在保存或删除成功后更新此数组。
   * @defaultValue []
   */
  savedQueries?: readonly QueryFormShortcut<T>[];
  /**
   * 快捷查询正在加载或更新时设为 true，期间禁用快捷操作。
   * @defaultValue false
   */
  shortcutsLoading?: boolean;
  /** 点击“另存为快捷查询”并确认名称后调用。query.name 为去除首尾空格的名称，query.values 为打开保存弹框时的条件快照。业务方负责持久化并更新 savedQueries；返回 Promise 时显示等待状态，失败保留弹框供重试。 */
  onSaveQuery?: (query: {
    /** 用户输入的快捷查询名称，已经去除首尾空格。 */
    name: string;
    /** 打开保存弹框时的完整查询条件快照。 */
    values: T;
  }) => void | Promise<void>;
  /** 删除已保存快捷项时调用，query 为被删除的完整快捷项。业务方负责持久化并更新 savedQueries；失败保留该项，删除操作不会触发查询。 */
  onRemoveQuery?: (query: QueryFormShortcut<T>) => void | Promise<void>;
  /** 查询、保存或删除失败时调用。error 为原始异常，operation 为 search、save 或 remove；组件同时显示错误提示。 */
  onError?: (error: unknown, operation: "search" | "save" | "remove") => void;
  /**
   * 查询按钮文案。
   * @defaultValue "查询"
   */
  searchText?: ReactNode;
  /**
   * 重置按钮文案。
   * @defaultValue "重置"
   */
  resetText?: ReactNode;
  /**
   * 保存快捷查询按钮文案。
   * @defaultValue "另存为快捷查询"
   */
  saveText?: ReactNode;
  /**
   * 点击重置后是否自动提交查询；false 时只恢复 initialValues，不调用 onSearch。
   * @defaultValue true
   */
  resetSearch?: boolean;
  /** 查询按钮组旁的自定义操作内容。 */
  actionsExtra?: ReactNode;
}

/** 可复用的业务查询表单；快捷查询的存储和结果数据由业务方管理。 */
export function QueryForm<T extends FormValues = FormValues>({
  fields,
  settings,
  children,
  form: providedForm,
  onSearch,
  loading = false,
  fieldWidth = 220,
  collapsible = true,
  collapsed: controlledCollapsed,
  defaultCollapsed = false,
  collapsedCount = Infinity,
  onCollapsedChange,
  quickQueries = [],
  quickQuerySize = "small",
  savedQueries = [],
  shortcutsLoading = false,
  onSaveQuery,
  onRemoveQuery,
  onError,
  searchText = "查询",
  resetText = "重置",
  saveText = "另存为快捷查询",
  resetSearch = true,
  actionsExtra,
  disabled = false,
  className = "",
  placeholderMode = "floating",
  onValuesChange,
  onFinishFailed,
  ...formProps
}: QueryFormProps<T>) {
  const [form] = useForm(providedForm);
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const collapsed =
    collapsible && needsCollapse && (controlledCollapsed ?? internalCollapsed);
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
  // 设置标题独立于字段标签；已有表单和组合控件可通过显式 settingsLabel 提供可读名称。
  const fieldLabel = (content: ReactNode): ReactNode => {
    if (!isValidElement<{ label?: ReactNode; placeholder?: ReactNode; children?: ReactNode }>(content)) return undefined;
    return content.props.label ?? content.props.placeholder ?? fieldLabel(content.props.children);
  };
  const sourceEntries = fields
    ? fields.map(({ key, width, settingsLabel, ...item }) => ({
        key,
        width,
        label: settingsLabel ?? item.label ?? (typeof item.children === "function" ? undefined : fieldLabel(item.children)) ?? key,
        content: <Form.Item noStyle {...item} />,
      }))
    : Children.toArray(children).map((content, index) => ({
        key: isValidElement(content) && content.key != null ? String(content.key) : String(index),
        width: undefined,
        label: fieldLabel(content) ?? `条件 ${index + 1}`,
        content,
      }));
  const cloudSettings = useQueryFormSettings(settings, sourceEntries, defaultCollapsed, setInternalCollapsed, disabled);
  const configured = reconcileQueryFields(sourceEntries.map(entry => entry.key), cloudSettings.snapshot?.fields);
  const entriesByKey = new Map(sourceEntries.map(entry => [entry.key, entry]));
  let visibleIndex = 0;
  const entries = configured.map(item => ({ ...entriesByKey.get(item.key)!, visible: item.visible, visibleIndex: item.visible ? visibleIndex++ : -1 }));
  const layoutKey = JSON.stringify(configured);
  const limit = Math.max(1, Math.floor(collapsedCount));
  const rowRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLSpanElement>(null);
  const [fittingCount, setFittingCount] = useState(limit);
  useLayoutEffect(() => {
    const row = rowRef.current;
    const actions = actionsRef.current;
    if (!row || !actions) return;
    function measure() {
      if (!row || !actions) return;
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const allFields = Array.from(
        row.querySelectorAll<HTMLElement>(":scope > .sia-query-form__field:not([data-settings-hidden])"),
      );
      const hiddenFields = allFields.filter((field) => field.hidden);
      const wasCollapsed = row.classList.contains("is-collapsed");
      const toggle = toggleRef.current;
      const toggleHidden = toggle?.hidden;
      // 按“全部字段展开且没有切换按钮”的布局测量，避免按钮自身挤出第二行后永远无法隐藏。
      row.classList.remove("is-collapsed");
      hiddenFields.forEach((field) => {
        field.hidden = false;
      });
      if (toggle) toggle.hidden = true;
      const requiredWidth = allFields.reduce(
        (total, field) => total + field.getBoundingClientRect().width + gap,
        actions.getBoundingClientRect().width,
      );
      setNeedsCollapse(
        allFields.length > 0 && requiredWidth > row.clientWidth + 0.5,
      );
      if (toggle) toggle.hidden = Boolean(toggleHidden);
      row.classList.toggle("is-collapsed", wasCollapsed);
      // 隐藏前按收起布局测量实际宽度，避免 display:none 下的 calc/百分比宽度被误算成单列。
      const widths = collapsed
        ? allFields.slice(0, limit).map((field) => field.getBoundingClientRect().width)
        : [];
      let remaining = row.clientWidth - actions.getBoundingClientRect().width;
      hiddenFields.forEach((field) => {
        field.hidden = true;
      });
      if (!collapsed) return;
      let count = 0;
      for (const width of widths) {
        if (remaining + 0.5 < width + gap) break;
        remaining -= width + gap;
        count++;
      }
      setFittingCount(count);
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    observer.observe(actions);
    row
      .querySelectorAll(":scope > .sia-query-form__field")
      .forEach((field) => observer.observe(field));
    return () => observer.disconnect();
  }, [
    collapsed,
    layoutKey,
    needsCollapse,
    collapsible,
    limit,
    fieldWidth,
    fields,
    children,
    actionsExtra,
    onSaveQuery,
    searchText,
    resetText,
    saveText,
  ]);

  async function search(values: FormValues) {
    const info = source.current;
    source.current = { source: "submit" };
    if (searchLock.current || disabled || loading) return;
    searchLock.current = true;
    setSearching(true);
    setError("");
    try {
      await onSearch(values as T, info);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "查询失败，请重试");
      onError?.(reason, "search");
    } finally {
      searchLock.current = false;
      setSearching(false);
    }
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
    form.resetFields();
    setActiveShortcut("");
    setError("");
    if (resetSearch) {
      source.current = { source: "reset" };
      form.submit();
    }
  }
  async function save() {
    if (!onSaveQuery || saveLock.current) return false;
    const name = saveName.trim();
    if (!name) {
      setSaveError("请输入快捷查询名称");
      return false;
    }
    if (!snapshot.current) return false;
    saveLock.current = true;
    setSaving(true);
    setSaveError("");
    try {
      await onSaveQuery({ name, values: snapshot.current });
      setSaveOpen(false);
    } catch (reason) {
      setSaveError(
        reason instanceof Error ? reason.message : "保存失败，请重试",
      );
      onError?.(reason, "save");
      return false;
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  async function remove(query: QueryFormShortcut<T>) {
    if (!onRemoveQuery || shortcutBusy || removeLock.current) return;
    removeLock.current = true;
    setRemoving(true);
    setError("");
    try {
      await onRemoveQuery(query);
      if (activeShortcut === `saved:${query.key}`) setActiveShortcut("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除失败，请重试");
      onError?.(reason, "remove");
    } finally {
      removeLock.current = false;
      setRemoving(false);
    }
  }
  return (
    <div className={`sia-query-form ${className}`.trim()}>
      <Form
        {...formProps}
        form={form}
        placeholderMode={placeholderMode}
        disabled={disabled}
        onFinish={(values) => {
          void search(values);
        }}
        onFinishFailed={(info) => {
          source.current = { source: "submit" };
          onFinishFailed?.(info);
        }}
        onValuesChange={(changed, values) => {
          setActiveShortcut("");
          onValuesChange?.(changed, values);
        }}
      >
        {quickQueries.length ? (
          <div className="sia-query-form__quick" aria-label="预设快捷查询">
            {quickQueries.map((query) => (
              <Badge
                key={query.key}
                className="sia-query-form__quick-badge"
                showZero
                size="small"
                title={
                  query.count === undefined ? undefined : `共 ${query.count} 条`
                }
                {...query.badgeProps}
                count={query.count}
              >
                <Button
                  size={query.size ?? quickQuerySize}
                  aria-pressed={activeShortcut === `quick:${query.key}`}
                  variant={
                    activeShortcut === `quick:${query.key}`
                      ? "primary"
                      : "default"
                  }
                  disabled={shortcutBusy || query.disabled}
                  onClick={() => applyShortcut(query, "quick")}
                >
                  {query.label}
                </Button>
              </Badge>
            ))}{" "}
          </div>
        ) : null}
        <div
          ref={rowRef}
          className={`sia-query-form__fields${collapsed ? " is-collapsed" : ""}`}
          style={
            {
              "--sia-query-field-width":
                typeof fieldWidth === "number" ? `${fieldWidth}px` : fieldWidth,
            } as CSSProperties
          }
        >
          {entries.map((entry) => (
            <div
              key={entry.key}
              className="sia-query-form__field"
              data-settings-hidden={!entry.visible || undefined}
              hidden={!entry.visible || (collapsed && entry.visibleIndex >= Math.min(limit, fittingCount))}
              style={
                entry.width !== undefined
                  ? ({
                      "--sia-query-item-width":
                        typeof entry.width === "number"
                          ? `${entry.width}px`
                          : entry.width,
                    } as CSSProperties)
                  : undefined
              }
            >
              {entry.content}
            </div>
          ))}
          <div ref={actionsRef} className="sia-query-form__actions">
            <Space.Compact>
              <Button
                type="submit"
                variant="primary"
                loading={loading || searching}
                disabled={disabled}
              >
                {searchText}
              </Button>
              <Button disabled={busy} onClick={reset}>
                {resetText}
              </Button>
              {onSaveQuery ? (
                <Button
                  disabled={shortcutBusy}
                  onClick={() => {
                    snapshot.current = form.getFieldsValue() as T;
                    setSaveName("");
                    setSaveError("");
                    setSaveOpen(true);
                  }}
                >
                  {saveText}
                </Button>
              ) : null}
              {cloudSettings.control}
            </Space.Compact>
            {collapsible && entries.length > 0 ? (
              <span ref={toggleRef} hidden={!needsCollapse}>
                <Button
                  variant="link"
                  aria-expanded={!collapsed}
                  icon={
                    <Icon name={collapsed ? "chevron-down" : "chevron-up"} />
                  }
                  iconPosition="end"
                  onClick={() => {
                    setInternalCollapsed(!collapsed);
                    onCollapsedChange?.(!collapsed);
                  }}
                >
                  {collapsed ? "展开" : "收起"}
                </Button>
              </span>
            ) : null}
            {actionsExtra}
            {cloudSettings.panel}
          </div>
        </div>
        {/* 快捷查询是独立操作入口，不随查询字段收起而隐藏。 */}
        {savedQueries.length ? (
          <div className="sia-query-form__saved" aria-label="已保存快捷查询">
            {savedQueries.map((query, index) => (
              <Tag
                key={query.key}
                status={
                  query.status ??
                  (["processing", "success", "warning", "error"] as const)[
                    index % 4
                  ]
                }
                variant="soft"
                disabled={shortcutBusy || query.disabled}
                tabIndex={shortcutBusy || query.disabled ? -1 : 0}
                className={
                  activeShortcut === `saved:${query.key}` ? "is-active" : ""
                }
                closable={Boolean(onRemoveQuery)}
                closeOnHover
                onClose={() => {
                  void remove(query);
                }}
                onClick={() => applyShortcut(query, "saved")}
                onKeyDown={(event) => {
                  if (
                    event.target === event.currentTarget &&
                    (event.key === "Enter" || event.key === " ")
                  ) {
                    event.preventDefault();
                    applyShortcut(query, "saved");
                  }
                }}
              >
                {query.label}
              </Tag>
            ))}{" "}
          </div>
        ) : null}
        {error ? (
          <p className="sia-query-form__error" role="alert">
            {error}
          </p>
        ) : null}
      </Form>
      <Modal
        open={saveOpen}
        title="另存为快捷查询"
        width={420}
        confirmLoading={saving}
        onOk={save}
        onOpenChange={(next) => {
          if (!saveLock.current) setSaveOpen(next);
        }}
      >
        <Input
          autoFocus
          aria-label="快捷查询名称"
          placeholder="快捷查询名称"
          value={saveName}
          maxLength={80}
          disabled={saving}
          status={saveError ? "error" : "default"}
          onChange={(event) => setSaveName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void save();
            }
          }}
        />
        {saveError ? (
          <p className="sia-query-form__error" role="alert">
            {saveError}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
