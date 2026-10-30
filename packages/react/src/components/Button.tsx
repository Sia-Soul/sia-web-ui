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

/** 按钮组件；有效点击默认播放 320ms 的缩小、弹起和回稳动效，鼠标、触摸及键盘激活共用此反馈。连续点击从当前缩放继续，onClick 和表单默认行为不等待动画；禁用、加载中或系统减少动态效果时不启动动效。 */
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
  const bounceRef = useRef<Animation | null>(null);
  const waveTimerRef = useRef<number>();

  // 释放独立动画及波纹计时器，路由切换或按钮卸载后不再访问旧节点。
  useEffect(() => () => {
    bounceRef.current?.cancel();
    window.clearTimeout(waveTimerRef.current);
  }, []);

  /** 缩放独立于宿主 transform，且只使用合成属性，不改变按钮占位或推挤相邻内容。 */
  function playBounce(button: HTMLButtonElement) {
    if (!button.animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const current = getComputedStyle(button).scale;
    bounceRef.current?.cancel();
    const base = getComputedStyle(button).scale;
    const [x = 1, y = x] = base === "none" ? [] : base.split(/\s+/).map(Number);
    const scaled = (factor: number) => `${x * factor} ${y * factor}`;
    // 等比缩放保持文字与圆形图标比例，快速重击从当前画面接续，不先跳回原尺寸。
    const animation = button.animate([
      { scale: current === "none" ? "1" : current, offset: 0 },
      // 宽按钮保持等比缩放，以更明显的过冲表现弹性但不改变布局占位。
      { scale: scaled(.9), offset: .2 },
      { scale: scaled(1.09), offset: .52 },
      { scale: scaled(.96), offset: .78 },
      { scale: scaled(1), offset: 1 },
    ], { duration: 320, easing: "cubic-bezier(.3, 0, .25, 1)" });
    bounceRef.current = animation;
    animation.onfinish = () => { if (bounceRef.current === animation) bounceRef.current = null; };
  }

  function setRef(node: HTMLButtonElement | null) {
    localRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    const button = localRef.current;
    if (disabled || loading) return;
    if (button) playBounce(button);
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
