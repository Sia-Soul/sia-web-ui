import { withTitleTooltip } from "./titleTooltip";
import { ControlSizeContext, useControlSize } from "./shared";
import type { ControlSize } from "./shared";
import { createContext, forwardRef, useContext, useEffect, useId, useMemo, useRef } from "react";
import type { ChangeEvent, InputHTMLAttributes, ReactNode } from "react";
import { useControllableState } from "./shared";

/** 复选框的值类型。 */
export type CheckboxValue = string | number;

/** 复选框的属性配置。 */
export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "value" | "onChange"> {
  /** 组件尺寸；用于调整控件高度、字号和间距。 */
  size?: ControlSize;
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value?: CheckboxValue;
  /**
   * 半选状态
   * @defaultValue false
   */
  indeterminate?: boolean;
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: ReactNode;
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (checked: boolean, event: ChangeEvent<HTMLInputElement>) => void;
}

/** 复选框的候选项定义。 */
export interface CheckboxOption {
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label: ReactNode;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: CheckboxValue;
  /** 是否禁用交互。 */
  disabled?: boolean;
}

/** CheckboxGroup的属性配置。 */
export interface CheckboxGroupProps {
  /** 组件尺寸；用于调整控件高度、字号和间距。 */
  size?: ControlSize;
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value?: readonly CheckboxValue[];
  /**
   * 非受控模式的初始值，仅在初始化时使用。
   * @defaultValue []
   */
  defaultValue?: readonly CheckboxValue[];
  /** 可供用户选择的候选项列表。 */
  options?: readonly (CheckboxOption | CheckboxValue)[];
  /** 是否禁用交互。 */
  disabled?: boolean;
  /** 名称或字段标识。 */
  name?: string;
  /**
   * 附加到组件根节点的 CSS 类名。
   * @defaultValue ""
   */
  className?: string;
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: ReactNode;
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (values: readonly CheckboxValue[]) => void;
}

type CheckboxGroupContextValue = {
  values: readonly CheckboxValue[];
  disabled?: boolean;
  name?: string;
  toggle: (value: CheckboxValue, checked: boolean) => void;
};

const CheckboxGroupContext = createContext<CheckboxGroupContextValue | null>(null);

const CheckboxRoot = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { value, size: sizeProp, indeterminate = false, children, disabled, checked, defaultChecked, className = "", onChange, ...props },
  forwardedRef,
) {
  const size = useControlSize(sizeProp);
  const group = useContext(CheckboxGroupContext);
  const localRef = useRef<HTMLInputElement | null>(null);
  const fallbackId = useId();
  const grouped = group !== null && value !== undefined;
  const currentChecked = grouped ? group.values.includes(value) : checked;

  useEffect(() => {
    if (localRef.current) localRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  function setRef(node: HTMLInputElement | null) {
    localRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }

  return <label className={`sia-checkbox sia-checkbox--${size}${disabled || group?.disabled ? " is-disabled" : ""} ${className}`.trim()}>
    <input
      {...withTitleTooltip(props)}
      ref={setRef}
      id={props.id ?? fallbackId}
      className="sia-checkbox__input"
      type="checkbox"
      name={group?.name ?? props.name}
      disabled={disabled || group?.disabled}
      checked={currentChecked}
      defaultChecked={grouped ? undefined : defaultChecked}
      aria-checked={indeterminate ? "mixed" : currentChecked}
      onChange={(event) => {
        if (grouped) group.toggle(value, event.currentTarget.checked);
        onChange?.(event.currentTarget.checked, event);
      }}
    />
    <span className="sia-checkbox__control" aria-hidden="true"><span /></span>
    {children !== undefined ? <span className="sia-checkbox__label">{children}</span> : null}
  </label>;
});

function CheckboxGroup({
  size: sizeProp,
  value,
  defaultValue = [],
  options,
  disabled,
  name,
  className = "",
  children,
  onChange,
}: CheckboxGroupProps) {
  const size = useControlSize(sizeProp);
  const [values, setValues] = useControllableState<readonly CheckboxValue[]>({ value, defaultValue, onChange });
  const context = useMemo<CheckboxGroupContextValue>(() => ({
    values,
    disabled,
    name,
    toggle(optionValue, checked) {
      const next = checked
        ? values.includes(optionValue) ? values : [...values, optionValue]
        : values.filter((item) => item !== optionValue);
      setValues(next);
    },
  }), [disabled, name, setValues, values]);

  return <ControlSizeContext.Provider value={size}><CheckboxGroupContext.Provider value={context}>
    <div className={`sia-checkbox-group ${className}`.trim()} role="group">
      {options?.map((option) => {
        const normalized = typeof option === "object" ? option : { label: String(option), value: option };
        return <CheckboxRoot value={normalized.value} disabled={normalized.disabled} key={normalized.value}>{normalized.label}</CheckboxRoot>;
      })}
      {children}
    </div>
  </CheckboxGroupContext.Provider></ControlSizeContext.Provider>;
}

/** 复选框组件。 */
export const Checkbox = Object.assign(CheckboxRoot, {
  /** 组合多个子项并统一管理布局或选择状态。 */
  Group: CheckboxGroup });
