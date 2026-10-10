import type { TableSettingsAdapter, TableSettingsSnapshot } from "./Table/types";

// 同一适配器及 scope 的写入串行执行，避免表格和查询区同时保存时彼此覆盖。
const queues = new WeakMap<TableSettingsAdapter, Map<string, Promise<void>>>();

/** 读取最新共享快照后仅覆盖传入属性；读取或保存失败原样抛出，不降级为覆盖式写入。 */
export function saveSettingsPatch(
  adapter: TableSettingsAdapter,
  scope: Parameters<TableSettingsAdapter["load"]>[0],
  patch: Partial<TableSettingsSnapshot>,
): Promise<void> {
  let scoped = queues.get(adapter);
  if (!scoped) { scoped = new Map(); queues.set(adapter, scoped); }
  const key = JSON.stringify([scope.moduleName, scope.businessKey]);
  const previous = scoped.get(key) ?? Promise.resolve();
  const task = previous.catch(() => undefined).then(async () => {
    const current = await adapter.load(scope);
    // undefined 不删除其他区域已经保存的属性，例如只保存列宽时保留分页大小。
    const defined = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    await adapter.save(scope, { ...current, ...defined });
  });
  scoped.set(key, task);
  const cleanup = () => { if (scoped!.get(key) === task) scoped!.delete(key); };
  void task.then(cleanup, cleanup);
  return task;
}
