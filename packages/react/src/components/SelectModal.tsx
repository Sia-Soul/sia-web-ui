import { useState } from "react";
import type { ReactNode } from "react";
import { Modal } from "./Modal";
import type { ModalActionResult, ModalOpenConfig, OverlayApiHandle } from "./Modal";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { Input } from "./Input";
import { Icon } from "./Icon";
import { SelectionPanel } from "./SelectionPanel";
import type { SelectChangeValue, SelectOption, SelectProps, SelectValue } from "./Select";

/** 独立选择弹框的配置。 */
export interface SelectModalConfig extends Omit<ModalOpenConfig, "children" | "footer" | "onOk" | "type"> {
  /** 可供用户选择的候选项列表。 */
  options: readonly SelectOption[];
  /** 弹框打开时的初始选中值；通过返回句柄 update({ value }) 可替换当前草稿。 */
  value?: SelectChangeValue;
  /** 单选或多选模式；single 确认时返回单值，multiple 返回数组。
   * @defaultValue "single" */
  mode?: SelectProps["mode"];
  /** 多选时显示分组复选框，仅切换当前搜索及已选视图中该组的可用项。
   * @defaultValue false */
  groupCheckable?: boolean;
  /** 在选项名称下方另起一行显示 value；关闭此项仍可按 value 搜索。
   * @defaultValue false */
  showValue?: boolean;
  /** 弹框选项每行列数；长文本单行省略。
   * @defaultValue 3 */
  columns?: number;
  /** 选项列表的最大可视高度，单位为像素；超出时在列表内滚动，不包含标题、搜索区和底部按钮。
   * @defaultValue 360 */
  maxHeight?: number;
  /** 标题下方的独立首行扩展内容，位于选项范围和搜索框上方。 */
  headerExtra?: ReactNode;
  /** 顶部自定义控件的业务数据；框架不会自动绑定 headerExtra 内的控件，需由业务方在变更时调用句柄 update({ extraValues })。确认时将当前对象的浅拷贝作为第三个参数传出，未配置时为 {}；update 会替换整个 extraValues 对象。 */
  extraValues?: Record<string, unknown>;
  /** 搜索框的占位提示文字。
   * @defaultValue "搜索选项" */
  searchPlaceholder?: string;
  /** 自定义本地搜索：接收去除首尾空白的搜索词和选项，返回 true 时保留。默认同时匹配 label 和 value（忽略大小写）；空搜索词显示全部选项。 */
  filterOption?: SelectProps["filterOption"];
  /** 搜索输入变化时调用，参数为未裁剪的输入文本，清空时为空字符串。默认仍执行本地过滤；远程搜索结果需通过句柄 update({ options }) 回填。 */
  onSearch?: SelectProps["onSearch"];
  /** 点击确定时接收 value、option 和 extraValues：单选未选择时前两项为 null，多选为空时为 []；第三项为扩展数据的浅拷贝。返回 Promise 时等待完成并禁用选择操作；返回 false 或抛出异常时保留弹框供重试，否则关闭。取消不调用此回调。 */
  onConfirm?: (value: SelectChangeValue, option: SelectOption | SelectOption[] | null, extraValues: Record<string, unknown>) => ModalActionResult;
}

function SelectModalBody({ config, values, disabled, onChange }: {
  config: SelectModalConfig; values: SelectValue[]; disabled: boolean; onChange: (values: SelectValue[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const multiple = config.mode === "multiple";
  const search = query.trim();
  const filtered = config.options.filter(option => !search || (config.filterOption
    ? config.filterOption(search, option)
    : [option.label, option.value].some(text => String(text ?? "").toLowerCase().includes(search.toLowerCase()))));
  const enabled = filtered.filter(option => !option.disabled && (!selectedOnly || values.includes(option.value)));
  const all = enabled.length > 0 && enabled.every(option => values.includes(option.value));
  const batch = (action: "all" | "remove" | "invert") => {
    const next = new Set(values);
    enabled.forEach(option => {
      if (action === "remove" || action === "invert" && next.has(option.value)) next.delete(option.value);
      else next.add(option.value);
    });
    onChange([...next]);
  };
  return <>
    {config.headerExtra != null && config.headerExtra !== false ? <div className="sia-select-modal__header-extra">{config.headerExtra}</div> : null}
    <div className="sia-select-modal__heading">
      <div role="tablist" aria-label="选项范围">
        <Button role="tab" aria-selected={!selectedOnly} variant="link" onClick={() => setSelectedOnly(false)}>全部</Button>
        <Button role="tab" aria-selected={selectedOnly} variant="link" onClick={() => setSelectedOnly(true)}>已选项({values.length})</Button>
      </div>
      <Input aria-label={config.searchPlaceholder ?? "搜索选项"} placeholder={config.searchPlaceholder ?? "搜索选项"}
        prefix={<Icon name="search" size={14} />} value={query} allowClear disabled={disabled}
        onChange={event => { setQuery(event.target.value); config.onSearch?.(event.target.value); }} />
    </div>
    {multiple ? <div className="sia-select-modal__actions">
      <Checkbox checked={all} indeterminate={!all && enabled.some(option => values.includes(option.value))}
        disabled={disabled || !enabled.length} onChange={checked => batch(checked ? "all" : "remove")}>全选</Checkbox>
      <Button variant="link" size="small" disabled={disabled || !enabled.length} onClick={() => batch("invert")}>反选</Button>
      <Button variant="link" size="small" danger disabled={disabled || !values.length} onClick={() => onChange([])}>清空</Button>
    </div> : null}
    <SelectionPanel options={filtered} value={values} onChange={onChange} multiple={multiple} groupCheckable={config.groupCheckable} disabled={disabled}
      selectedOnly={selectedOnly} showValue={config.showValue} showSearch={false} showActions={false}
      includeUnknownValues={false} columns={config.columns ?? 3} maxHeight={config.maxHeight ?? 360} />
  </>;
}

/**
 * 无需渲染 Select，直接打开选择弹框；默认标题为“请选择”、宽度为 900px。
 * 选择操作只更新弹框草稿，点击确定才调用 onConfirm，取消不提交。
 * @param config 候选项、初始选择、弹框布局与确认回调。
 * @returns 弹框句柄。update 合并配置并保留当前草稿，显式传 value 可替换草稿；destroy 销毁弹框。
 */
export function openSelectModal(config: SelectModalConfig): OverlayApiHandle<SelectModalConfig> {
  let current = config;
  const normalize = (value: SelectChangeValue | undefined) => value == null ? [] : Array.isArray(value) ? [...value] : [value];
  let values = normalize(config.value);
  if (config.mode !== "multiple") values = values.slice(0, 1);
  let submitting = false;
  function body() {
    return <SelectModalBody config={current} values={values} disabled={submitting || Boolean(current.confirmLoading)} onChange={next => {
      values = next;
      handle.update({ children: body() });
    }} />;
  }
  function modalConfig(): ModalOpenConfig {
    const { options, value, mode, groupCheckable, showValue, columns, maxHeight, headerExtra, extraValues, searchPlaceholder, filterOption, onSearch, onConfirm, ...modal } = current;
    return { ...modal, title: current.title ?? "请选择", width: current.width ?? 900,
      className: `sia-select-modal ${current.className ?? ""}`, children: body(),
      onOk: async () => {
        const selected = values.map(value => current.options.find(option => option.value === value) ?? { value, label: String(value) });
        submitting = true;
        handle.update({ children: body() });
        try {
          return await current.onConfirm?.(current.mode === "multiple" ? [...values] : values[0] ?? null,
            current.mode === "multiple" ? selected : selected[0] ?? null, { ...current.extraValues });
        } finally {
          submitting = false;
          handle.update({ children: body() });
        }
      },
    };
  }
  const handle = Modal.open(modalConfig());
  return {
    destroy: handle.destroy,
    update(next) {
      current = { ...current, ...next };
      if (Object.prototype.hasOwnProperty.call(next, "value")) values = normalize(next.value);
      if (current.mode !== "multiple") values = values.slice(0, 1);
      handle.update(modalConfig());
    },
  };
}
