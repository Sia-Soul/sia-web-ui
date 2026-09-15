import type { HTMLAttributes, MouseEvent, ReactNode } from "react";
import { Icon } from "./Icon";

export type TagStatus = "default" | "success" | "processing" | "warning" | "error";
export type TagVariant = "soft" | "outlined" | "filled";

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  status?: TagStatus;
  compact?: boolean;
  variant?: TagVariant;
  icon?: ReactNode;
  closable?: boolean;
  /** 悬停或键盘聚焦时展开关闭按钮。 */
  closeOnHover?: boolean;
  disabled?: boolean;
  onClose?: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function Tag({
  status = "default",
  compact = false,
  variant = "soft",
  icon,
  closable = false,
  closeOnHover = false,
  disabled = false,
  onClose,
  className = "",
  children,
  ...props
}: TagProps) {
  return (
    <span
      className={`sia-tag${closable && closeOnHover ? " sia-tag--close-on-hover" : ""} sia-tag--${status} sia-tag--${variant}${compact ? " sia-tag--compact" : ""}${disabled ? " sia-tag--disabled" : ""} ${className}`.trim()}
      aria-disabled={disabled || undefined}
      {...props}
    >
      {icon ? <span className="sia-tag__icon">{icon}</span> : null}
      <span>{children}</span>
      {closable ? (
        <button
          type="button"
          className="sia-tag__close"
          aria-label="移除标签"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onClose?.(event);
          }}
        >
          <Icon name="close" size={12} />
        </button>
      ) : null}
    </span>
  );
}
