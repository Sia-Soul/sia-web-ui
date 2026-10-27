/** 后台标签的休眠时长；默认一小时，保存用户选择的数值及单位。 */
export interface TabSleepPreference {
  /** 正数时长；最短一分钟，最长七天。 */
  value: number;
  /** 输入值使用分钟或小时。 */
  unit: "minutes" | "hours";
}
/** 校验持久化偏好，旧版本或无效配置使用一小时。 */
export function normalizeTabSleep(value?: Partial<TabSleepPreference>): TabSleepPreference {
  const unit = value?.unit === "minutes" ? "minutes" : "hours";
  const amount = value?.value;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount * (unit === "hours" ? 60 : 1) < 1 || amount * (unit === "hours" ? 60 : 1) > 10080) return { value: 1, unit: "hours" };
  return { value: amount, unit };
}
/** 仅在调度时转换为毫秒；单位切换与设置保存不依赖定时器。 */
export function tabSleepMilliseconds(value: TabSleepPreference): number {
  const valid = normalizeTabSleep(value);
  return valid.value * (valid.unit === "hours" ? 3600000 : 60000);
}
