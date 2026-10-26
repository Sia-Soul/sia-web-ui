# Table 工作表插件

<!-- 记录通用能力的契约及业务接入边界，避免业务复制框架交互或修改安装产物。 -->

`createWorksheetPlugin` 为 Table 提供批量复制粘贴、拖拽填充、双击自动填充和整次操作撤销/恢复。能力对齐合作方端款式报审批量导入的工作表交互，仅操作本地数据，不请求业务接口。

## 使用方式

```tsx
import { useMemo, useRef, useState } from "react";
import {
  Table, createWorksheetPlugin,
  type TableRef, type TableWorksheetApi,
} from "@sia.soul/sia-react-ui";

type Row = { id: number; code: string };

function ImportSheet() {
  const [rows, setRows] = useState<Row[]>([{ id: 1, code: "SKU001" }]);
  const table = useRef<TableRef<Row>>(null);
  // 插件每表独立且引用稳定；必须同步接回框架提供的新数组。
  const worksheet = useMemo(() => createWorksheetPlugin<Row>({
    onChange: next => { setRows(next); },
  }), []);
  return <Table
    ref={table}
    rowKey="id"
    columns={[{ key: "code", title: "商品编号", dataIndex: "code", editable: true }]}
    dataSource={rows}
    plugins={[worksheet]}
  />;
}
```

使用默认 `cellSelection` 插件。工作表已集成双击编辑，不要再安装 `createEditablePlugin`。行标识必须稳定。所有数据均不可原地修改；`onChange` 是同步受控回写，直接保存收到的数组引用，不返回 Promise。业务返回 `false` 拒绝整次操作；计算或回写抛错时通过 `onError` 通知，不提交部分数据或写入历史。

## 与款式导入对齐的交互

| 操作 | 行为 |
| --- | --- |
| 单击、拖选、双击 | 沿用 Table 单元格选择；双击进入单元格编辑，Enter 提交，Escape 取消 |
| Ctrl/Cmd+C | 复制矩形选区为 TSV，正确转义制表符、引号及单元格内换行 |
| Ctrl/Cmd+V | 从选区左上角按原行列位置粘贴；单值铺满选区；越界截断，不自动新增行 |
| 拖动选区右下角填充柄 | 沿当前列向上、向下复制；多行源循环填充，拖动到视口边缘自动滚动 |
| Ctrl/Cmd+拖动 | 按行距离递增末尾数字，保留前后缀、前导零和小数位 |
| 双击填充柄 | 向下填充连续空白，遇到第一行已有可编辑值停止，不覆盖该行 |
| Escape、指针取消、窗口失焦 | 取消正在拖动的填充，不提交数据 |
| 撤销、Ctrl/Cmd+Z | 一次撤销整个普通编辑、粘贴、填充或通过 `replaceData` 登记的行操作 |
| 恢复、Ctrl/Cmd+Shift+Z、Ctrl/Cmd+Y | 一次恢复整个操作；新编辑清空恢复栈 |

输入框内保留原生文本复制、粘贴和撤销。工作表事件只作用于自身，普通表格及嵌套表格不会被外层工作表拦截。

## 可写性与业务扩展

工作表默认隐藏铅笔装饰，单击选中和双击编辑不变；普通 `createEditablePlugin` 的 `showEditIcon` 默认 `true`，可显式关闭。内容中的校验图标保持业务原有颜色和可见性，不受编辑提示样式影响。

非编辑列及 `editable.canEdit=false` 单元格使用主题灰底，序号等插件附加列不变。示例用 `striped={false}` 关闭斑马纹。填充柄为 12×12 像素，贴单元格右下边缘定位，不受内容内边距影响。

- 只读列、`editable.canEdit=false` 的单元格跳过，保留其余内容的原列位置。
- 同一工作表内部复制保留原始值及编辑器类型；类型不同跳过。下拉值必须属于目标选项，自定义编辑器默认仅允许相同列间复制。
- 外部纯文本只写入文本/数字列，不写入下拉和自定义属性组。非法数字跳过，空数字转为 `null`；文本编号保留前导零。
- `canWrite({ record, column, value, sourceColumnKey, sourceRecord })` 在通用检查后补充业务兼容条件，例如属性组必须属于相同类目。外部文本没有来源记录。
- `setValue(record, column, value)` 可提供组合属性的不可变写回。默认沿 `dataIndex` 路径复制嵌套对象，保留已有数组结构，并拒绝原型污染路径。
- `onOperation` 通知单格编辑、粘贴和填充结果，含 `changes` 与 `skipped`；全部跳过也通知。业务拒绝或抛错不通知。插件不自动弹出消息。

## 历史与公开句柄

通过 `table.current?.getPluginApi<TableWorksheetApi<Row>>("worksheet")` 获取：

| 方法 | 用途 |
| --- | --- |
| `undo()` / `redo()` | 撤销/恢复，成功返回 `true` |
| `getHistory()` | 返回 `canUndo`、`canRedo` |
| `clearHistory()` | 清空历史、内部剪贴板并取消编辑/填充 |
| `paste(text)` | 按当前选区粘贴 TSV |
| `fillTo(rowKey, increment?)` | 填充至目标行，可指定递增 |
| `fillDown()` | 自动填充下方连续空白 |
| `editCell(address, value)` | 按通用写入规则更新单元格并进入历史 |
| `replaceData(nextRows)` | 将复制行、删除行等操作纳入统一历史 |

`historyLimit` 默认 100 次，最小 1；`toolbar=false` 隐藏框架撤销/恢复按钮，快捷键和 API 仍有效。历史保存整份不可变数据及选区；撤销恢复和整表替换的 `changes` 为空，业务从新数组重算校验结果。

重新导入文件时直接替换外部 `dataSource`，插件自动清空旧历史、内部剪贴板和旧编辑草稿。即使新旧行键和值一致，也不能把旧编辑草稿写进新文件。需要保留撤销的行操作必须使用 `replaceData`。

## 验证与发布接入

组件文档 Table 页的“工作表编辑、填充与历史”提供可运行示例。`scripts/test-worksheet.cjs` 包含纯数据检查和本地 Edge 浏览器回归，需 Node.js 20 或更新版本，以及脚本配置的 Playwright 运行时。

覆盖复制粘贴矩阵、只读/类型跳过、前导零、换行、拖拽递增、双击填充、完整历史、500 行虚拟表格、外部换表编辑隔离及嵌套表格隔离；结果在 `logs/worksheet/report.json`。剪贴板测试覆盖 ClipboardEvent 注入矩阵及实际 Ctrl+C/V 与系统剪贴板读写；鼠标拖拽、边缘自动滚动和编辑快捷键在浏览器执行。尚未覆盖真实 Excel 进程到系统剪贴板的端到端链路。

发布前还需通过 `pnpm check:api-docs`、组件库及文档站类型检查、组件库构建、`pnpm test:api-docs`。公开 API 中文注释随声明产物发布。

框架由用户发布。本轮不修改业务依赖、不修改 node_modules，也不提前从业务导入框架源码。发布后再升级合作方端依赖，将商品导入页普通编辑和行操作接入同一插件历史，补充业务 `canWrite`/`setValue` 并在真实商品导入页面验收。后端接口不在本轮范围内。

### 2026-10-26 验证结果

- 纯数据边界检查及 47 项 Edge 浏览器回归通过，无页面运行时异常。
- 组件库类型检查、ESM/CJS 与声明构建通过；文档站类型检查及生产构建通过。
- `pnpm check:api-docs` 通过：670 个公开声明、3642 个成员；`pnpm test:api-docs` 通过，覆盖新增插件及关键方法的发布声明悬停。
- 规范与需求两轮独立复核通过；换文件旧编辑隔离和嵌套表格事件隔离已修复并回归。
- `pnpm check:component-examples` 未通过：全库索引过期，并报告其他组件共 83 个属性缺少 JSX 样例，未在本次工作表变更中扩展修改。文档站构建另有大包及源码示例重复导入警告，构建成功。
- 尚未发布、升级合作方端或完成真实商品导入页的新插件验收；未覆盖真实 Excel 进程端到端剪贴板链路。

### 2026-10-26 外观反馈修正（0.1.127 之后待发布）

- 工作表隐藏编辑铅笔，普通 editable 插件保留默认提示；新增公开 `showEditIcon` 开关和发布声明悬停回归。
- 编辑提示样式仅作用于直属装饰图标，内容中的校验错误图标保持原色、常驻可见。
- 填充柄放大至 12×12，定位到单元格右下角。仅展示态改变定位，编辑器仍全格展示且不撑高行。
- 非编辑列和条件只读单元格灰底，在悬停、选择时保持；普通表格及插件附加列不改变。示例关闭双色行。
- 54 项 Edge 浏览器检查通过，包括普通表格隔离、图标颜色可见性、角柄尺寸位置、只读背景、编辑行高和此前工作表交互；无页面运行时异常。
- 组件库/文档站类型检查及构建、公开 API JSDoc 检查（670 声明、3643 成员）和发布声明悬停检查通过。文档站仍有既有大包等构建警告。
- 用户负责发布。业务目前仍为 0.1.127，未修改 node_modules、未本地链接框架；发布后需要在实际商品导入页验收新外观。
