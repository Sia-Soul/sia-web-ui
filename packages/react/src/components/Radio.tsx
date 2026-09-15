import { ControlSizeContext, useControlSize } from "./shared";
import type { ControlSize } from "./shared";
import { createContext, forwardRef, useContext, useId, useMemo } from "react";
import type { ChangeEvent, InputHTMLAttributes, ReactNode } from "react";
import { useControllableState } from "./shared";

export type RadioValue = string | number;

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "value" | "onChange"> {
  size?: ControlSize;
  value: RadioValue;
  children?: ReactNode;
  onChange?: (checked: boolean, event: ChangeEvent<HTMLInputElement>) => void;
}

export interface RadioOption {
  label: ReactNode;
  value: RadioValue;
  disabled?: boolean;
}

export interface RadioGroupProps {
  size?: ControlSize;
  value?: RadioValue;
  defaultValue?: RadioValue;
  options?: readonly (RadioOption | RadioValue)[];
  optionType?: "default" | "button";
  buttonStyle?: "outline" | "solid";
  disabled?: boolean;
  name?: string;
  className?: string;
  children?: ReactNode;
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

export const Radio = Object.assign(RadioRoot, { Button: RadioButton, Group: RadioGroup });
