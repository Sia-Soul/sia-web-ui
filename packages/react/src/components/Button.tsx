import { withTitleTooltip } from "./titleTooltip";
import { useControlSize } from "./shared";
import { forwardRef, useEffect, useRef } from "react";
import type { ButtonHTMLAttributes, CSSProperties, MouseEvent, ReactNode } from "react";
import type { ControlSize } from "./shared";

/** 按钮视觉样式，可选择主按钮、默认按钮、文本按钮或链接等形式。 */
export type ButtonVariant = "primary" | "default" | "dashed" | "filled" | "text" | "link";
/** 按钮尺寸等级。 */
export type ButtonSize = ControlSize;

/** 按钮的属性配置。 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   组件的视觉样式。
   * @defaultValue "default"
   */
  variant?: ButtonVariant;
  /** small / medium / large 高度为 22 / 30 / 38px；默认继承 Form，组件自身 size 优先 */
  size?: ButtonSize;
  /**
   * 显示加载状态并禁止重复点击
   * @defaultValue false
   */
  loading?: boolean;
  /**
   * 宽度撑满父容器
   * @defaultValue false
   */
  block?: boolean;
  /**
   * 危险操作样式
   * @defaultValue false
   */
  danger?: boolean;
  /** 按钮图标 */
  icon?: ReactNode;
  /**
   * 图标位置
   * @defaultValue "start"
   */
  iconPosition?: "start" | "end";
}

/** 按钮组件；鼠标、触摸和键盘激活立即执行 onClick 与表单默认行为，主按钮显示点击波纹。禁用或加载中禁止点击。 */
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
  const waveTimerRef = useRef<number>();

  // 按钮卸载时清理波纹计时器，避免继续访问旧节点。
  useEffect(() => () => {
    window.clearTimeout(waveTimerRef.current);
  }, []);

  function setRef(node: HTMLButtonElement | null) {
    localRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    const button = localRef.current;
    if (disabled || loading) return;
    if (button && variant === "primary") {
      const rect = button.getBoundingClientRect();
      // 键盘激活没有指针坐标；波纹从中心展开，并换算回未缩放的本地坐标。
      button.style.setProperty("--sia-wave-x", `${event.detail === 0 ? button.offsetWidth / 2 : (event.clientX - rect.left) * button.offsetWidth / rect.width}px`);
      button.style.setProperty("--sia-wave-y", `${event.detail === 0 ? button.offsetHeight / 2 : (event.clientY - rect.top) * button.offsetHeight / rect.height}px`);
      button.dataset.wave = "active";
      window.clearTimeout(waveTimerRef.current);
      waveTimerRef.current = window.setTimeout(() => delete button.dataset.wave, 360);
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
      {...withTitleTooltip(props)}
    >
      {loading ? <span className="sia-button__spinner" aria-hidden="true" /> : icon && iconPosition === "start" ? <span className="sia-button__icon">{icon}</span> : null}
      {children !== undefined && children !== null ? <span>{children}</span> : null}
      {!loading && icon && iconPosition === "end" ? <span className="sia-button__icon">{icon}</span> : null}
    </button>
  );
});
