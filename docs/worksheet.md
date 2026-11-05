# Table 工作表插件

<!-- 记录通用能力的契约及业务接入边界，避免业务复制框架交互或修改安装产物。 -->

`createWorksheetPlugin` 为 Table 提供批量复制粘贴、拖拽填充、双击自动填充和整次操作撤销/恢复。能力对齐合作方端款式报审批量导入的工作表交互，仅操作本地数据，不请求业务接口。

填充柄只在选区右下角单元格可编辑时显示，沿用 `editable` 和 `editable.canEdit(record)` 判断。只读列、条件不可编辑格以及动态锁定后的格子保留选中边框、复制和定位能力，但不显示右下角正方形。混合选区的右下角为只读格时同样隐藏；切回可编辑格或解除锁定后恢复。`canWrite` 仍用于写入时校验具体值与来源兼容性，不用于判断填充柄显隐。

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

### 必填列与单元格校验

`TableColumn.required=true` 显示红色列名和前置红星，仅表示表头语义，不自动判断空值。原始标题、列设置和导出列名不包含星号。

`TableColumn.invalid` 接受布尔值或 `(record, sourceIndex) => boolean`；业务提供校验结果，框架对整个单元格绘制淡红 135° 斜纹及 3px 红色底线。底线贴单元格左右及下边缘，与内部控件宽度和内边距无关；不增加行高、不阻断编辑和填充，固定列和选区继续正常工作。无错误时不改变普通单元格。

```tsx
// 示例：只对适用行验证金额缺失；0 是有效金额。
{ key: 'price', title: '基本售价', dataIndex: 'price', required: true,
  invalid: row => row.applicable && row.price == null }
```

业务负责排除不适用属性并区分空值与 0；错误说明可沿用 Tooltip。框架不插入叉号或其他可误认为清除按钮的图标。

工作表默认隐藏铅笔装饰，单击选中和双击编辑不变；普通 `createEditablePlugin` 的 `showEditIcon` 默认 `true`，可显式关闭。内容中的校验图标保持业务原有颜色和可见性，不受编辑提示样式影响。

非编辑列及 `editable.canEdit=false` 单元格使用主题灰底，序号等插件附加列不变。示例用 `striped={false}` 关闭斑马纹。填充柄为 12×12 像素，贴单元格右下边缘定位，不受内容内边距影响。

- 只读列、`editable.canEdit=false` 的单元格跳过，保留其余内容的原列位置。
- 同一工作表内部复制保留原始值及编辑器类型；类型不同跳过。下拉值必须属于目标选项，自定义编辑器默认仅允许相同列间复制。
- 外部纯文本只写入文本/数字列，不写入下拉和自定义属性组。非法数字跳过，空数字转为 `null`；文本编号保留前导零。
- `canWrite({ record, column, value, sourceColumnKey, sourceRecord })` 在通用检查后补充业务兼容条件，例如属性组必须属于相同类目。外部文本没有来源记录。
- `setValue(record, column, value)` 可提供组合属性的不可变写回。默认沿 `dataIndex` 路径复制嵌套对象，保留已有数组结构，并拒绝原型污染路径。
- `isEmpty(value, record, column)` 定义双击向下填充的空值规则，例如组合属性的所有字段均为空、多选数组长度为 0。默认仍只认 `null`、`undefined` 和空字符串；该回调不改变校验或粘贴的类型转换。
- `onOperation` 通知单格编辑、粘贴和填充结果，含 `changes` 与 `skipped`；全部跳过也通知。业务拒绝或抛错不通知。插件不自动弹出消息。

## 历史与公开句柄

### 可变行高与调整

Table 的 `rowHeights` 按稳定 `rowKey` 保存每行高度（px），未指定键时使用 `rowHeight`。`rowResizable` 默认关闭，启用后在首个可见单元格底边显示调整柄；上下键每次调整 10px，Esc 取消正在拖动的预览。高度下限由 `minRowHeight` 指定，不能低于当前 size 的默认高度；上限 `maxRowHeight` 默认 480px。无效高度回退，拖动时限制上下界。

不传 `rowHeights` 时表格内部保存高度；传入则为受控模式，`onRowHeightChange(record, height, sourceIndex)` 在拖动结束或键盘调整时仅调用一次，调用方须同步回填。预览和取消不产生业务历史；如需撤销行高，业务记录这次回调的前后值。工作表插件的撤销仍只处理数据，不混入布局变更。

多行内容在格内滚动，不撑高虚拟行。虚拟窗口、`scrollToRow` 与 `focusCell` 都使用累计高度定位，排序或筛选后按稳定键匹配。显式设置 `rowHeights` 或开启 `rowResizable` 时 Canvas 自动回退 DOM，保留虚拟化和全部交互。

```tsx
// 与款式工作表相同的 80px 默认高度、56～480px 调整范围。
<Table rowKey="id" rowHeight={80} rowHeights={heights} rowResizable
  minRowHeight={56} maxRowHeight={480}
  onRowHeightChange={(row, height) => setHeights(previous => ({ ...previous, [row.id]: height }))}
  columns={columns} dataSource={rows} />
```

可运行示例在 Table 页“工作表行高调整”。`node scripts/test-table-row-heights.cjs` 验证 500 行不同高度的定位、固定列、多行内容、拖动与键盘调整、受控回填与撤销、排序与少量数据，以及组合属性空值的填充和撤销恢复。此为框架验证，不能替代业务页面接入后的验收。

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

### 2026-10-26 必填列与整格红线（0.1.128 之后待发布）

- 新增 `TableColumn.required` 与 `invalid` 的公开声明、中文注释、文档示例及悬停回归。必填列头红字加前置星号，校验状态由业务决定，不擅自将 0 或不适用只读格判空。
- 错误纹理覆盖整个 td；3px 底线通过 td 的独立伪元素贴左右及下边缘，与内容内边距、内部组件无关。编辑器之上仍显示整格红线，填充柄保持完整；单元格独立层叠，避免红线穿过固定列或吸顶表头。
- 67 项框架浏览器回归通过，包含全格红线、编辑态、不截获点击、固定列、横纵滚动、选区、零值及修正/撤销/恢复。截图位于 `logs/worksheet/worksheet-validation-detail.png`、`worksheet-validation-edit.png`、`worksheet-validation-scroll.png`。
- 业务仍使用正式 0.1.128，仅先移除空值叉号并保留悬停原因；红色表头和整格校验样式等待用户发布后按品牌方字段配置接入。框架示例截图不能替代正式业务接入验收。
