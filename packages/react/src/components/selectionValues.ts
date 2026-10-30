import type { SelectionOption, SelectionValue } from "./SelectionPanel";

/** 过滤未匹配候选项的空白字符串，保留数字及业务显式定义的空值选项。 */
export function normalizeSelectionValues(values: readonly SelectionValue[], options: readonly SelectionOption[]): SelectionValue[] {
  // 空字符串常来自表单初始值；显式空值选项仍可能代表“全部”，不能按真值统一过滤。
  const known = new Set(options.filter(option => option.optionType !== "divider").map(option => option.value));
  return values.filter(value => typeof value === "number" || value.trim().length > 0 || known.has(value));
}
