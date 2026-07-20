import { useCallback, useState } from "react";

export type ControlSize = "small" | "medium" | "large";
export type ControlStatus = "default" | "warning" | "error";

type ControllableStateOptions<T> = {
  value: T | undefined;
  defaultValue: T;
  onChange?: (value: T) => void;
};

export function useControllableState<T>({ value, defaultValue, onChange }: ControllableStateOptions<T>) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const controlled = value !== undefined;
  const currentValue = controlled ? value : internalValue;

  const setValue = useCallback((nextValue: T) => {
    if (Object.is(currentValue, nextValue)) return;
    if (!controlled) setInternalValue(nextValue);
    onChange?.(nextValue);
  }, [controlled, currentValue, onChange]);

  return [currentValue, setValue] as const;
}
