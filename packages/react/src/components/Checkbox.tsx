import { withTitleTooltip } from "./titleTooltip";
import { ControlSizeContext, useControlSize } from "./shared";
import type { ControlSize } from "./shared";
import { createContext, forwardRef, useContext, useEffect, useId, useMemo, useRef } from "react";
import type { ChangeEvent, CSSProperties, InputHTMLAttributes, ReactNode } from "react";
import { useControllableState } from "./shared";

/** 复选框的值类型。 */
export type CheckboxValue = string | number;

/** 复选框的属性配置。 */
export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "value" | "onChange"> {
  /** small / medium / large 文字字号为 12 / 13 / 16 像素，同时调整图形和间距；默认继承所在组或 Form，无上下文时为 medium（13px），组件显式 size 优先。 */
  size?: ControlSize;
  /** 外框形状：square 为圆角方框，circle 为圆形；仅改变外观，仍支持多选和半选。未指定时继承 Checkbox.Group.shape，无分组时默认 square；单项显式设置优先。 */
  shape?: "square" | "circle";
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
  /** 组内复选框的默认形状：square 为圆角方框，circle 为圆形；适用于 options 和 Checkbox 子项，子项显式 shape 优先，不改变多选行为。
   * @defaultValue "square"
   */
  shape?: CheckboxProps["shape"];
  /** 等宽网格的列数，按选项顺序从左到右逐行排列并占满容器宽度；仅正整数生效，未设置或无效时使用 direction 排列。设置有效列数后优先于 direction；同样适用于直接传入的 Checkbox 子项。 */
  columns?: number;
  /** 非网格模式的排列方向：horizontal 横向排列并自动换行，vertical 纵向单列排列；有效 columns 优先。默认 horizontal。 */
  direction?: "horizontal" | "vertical";
  /** 选项间距，单位 px；数字表示统一间距，二元组为 [行间距, 列间距]，支持 0，负数按 0 处理。默认 [12, 18]，适用于横向、纵向和网格布局。 */
  gap?: number | readonly [number, number];
  /** small / medium / large 文字字号为 12 / 13 / 16 像素，同时调整图形和间距；默认继承所在组或 Form，无上下文时为 medium（13px），组件显式 size 优先。 */
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
  /** 当前分组提供的默认形状，由单项显式设置覆盖。 */
  shape: NonNullable<CheckboxProps["shape"]>;
  values: readonly CheckboxValue[];
  disabled?: boolean;
  name?: string;
  toggle: (value: CheckboxValue, checked: boolean) => void;
};

const CheckboxGroupContext = createContext<CheckboxGroupContextValue | null>(null);

const CheckboxRoot = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { value, size: sizeProp, shape: shapeProp, indeterminate = false, children, disabled, checked, defaultChecked, className = "", onChange, ...props },
  forwardedRef,
) {
  const size = useControlSize(sizeProp);
  const group = useContext(CheckboxGroupContext);
  // 形状继承仅作用于当前分组，单项覆盖不改变选择值或原生输入语义。
  const shape = shapeProp ?? group?.shape ?? "square";
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

  return <label className={`sia-checkbox sia-checkbox--${size} sia-checkbox--${shape}${disabled || group?.disabled ? " is-disabled" : ""} ${className}`.trim()}>
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
  shape = "square",
  columns,
  direction = "horizontal",
  gap,
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
  // 仅接受合法列数，避免生成无效网格；不传布局属性时保留已有 CSS 的默认布局和间距。
  const gridColumns = columns !== undefined && Number.isInteger(columns) && columns > 0 ? columns : undefined;
  const layoutStyle: CSSProperties = {
    gridTemplateColumns: gridColumns ? `repeat(${gridColumns}, minmax(0, 1fr))` : undefined,
    gap: gap === undefined ? undefined : typeof gap === "number"
      ? Math.max(0, gap) : `${Math.max(0, gap[0])}px ${Math.max(0, gap[1])}px`,
  };
  const [values, setValues] = useControllableState<readonly CheckboxValue[]>({ value, defaultValue, onChange });
  const context = useMemo<CheckboxGroupContextValue>(() => ({
    shape,
    values,
    disabled,
    name,
    toggle(optionValue, checked) {
      const next = checked
        ? values.includes(optionValue) ? values : [...values, optionValue]
        : values.filter((item) => item !== optionValue);
      setValues(next);
    },
  }), [disabled, name, setValues, values, shape]);

  return <ControlSizeContext.Provider value={size}><CheckboxGroupContext.Provider value={context}>
    <div className={`sia-checkbox-group${gridColumns ? " sia-checkbox-group--grid" : direction === "vertical" ? " sia-checkbox-group--vertical" : ""} ${className}`.trim()} style={layoutStyle} role="group">
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
