# 业务组件扩展

这些能力由 SiaWebUI 组件源码实现，业务应用只做数据和接口适配。`packages/react/src/business.ts` 是不含图表、编辑器的独立构建入口。

## 日期

- `formatValue(value)` 只改变显示文本，回调仍使用标准字符串，方便业务层转换为 Dayjs 等日期对象。
- `renderExtraFooter()` 支持时间面板切换等扩展操作。
- RangePicker 的 `allowEmpty` 控制两个端点是否允许为空，可通过确定按钮提交单端范围。
- `endpointDisabled` 锁定指定端点，清空操作保留锁定值。
- `showTime.defaultValue` 接受一个时间字符串或开始、结束时间二元组，允许两个端点使用不同默认时间。
- 快捷范围与手动确认同样检查日期边界和最大跨度，避免快捷项绕过限制。
- 清空使用独立原生按钮，支持键盘焦点与 Enter 操作，避免在触发按钮内嵌套交互元素。

```tsx
<DatePicker.RangePicker
  defaultValue={['2026-09-01', '2026-09-07']}
  maxRangeDays={7}
  endpointDisabled={[true, false]}
  allowEmpty={[false, true]}
  formatValue={value => value.slice(0, 10)}
/>
```

## 弹窗

Modal 的 `afterOpenChange(open)` 在动画结束后触发，可用于聚焦、通知外部容器或释放挂载点。确认操作使用同步锁，连续触发确认也只执行一次异步回调；回调失败后释放锁并保持弹窗打开。

## 表单和类型

Form 快照递归复制普通对象、数组和 Date，对提供 `clone()` 的日期对象使用其克隆方法，保留日期对象的方法。其他非普通对象作为原子值保留，不通过序列化改变其语义。初始化只发生一次，避免空初始值导致后续重新初始化覆盖用户输入。

Table 和 Form.Item 使用 TypeScript 5.0 可识别的 JSX 返回类型，便于旧业务项目接入。

## 布局和树

Space.Compact 对包裹在业务组件内的输入、选择和日期控件统一连接圆角，焦点元素提升层级以显示完整边框。Tree 的展开按钮提供可访问名称与展开状态。

TreeSelect 新增受控 `open`、`searchValue`、`treeExpandedKeys`，自定义 `filterTreeNode` 搜索时保留祖先和匹配父节点的后代。默认保持独立勾选；设置 `treeCheckStrictly={false}` 可启用父子联动和半选，`disabled`/`disableCheckbox` 节点阻断联动。`showCheckedStrategy` 支持 all、parent、child。

`renderTrigger` 提供打开/关闭与清空方法，便于业务用 Sia Input 显示完整路径并保留 input ref；`dropdownFooter` 可放置 Sia Button 批量操作。支持加载状态、列表高度、弹层样式和键盘 Escape 关闭，原生清空按钮可聚焦。选择回显保持输入顺序，未在数据源找到的值仍显示。

`buildFlatTree(items, { idField, parentIdField, rootParentId })` 从平级数据复制构树，不修改输入。主键按字符串匹配，支持数字 0；默认根父值为 null、undefined、空串或 0，可显式指定根值以使用 0 作为父节点。孤儿及循环引用节点作为根节点，避免递归溢出。

这些扩展纳入 `@sia-ui/react-business@0.1.7`。KA 浏览器回归覆盖联动和独立选择、禁用边界、展示策略、搜索、受控重置、路径、输入 ref、键盘清空和异常平级数据。暂不提供异步节点加载或树虚拟滚动。

这些源码改动已通过组件包构建及类型检查，并由 KA 接入项目的浏览器回归覆盖日期边界、键盘清空、表单日期对象、弹窗防重和关闭生命周期。未覆盖的高级日期面板定制需继续补充，不能将这些能力视为其他 UI 库全部接口的替代声明。

## 输入与分组选择

`InputSelect` 与 `SelectionPanel` 自 0.1.8 加入业务入口及框架主入口。面板可以独立嵌入下拉和弹窗，支持单选/多选、分组、禁用说明、标签与编码展示、多列排版、搜索和已选过滤。未知值显示在自定义值分组，选择始终以实际值判断，避免同名标签混淆。

超过 100 个过滤选项时按行虚拟渲染；分组行和选项行分别计算高度。列表支持方向键、Home/End 移动活动选项，Enter/空格选择，并把目标行滚入可视区域。禁用项和分隔线不参与全选/反选，批量操作保留当前过滤结果之外的选择；清空移除全部选择。

InputSelect 支持原生 input ref、编码输入解析回调、受控清空、尺寸和校验状态。弹窗打开时复制当前选择作为草稿，取消丢弃草稿，确认才触发值变化，0 值也能正常初始化。KA 浏览器回归已覆盖同名选项、禁用项、草稿取消/确认、来源校验、编码转换、1200 项虚拟渲染和键盘跳转。
