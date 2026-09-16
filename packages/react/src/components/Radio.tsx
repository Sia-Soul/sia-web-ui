import { ControlSizeContext, useControlSize } from "./shared";
import type { ControlSize } from "./shared";
import { createContext, forwardRef, useContext, useId, useMemo } from "react";
import type { ChangeEvent, InputHTMLAttributes, ReactNode } from "react";
import { useControllableState } from "./shared";

/** 单选框的值类型。 */
export type RadioValue = string | number;

/** 单选框的属性配置。 */
export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "value" | "onChange"> {
  /** 组件尺寸；用于调整控件高度、字号和间距。 */
  size?: ControlSize;
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value: RadioValue;
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: ReactNode;
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (checked: boolean, event: ChangeEvent<HTMLInputElement>) => void;
}

/** 单选框的候选项定义。 */
export interface RadioOption {
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label: ReactNode;
  /** 该项目对应的数据值，用于标识、选择或计算。 */
  value: RadioValue;
  /** 是否禁用交互。 */
  disabled?: boolean;
}

/** RadioGroup的属性配置。 */
export interface RadioGroupProps {
  /** 组件尺寸；用于调整控件高度、字号和间距。 */
  size?: ControlSize;
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value?: RadioValue;
  /** 非受控模式的初始值，仅在初始化时使用。 */
  defaultValue?: RadioValue;
  /** 可供用户选择的候选项列表。 */
  options?: readonly (RadioOption | RadioValue)[];
  /**
   * 普通或按钮形态
   * @defaultValue "default"
   */
  optionType?: "default" | "button";
  /**
   * 按钮选中样式
   * @defaultValue "outline"
   */
  buttonStyle?: "outline" | "solid";
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
  onChange?: (value: RadioValue) => void;
}

type RadioContextValue = {
  value: RadioValue | undefined;
  name: string;
  disabled?: boolean;
  buttonStyle: "outline" | "solid";
  setValue: (value: RadioValue) => void;
};

const RadioContext = createContext<RadioContextValue | null>(null);

type RadioRootProps = RadioProps & { button?: boolean };

const RadioRoot = forwardRef<HTMLInputElement, RadioRootProps>(function Radio(
  { value, size: sizeProp, children, disabled, checked, defaultChecked, button = false, className = "", onChange, ...props },
  ref,
) {
  const size = useControlSize(sizeProp);
  const group = useContext(RadioContext);
  const fallbackId = useId();
  const grouped = group !== null;
  const currentChecked = grouped ? group.value === value : checked;
  return <label className={`sia-radio sia-radio--${size}${button ? " sia-radio--button" : ""}${button && group?.buttonStyle === "solid" ? " sia-radio--solid" : ""}${disabled || group?.disabled ? " is-disabled" : ""} ${className}`.trim()}>
    <input
      {...props}
      ref={ref}
      id={props.id ?? fallbackId}
      className="sia-radio__input"
      type="radio"
      value={value}
      name={group?.name ?? props.name}
      disabled={disabled || group?.disabled}
      checked={currentChecked}
      defaultChecked={grouped ? undefined : defaultChecked}
      onChange={(event) => {
        if (event.currentTarget.checked) group?.setValue(value);
        onChange?.(event.currentTarget.checked, event);
      }}
    />
    {button ? null : <span className="sia-radio__control" aria-hidden="true"><span /></span>}
    {children !== undefined ? <span className="sia-radio__label">{children}</span> : null}
  </label>;
});

function RadioButton(props: RadioProps) {
  return <RadioRoot {...props} button />;
}

function RadioGroup({
  size: sizeProp,
  value,
  defaultValue,
  options,
  optionType = "default",
  buttonStyle = "outline",
  disabled,
  name,
  className = "",
  children,
  onChange,
}: RadioGroupProps) {
  const size = useControlSize(sizeProp);
  const fallbackName = useId();
  const [currentValue, setValue] = useControllableState<RadioValue | undefined>({
    value,
    defaultValue,
    onChange: (next) => {
      if (next !== undefined) onChange?.(next);
    },
  });
  const context = useMemo<RadioContextValue>(() => ({
    value: currentValue,
    name: name ?? fallbackName,
    disabled,
    buttonStyle,
    setValue,
  }), [buttonStyle, currentValue, disabled, fallbackName, name, setValue]);
  const Component = optionType === "button" ? RadioButton : RadioRoot;
  return <ControlSizeContext.Provider value={size}><RadioContext.Provider value={context}>
    <div className={`sia-radio-group${optionType === "button" ? " sia-radio-group--button" : ""} ${className}`.trim()} role="radiogroup">
      {options?.map((option) => {
        const normalized = typeof option === "object" ? option : { label: String(option), value: option };
        return <Component value={normalized.value} disabled={normalized.disabled} key={normalized.value}>{normalized.label}</Component>;
      })}
      {children}
    </div>
  </RadioContext.Provider></ControlSizeContext.Provider>;
}

/** 单选框组件。 */
export const Radio = Object.assign(RadioRoot, {
  /** 组合主操作按钮与下拉菜单的按钮组件。 */
  Button: RadioButton,
  /** 组合多个子项并统一管理布局或选择状态。 */
  Group: RadioGroup });
