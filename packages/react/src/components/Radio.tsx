import { withTitleTooltip } from "./titleTooltip";
import { usePressFeedback } from "./usePressFeedback";
import { RadioSelectionMotion } from "./RadioSelectionMotion";
import { ControlSizeContext, useControlSize } from "./shared";
import type { ControlSize } from "./shared";
import { createContext, forwardRef, useContext, useId, useMemo, useRef } from "react";
import type { ChangeEvent, InputHTMLAttributes, ReactNode } from "react";
import { useControllableState } from "./shared";

/** 单选框的值类型。 */
export type RadioValue = string | number;

/** 单选框的属性配置。 */
export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "value" | "onChange"> {
  /** small / medium / large 文字字号为 12 / 13 / 16 像素，同时调整图形和间距；默认继承所在组或 Form，无上下文时为 medium（13px），组件显式 size 优先。 */
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
  /** small / medium / large 文字字号为 12 / 13 / 16 像素，同时调整图形和间距；默认继承所在组或 Form，无上下文时为 medium（13px），组件显式 size 优先。 */
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
   * 按钮选中样式：outline 使用描边及320ms 点击回弹；solid 使用主题色实心背景，选项切换时以 280ms 液体轮廓经沙漏细颈流入目标项并铺满，文字不缩放。双向等时长，连续切换接续当前轮廓；选择值和回调立即更新，首次显示、尺寸变化、禁用项及减少动态效果直接对齐。
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
  const labelRef = useRef<HTMLLabelElement>(null);
  const controlRef = useRef<HTMLSpanElement>(null);
  const press = usePressFeedback();
  return <label ref={labelRef} className={`sia-radio sia-radio--${size}${button ? " sia-radio--button" : ""}${button && group?.buttonStyle === "solid" ? " sia-radio--solid" : ""}${disabled || group?.disabled ? " is-disabled" : ""} ${className}`.trim()}>
    <input
      {...withTitleTooltip(props)}
      ref={ref}
      id={props.id ?? fallbackId}
      className="sia-radio__input"
      type="radio"
      value={value}
      name={group?.name ?? props.name}
      disabled={disabled || group?.disabled}
      checked={currentChecked}
      defaultChecked={grouped ? undefined : defaultChecked}
      onClick={event => {
        props.onClick?.(event);
        // 实心分组由共享背景承担反馈，避免整项缩放与移动背景错位。
        if (!event.defaultPrevented && !event.currentTarget.disabled && !(button && group?.buttonStyle === "solid")) press(button ? labelRef.current : controlRef.current, !button);
      }}
      onChange={(event) => {
        if (event.currentTarget.checked) group?.setValue(value);
        onChange?.(event.currentTarget.checked, event);
      }}
    />
    {button ? null : <span ref={controlRef} className="sia-radio__control" aria-hidden="true"><span /></span>}
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
  const rootRef = useRef<HTMLDivElement>(null);
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
    <div ref={rootRef} className={`sia-radio-group${optionType === "button" ? " sia-radio-group--button" : ""} ${className}`.trim()} role="radiogroup">
      {options?.map((option) => {
        const normalized = typeof option === "object" ? option : { label: String(option), value: option };
        return <Component value={normalized.value} disabled={normalized.disabled} key={normalized.value}>{normalized.label}</Component>;
      })}
      {children}
      {buttonStyle === "solid" && <RadioSelectionMotion rootRef={rootRef} />}
    </div>
  </RadioContext.Provider></ControlSizeContext.Provider>;
}

/** 单选框组件；普通形态点击以 360ms 等比缩放图形并回弹，描边按钮使用较小幅度；实心按钮分组以 280ms 液体沙漏形变转移选中背景。值和回调立即更新，禁用及减少动态效果时跳过动效。 */
export const Radio = Object.assign(RadioRoot, {
  /** 按钮形态单选项；放在 Radio.Group 内共享值与 buttonStyle，实心样式切换时由分组背景完成 280ms 液体沙漏形变。 */
  Button: RadioButton,
  /** 组合多个子项并统一管理布局或选择状态。 */
  Group: RadioGroup });
