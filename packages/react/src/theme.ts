export type SiaThemeMode = "light" | "dark";

export const SIA_THEME = {
  colorPrimary: "#1677ff",
  colorPrimaryHover: "#4096ff",
  colorPrimaryActive: "#0958d9",
  colorText: "#1f1f1f",
  colorTextSecondary: "#666666",
  colorBackground: "#f5f7fa",
  colorSurface: "#ffffff",
  colorBorder: "#d9d9d9",
  borderRadius: 6,
  controlHeight: 32,
  spacing: 16,
  fontSize: 16,
  fontSizeSmall: 14,
  fontSizeLarge: 18,
} as const;

export function applySiaTheme(mode: SiaThemeMode, target: HTMLElement = document.documentElement) {
  target.dataset.siaTheme = mode;
  target.style.colorScheme = mode;
}

