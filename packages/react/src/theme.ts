/** SiaTheme的模式类型。 */
export type SiaThemeMode = "light" | "dark";

/** 框架主题令牌集合。 */
export const SIA_THEME = {
  /** 主色。 */
  colorPrimary: "#1677ff",
  /** 主色的悬停色。 */
  colorPrimaryHover: "#4096ff",
  /** 主色的按下色。 */
  colorPrimaryActive: "#0958d9",
  /** 主要文本颜色。 */
  colorText: "#1f1f1f",
  /** 次要文本颜色。 */
  colorTextSecondary: "#666666",
  /** 页面背景颜色。 */
  colorBackground: "#f5f7fa",
  /** 组件表面颜色。 */
  colorSurface: "#ffffff",
  /** 默认边框颜色。 */
  colorBorder: "#d9d9d9",
  /** 默认圆角半径，单位为像素。 */
  borderRadius: 6,
  /** 默认控件高度，单位为像素。 */
  controlHeight: 32,
  /** 默认布局间距，单位为像素。 */
  spacing: 16,
  /** 默认字号，单位为像素。 */
  fontSize: 16,
  /** 默认小号文字尺寸为 13 像素，对应 --sia-font-size-small；业务可通过 CSS 变量覆盖。 */
  fontSizeSmall: 13,
  /** 大号文字尺寸，单位为像素。 */
  fontSizeLarge: 18,
} as const;

/** 将亮色或暗色主题应用到指定元素；省略目标时应用到文档根节点。 */
export function applySiaTheme(mode: SiaThemeMode, target: HTMLElement = document.documentElement) {
  target.dataset.siaTheme = mode;
  target.style.colorScheme = mode;
}
