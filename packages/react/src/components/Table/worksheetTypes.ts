import type { TableColumn, TableKey } from "./types";
import type { TableCellAddress } from "./plugins";

/** 工作表一次数据变更的来源；行操作通过 replaceData 纳入同一历史。 */
export type TableWorksheetReason =
  | "edit"
  | "paste"
  | "fill"
  | "replace"
  | "undo"
  | "redo";
/** 单个单元格变更；只包含本次确实写入的单元格。 */
export interface TableWorksheetChange {
  /** 稳定行标识，与 Table.rowKey 一致。 */
  rowKey: TableKey;
  /** 目标列的 key。 */
  columnKey: string;
  /** 写入前的原始值。 */
  previousValue: unknown;
  /** 写入后的原始值。 */
  value: unknown;
}
/** 批量写入前的业务兼容检查上下文。 */
export interface TableWorksheetValueContext<T> {
  /** 当前目标记录；不要原地修改。 */
  record: T;
  /** 目标列，包含 editable.canEdit 等语义配置。 */
  column: TableColumn<T>;
  /** 待写入值；文本列保持原始字符串。 */
  value: unknown;
  /** 内部复制或填充的来源列 key；外部文本粘贴时未提供。 */
  sourceColumnKey?: string;
  /** 内部复制或填充时的来源记录快照；用于分类、属性组等业务兼容判断。外部粘贴未提供。 */
  sourceRecord?: T;
}
/** 一次操作的通知；新增编辑会清空恢复栈。 */
export interface TableWorksheetOperation {
  /** 触发本次数据变更的操作。 */
  reason: TableWorksheetReason;
  /** 本次变更的单元格；整表替换及撤销恢复时为空数组。 */
  changes: readonly TableWorksheetChange[];
  /** 本次因只读、禁用、类型或业务兼容限制跳过的单元格数量。 */
  skipped: number;
}
/** 工作表插件配置；每个 Table 实例通过 useMemo 创建独立插件。 */
export interface TableWorksheetPluginOptions<T> {
  /** 同步接收新的不可变数据数组并更新 Table.dataSource；返回 false 拒绝整次操作。禁止原地修改数据或返回 Promise。 */
  onChange: (data: T[], operation: TableWorksheetOperation) => void | boolean;
  /** 业务兼容检查；在框架只读和类型检查通过后执行，返回 false 跳过单元格，不改变其余单元格的位置。 */
  canWrite?: (context: TableWorksheetValueContext<T>) => boolean;
  /** 自定义不可变写回，适用于组合属性；默认按 column.dataIndex 路径复制嵌套对象。 */
  setValue?: (record: T, column: TableColumn<T>, value: unknown) => T;
  /** 历史记录上限，单位为整次操作；默认 100，最小 1。 */
  historyLimit?: number;
  /** 是否显示撤销和恢复按钮，默认 true；关闭后仍可通过快捷键与 API 操作。 */
  toolbar?: boolean;
  /** 单格编辑、批量粘贴或填充完成后通知，包括全部跳过的情况；业务拒绝或抛错时不通知，不自动弹出消息。 */
  onOperation?: (operation: TableWorksheetOperation) => void;
  /** 同步业务回调抛错时通知；该次操作不写入历史，不提交部分数据。 */
  onError?: (error: unknown) => void;
}
/** 工作表历史状态。 */
export interface TableWorksheetHistory {
  /** 是否存在可撤销的整次操作。 */
  canUndo: boolean;
  /** 是否存在可恢复的整次操作。 */
  canRedo: boolean;
}
/** 工作表公开操作句柄，通过 TableRef.getPluginApi("worksheet") 获取。 */
export interface TableWorksheetApi<T> {
  /** 撤销最近整次操作，包括一次批量粘贴或填充；没有历史或业务拒绝时返回 false。 */
  undo: () => boolean;
  /** 恢复最近撤销的操作；新编辑后恢复栈清空。 */
  redo: () => boolean;
  /** 读取当前撤销和恢复可用状态。 */
  getHistory: () => TableWorksheetHistory;
  /** 清空历史并取消编辑和填充；重新导入后可调用。外部替换 dataSource 时也自动清空历史。 */
  clearHistory: () => void;
  /** 从当前选区左上角粘贴 TSV；单值铺满选区，矩阵保持原列位置，越界部分截断，不自动新增行。 */
  paste: (text: string) => boolean;
  /** 将当前选区沿原列向上或向下填充到目标行；increment=true 按行距离递增末尾数字。 */
  fillTo: (rowKey: TableKey, increment?: boolean) => boolean;
  /** 向下填充连续空单元格，遇到第一行已有可编辑值时停止，不覆盖已有内容。 */
  fillDown: () => boolean;
  /** 写入单个可编辑单元格并纳入历史；只读、禁用及不兼容值返回 false。 */
  editCell: (address: TableCellAddress, value: unknown) => boolean;
  /** 将行复制、删除等业务操作产生的不可变数组纳入同一历史；不执行服务端写入。 */
  replaceData: (data: T[]) => boolean;
}
