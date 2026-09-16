import type { HTMLAttributes, MouseEvent, ReactNode } from "react";
import { Icon } from "./Icon";

/** 标签的状态类型。 */
export type TagStatus = "default" | "success" | "processing" | "warning" | "error";
/** 标签的视觉样式。 */
export type TagVariant = "soft" | "outlined" | "filled";

/** 标签的属性配置。 */
export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  /**
   * 语义状态
   * @defaultValue "default"
   */
  status?: TagStatus;
  /**
   * 紧凑尺寸
   * @defaultValue false
   */
  compact?: boolean;
  /**
   组件的视觉样式。
   * @defaultValue "soft"
   */
  variant?: TagVariant;
  /** 标签前置图标 */
  icon?: ReactNode;
  /**
   * 是否显示关闭入口。
   * @defaultValue false
   */
  closable?: boolean;
  /** 悬停或键盘聚焦时展开关闭按钮。 */
  closeOnHover?: boolean;
  /**
   * 禁用关闭操作
   * @defaultValue false
   */
  disabled?: boolean;
  /** 请求关闭时触发的回调。 */
  onClose?: (event: MouseEvent<HTMLButtonElement>) => void;
}

/** 标签组件。 */
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
