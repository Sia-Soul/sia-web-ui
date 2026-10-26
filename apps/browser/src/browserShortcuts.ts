import shortcuts from "./browserShortcuts.json";

/** 主窗口、独立侧栏和菜单共享快捷键表；原生 WebView2 同样读取这份映射。 */
export function browserShortcut(event: KeyboardEvent): string | undefined {
  // 输入法组合输入不触发外壳动作，额外修饰键必须精确匹配。
  if (event.isComposing || (event.ctrlKey && event.metaKey)) return undefined;
  return shortcuts.find(binding => binding.key === event.key.toLowerCase()
    && Boolean(binding.ctrl) === (event.ctrlKey || event.metaKey)
    && Boolean(binding.shift) === event.shiftKey && Boolean(binding.alt) === event.altKey)?.action;
}
