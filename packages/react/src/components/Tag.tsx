import { withTitleTooltip } from "./titleTooltip";
import type { CSSProperties, HTMLAttributes, MouseEvent, ReactNode } from "react";
import { Icon } from "./Icon";

/** 标签的状态类型。 */
export type TagStatus = "default" | "success" | "processing" | "warning" | "error";
/** 标签的视觉样式：soft 为柔和浅底，outlined 为透明底描边，filled 为实色背景。 */
export type TagVariant = "soft" | "outlined" | "filled";

/** 标签的属性配置。 */
export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  /** 自定义 CSS 颜色，支持十六进制、rgb、颜色名称及 CSS 变量；覆盖 status 的颜色，由 variant 决定浅底、描边或实色效果。未提供非空颜色时沿用状态配色，style 中对应属性优先级最高。 */
  color?: string;
  /**
   * 语义状态配色；提供 color 时由自定义颜色覆盖。
   * @defaultValue "default"
   */
  status?: TagStatus;
  /**
   * 紧凑尺寸
   * @defaultValue false
   */
  compact?: boolean;
  /**
   * 视觉样式：soft 使用浅色背景和彩色文字；outlined 使用透明背景、彩色边框和文字；filled 使用实色背景、白字和透明边框。同样适用于自定义 color；实色浅底可通过 style.color 调整文字。
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
  /**
   * 配合 closable 使用：默认隐藏关闭按钮且不占宽度，鼠标悬停或内部获得键盘焦点时，标签向右扩展并显示按钮；离开后收回，过渡为 180 毫秒。禁用时不展开，无悬停能力的触屏设备直接显示以便操作，减少动态效果偏好下取消动画。
   * @defaultValue false
   */
  closeOnHover?: boolean;
  /**
   * 禁用关闭操作
   * @defaultValue false
   */
  disabled?: boolean;
  /** 请求关闭时触发的回调。 */
  onClose?: (event: MouseEvent<HTMLButtonElement>) => void;
}

/** 标记状态或筛选条件的标签，支持语义配色、自定义边框色或背景色及关闭操作。 */
export function Tag({
  color,
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
  style,
  ...props
}: TagProps) {
  // color 只选定基色，variant 统一决定呈现形式；透明混色适配亮暗底色，style 保留最终覆盖权。
  const customColor: CSSProperties | undefined = color?.trim() ? variant === "outlined"
    ? { borderColor: color, color, backgroundColor: "transparent" }
    : variant === "filled"
      ? { backgroundColor: color, color: "#fff", borderColor: "transparent" }
      : { color, backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`, borderColor: `color-mix(in srgb, ${color} 35%, transparent)` }
    : undefined;
  return (
    <span
      className={`sia-tag${closable && closeOnHover ? " sia-tag--close-on-hover" : ""} sia-tag--${status} sia-tag--${variant}${compact ? " sia-tag--compact" : ""}${disabled ? " sia-tag--disabled" : ""} ${className}`.trim()}
      aria-disabled={disabled || undefined}
      style={customColor ? { ...customColor, ...style } : style}
      {...withTitleTooltip(props)}
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
