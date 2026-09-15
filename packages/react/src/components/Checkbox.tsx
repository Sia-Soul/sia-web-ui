import { ControlSizeContext, useControlSize } from "./shared";
import type { ControlSize } from "./shared";
import { createContext, forwardRef, useContext, useEffect, useId, useMemo, useRef } from "react";
import type { ChangeEvent, InputHTMLAttributes, ReactNode } from "react";
import { useControllableState } from "./shared";

export type CheckboxValue = string | number;

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "value" | "onChange"> {
  size?: ControlSize;
  value?: CheckboxValue;
  indeterminate?: boolean;
  children?: ReactNode;
  onChange?: (checked: boolean, event: ChangeEvent<HTMLInputElement>) => void;
}

export interface CheckboxOption {
  label: ReactNode;
  value: CheckboxValue;
  disabled?: boolean;
}

export interface CheckboxGroupProps {
  size?: ControlSize;
  value?: readonly CheckboxValue[];
  defaultValue?: readonly CheckboxValue[];
  options?: readonly (CheckboxOption | CheckboxValue)[];
  disabled?: boolean;
  name?: string;
  className?: string;
  children?: ReactNode;
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
      {...props}
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

export const Checkbox = Object.assign(CheckboxRoot, { Group: CheckboxGroup });
