import { useControlSize } from "./shared";
import { forwardRef, useRef } from "react";
import type { ButtonHTMLAttributes, CSSProperties, MouseEvent, ReactNode } from "react";
import type { ControlSize } from "./shared";

export type ButtonVariant = "primary" | "default" | "dashed" | "filled" | "text" | "link";
export type ButtonSize = ControlSize;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
  danger?: boolean;
  icon?: ReactNode;
  iconPosition?: "start" | "end";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "default",
    size: sizeProp,
    loading = false,
    block = false,
    danger = false,
    icon,
    iconPosition = "start",
    className = "",
    children,
    disabled,
    onClick,
    style,
    ...props
  },
  forwardedRef,
) {
  const size = useControlSize(sizeProp);
  const localRef = useRef<HTMLButtonElement | null>(null);

  function setRef(node: HTMLButtonElement | null) {
    localRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    const button = localRef.current;
    if (button && variant === "primary") {
      const rect = button.getBoundingClientRect();
      button.style.setProperty("--sia-wave-x", `${event.clientX - rect.left}px`);
      button.style.setProperty("--sia-wave-y", `${event.clientY - rect.top}px`);
      button.dataset.wave = "active";
      window.setTimeout(() => delete button.dataset.wave, 360);
    }
    onClick?.(event);
  }

  const mergedStyle: CSSProperties = block ? { ...style, width: "100%" } : style ?? {};

  return (
    <button
      ref={setRef}
      type="button"
      className={`sia-button sia-button--${variant} sia-button--${size}${danger ? " sia-button--danger" : ""} ${className}`.trim()}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      onClick={handleClick}
      style={mergedStyle}
      {...props}
    >
      {loading ? <span className="sia-button__spinner" aria-hidden="true" /> : icon && iconPosition === "start" ? <span className="sia-button__icon">{icon}</span> : null}
      {children !== undefined && children !== null ? <span>{children}</span> : null}
      {!loading && icon && iconPosition === "end" ? <span className="sia-button__icon">{icon}</span> : null}
    </button>
  );
});
