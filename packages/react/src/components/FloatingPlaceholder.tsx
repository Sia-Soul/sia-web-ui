import type { ReactNode } from "react";
import { usePlaceholderMode } from "./shared";
import type { InputPlaceholderMode } from "./shared";

export function useFloatingPlaceholder({ mode, placeholder, filled, active = false }: {
  mode?: InputPlaceholderMode;
  placeholder?: ReactNode;
  filled: boolean;
  active?: boolean;
}) {
  const enabled = usePlaceholderMode(mode) === "floating" && Boolean(placeholder);
  return {
    enabled,
    className: enabled ? ` sia-placeholder-floating${filled ? " sia-placeholder-floating--filled" : ""}${active ? " sia-placeholder-floating--active" : ""}` : "",
    label: enabled ? <span className="sia-floating-placeholder" aria-hidden="true">{placeholder}</span> : null,
  };
}
