import type { TableKey } from "./types";

/** 为单个表格创建行标识解析器；内部键只关联数据对象，不修改业务数据。 */
export function createRowIdentity() {
  const keys = new WeakMap<object, string>();
  let sequence = 0;
  /** 优先使用有效的显式主键；缺省或缺失时分配内部键，同一对象重复读取保持稳定。 */
  return <T extends Record<string, unknown>>(record: T, index: number, rowKey?: string | ((record: T, index: number) => TableKey)) => {
    const explicit = typeof rowKey === "function" ? rowKey(record, index) : rowKey == null ? undefined : record[rowKey];
    if (typeof explicit === "string" || typeof explicit === "bigint" || (typeof explicit === "number" && Number.isFinite(explicit))) return explicit;
    let key = keys.get(record);
    if (key === undefined) {
      key = `__sia_internal_row_${++sequence}`;
      keys.set(record, key);
    }
    return key;
  };
}
