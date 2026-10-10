import type { TableSettingsAdapter } from "./Table/types";

/** 单个查询条件的云端布局；key 对应 QueryFormField.key 或直接子项的 React key。 */
export interface QueryFormFieldSetting {
  /** 查询条件的稳定标识，修改标识会被视为新增字段。 */
  key: string;
  /** 是否显示该条件；隐藏仅影响布局，不清空值或卸载字段。 */
  visible: boolean;
  /** 从 0 开始的排列序号；序号相同时保持原字段顺序。 */
  order: number;
}

/** 保存在共用配置 queryForm 属性中的查询布局，不包含查询值或快捷查询记录。 */
export interface QueryFormSettingsSnapshot {
  /** 字段显隐和顺序；未保存的新字段默认显示并追加到末尾。 */
  fields: readonly QueryFormFieldSetting[];
  /** 加载或应用设置后的默认收起状态；受控 collapsed 优先，collapsible=false 时不折叠。 */
  defaultCollapsed: boolean;
}

/** 查询云设置入口；与表格共用适配器实例及业务标识，分别读写 queryForm 和 columns。 */
export interface QueryFormSettingsConfig {
  /** 共用配置的异步读写适配器；挂载及打开设置时读取，保存前读取最新快照并合并，失败保留面板和草稿。 */
  adapter: TableSettingsAdapter;
  /** 云配置所属业务；与列设置使用相同 scope 可保存到同一记录。 */
  scope: {
    /** 所属业务模块名称。 */
    moduleName: string;
    /** 模块内配置记录的稳定标识。 */
    businessKey: string;
  };
  /** 配置读取或保存失败时通知；界面同时显示错误，不清除已应用设置。 */
  onError?: (error: unknown, operation: "load" | "save") => void;
}
