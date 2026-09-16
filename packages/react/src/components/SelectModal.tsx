import { useState } from "react";
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
  /** 展示或交互模式；可选值见类型定义。 */
  mode?: SelectProps["mode"];
  /** 在选项名称下方显示 value，下拉与弹框模式均支持；不影响按 value 搜索 */
  showValue?: boolean;
  /** 弹框选项每行列数；长文本单行省略。 */
  columns?: number;
  /** 允许的最大高度。 */
  maxHeight?: number;
  /** 搜索框的占位提示文字。 */
  searchPlaceholder?: string;
  /** 自定义搜索匹配函数，返回 true 时保留该选项。 */
  filterOption?: SelectProps["filterOption"];
  /** 搜索条件变化或提交搜索时调用，具体参数见签名。 */
  onSearch?: SelectProps["onSearch"];
  /** 确认后接收选中的值和对应选项；单选为单值，多选为数组。支持异步处理；返回 false 或抛出异常时保留弹框，允许重试。 */
  onConfirm?: (value: SelectChangeValue, option: SelectOption | SelectOption[] | null) => ModalActionResult;
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
    <SelectionPanel options={filtered} value={values} onChange={onChange} multiple={multiple} disabled={disabled}
      selectedOnly={selectedOnly} showValue={config.showValue} showSearch={false} showActions={false}
      includeUnknownValues={false} columns={config.columns ?? 3} maxHeight={config.maxHeight ?? 360} />
  </>;
}

/** 无需渲染 Select，直接打开选择弹框。取消不提交，确认支持异步处理及返回 false 阻止关闭。 */
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
    const { options, value, mode, showValue, columns, maxHeight, searchPlaceholder, filterOption, onSearch, onConfirm, ...modal } = current;
    return { ...modal, title: current.title ?? "请选择", width: current.width ?? 900,
      className: `sia-select-modal ${current.className ?? ""}`, children: body(),
      onOk: async () => {
        const selected = values.map(value => current.options.find(option => option.value === value) ?? { value, label: String(value) });
        submitting = true;
        handle.update({ children: body() });
        try {
          return await current.onConfirm?.(current.mode === "multiple" ? [...values] : values[0] ?? null,
            current.mode === "multiple" ? selected : selected[0] ?? null);
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
