import { forwardRef } from "react";
import type { ButtonHTMLAttributes, MouseEvent } from "react";

/** 主题切换的属性配置。 */
export interface ThemeSwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  /** 当前是否勾选；作为受控属性时通过回调更新。 */
  checked: boolean;
  /** 状态变化时返回最新布尔值 */
  onCheckedChange?: (checked: boolean) => void;
  /**
   * 亮色主题的显示文案。
   * @defaultValue "亮色模式"
   */
  lightLabel?: string;
  /**
   * 暗色主题的显示文案。
   * @defaultValue "暗色模式"
   */
  darkLabel?: string;
}

/** 主题切换组件。 */
export const ThemeSwitch = forwardRef<HTMLButtonElement, ThemeSwitchProps>(function ThemeSwitch(
  {
    checked,
    onCheckedChange,
    lightLabel = "亮色模式",
    darkLabel = "暗色模式",
    className = "",
    onClick,
    ...props
  },
  ref,
) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onCheckedChange?.(!checked);
    onClick?.(event);
  }

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? darkLabel : lightLabel}
      className={`sia-theme-switch${checked ? " sia-theme-switch--dark" : ""} ${className}`.trim()}
      onClick={handleClick}
      {...props}
    >
      <span className="sia-theme-switch__selection" aria-hidden="true" />
      <span className={`sia-theme-switch__icon${checked ? "" : " is-active"}`} aria-hidden="true">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" /></svg>
      </span>
      <span className={`sia-theme-switch__icon${checked ? " is-active" : ""}`} aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M20 15.2A8 8 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" /></svg>
      </span>
    </button>
  );
});

