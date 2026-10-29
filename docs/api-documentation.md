# 公开 API 的编辑器注释

Menu 的侧向子菜单相对父菜单项水平偏移 16px，为父面板内边距和边框留出空间；上下弹出仍偏移 4px，视口边缘沿用自动翻转。自定义父面板内边距时需考虑此偏移，以免面板边缘相互覆盖。

Menu 的弹出子菜单切换到兄弟目录时，在同一次状态更新中关闭旧分支及其后代，只保留当前分支与祖先；展开的内嵌模式仍允许多分支同时展开。悬停离开时基于最新状态执行延迟关闭，多个关闭回调合并执行也不会重新展开旧目录。使用 `FloatingScrollbarProvider` 接管长菜单后，滚动条不占布局宽度，悬停、滚动或拖动时显示，停止交互并离开后隐藏；滑块点击和拖动属于对应菜单内部操作，不触发外部点击关闭。独立窗口或独立文档需要各自挂载 Provider，无法沿用其他文档的滚动条接入。

Tooltip（包含 Form.Item 的校验提示）随模态层级显示：打开 Modal/Drawer 后，页面或父弹层上的提示暂时隐藏，当前层的提示仍正常显示；关闭动画完成后恢复尚未清除的校验提示。受控 open 与表单错误值不会因暂时遮挡而改变，业务不需要清空校验或设置 z-index。

Form.Item 的错误气泡悬浮在控件下方，不占表单空间，不改变字段间距。每次校验失败或通过 `setFields` 设置错误后显示 2 秒，再用 160 毫秒渐隐；之后鼠标悬停对应控件时显示、移开后渐隐。计时结束时鼠标仍在控件上则保持显示，直到移开。手动设置的 `validateStatus="error"` 或 `help` 变化时也重新提示，其他字段更新不延长本字段的提示时间。气泡透明后错误边框仍保留，校验通过或清除错误后才移除。系统开启减少动画时直接切换透明度。

鼠标进入气泡覆盖区域，或其他被遮挡控件获得焦点时，气泡仍暂时透明；避让结束后仅在 2 秒提示期内或控件悬停时恢复。透明时保留几何区域、错误文本及无障碍关联，气泡始终允许鼠标事件穿透。视口空间不足时沿用浮层防溢出规则。此行为仅用于表单错误提示，不改变普通 Tooltip、Popover。`noStyle` 仍只负责绑定与校验，不生成提示容器。

QueryForm 的字段可指定 `settingsHideDisabled: true`，用于编码等必须保留的查询入口。该字段忽略云端隐藏值，在查询设置中始终勾选且不可取消，仍可排序；不影响 Form 的必填校验。例如 `{ key: "sku_id", name: "sku_id", settingsHideDisabled: true, children: <Input placeholder="商品编码" /> }`。未指定时沿用原来的可隐藏行为。

`Form.useForm()` 实例允许在 Form 挂载前调用 `setFieldsValue` / `setFieldValue`，适用于延迟挂载页签中的接口回填。首次挂载时，已写入路径优先于 `initialValues`，未写入字段保留初始值；回填和挂载不触发业务保存。`resetFields` 仍恢复首次挂载的初始值，挂载前重置也按操作顺序生效。

Table 单元格选区在滚动后保留；正文选区描边位于吸顶表头与固定列之下，不覆盖列头内容。普通表头、分组表头和左右固定列均遵循此遮挡规则。

Tabs 设置确定高度（或由父级弹性布局分配高度）后，内容面板占满标签栏之外的剩余空间；未限定高度时仍随内容自然撑开。面板内的列表可采用纵向 Flex、查询区、`flex: 1; min-height: 0` 表格容器和 `Table height="100%"`，使空表分页保持在容器底部。上下左右页签、嵌套页签及保留隐藏面板均沿用此规则，不需要业务覆盖内部 CSS。

Tabs 的 `indicatorMotion` 可设置为 `stretch`（先朝目标拉长再收拢，300ms）或 `slide`（平移并同步调整尺寸）。`line`、`underline` 默认拉伸，其余样式默认平移；`card`、`pill` 没有独立指示器，不受此项影响。支持上下左右布局、长短标签、受控及键盘切换，快速反向切换从当前可见位置继续；首次定位、布局变化及系统减少动态效果时直接定位。`deferContent` 和 `onAfterChange` 等待真实动画结束，连续切换只完成最终目标。

Tabs 的 `destroyInactiveTabPane` 默认为 `false`：初次只挂载当前面板，其他面板首次访问时才挂载；切走后隐藏并保留组件状态，切回时不重新挂载，避免由重复挂载引起的初始化请求和状态重置。此行为不依赖 `deferContent`。保留挂载不阻止 props、state 或 Context 更新，也不会暂停隐藏组件的副作用；标签 key 和内容组件类型需保持稳定。从 `items` 移除标签或卸载 Tabs 时释放对应内容，同键标签重新添加后仍按首次访问挂载。仅管理 `items[].children`，Tabs 外部路由和内容的缓存由业务负责。

`deferContent=true` 仅控制显示时机：动画期间保留旧面板，动画结束后显示最终目标；未访问的目标此时才首次挂载，连续切换不会挂载未显示的中间目标。需要恢复切走销毁、切回重新初始化的行为时，显式设置 `destroyInactiveTabPane={true}`。升级前显式设置了 `destroyInactiveTabPane={false}` 的用法，也改为按需挂载，不再预先挂载全部隐藏面板。

```tsx
// 默认首次访问挂载，切走后保留状态。
<Tabs items={items} />
// 保留状态，同时等选中框动画结束后再显示目标内容。
<Tabs items={items} deferContent />
// 显式恢复切走销毁，切回重新执行初始化副作用。
<Tabs items={items} destroyInactiveTabPane />
```

`Segmented.variant` 默认为 `default`，设置 `zigzag` 后横向选项以闪电折线分隔，选中项使用主题色；`vertical=true` 或选项数量不为 2 时使用默认样式。左右标签始终可见，受控使用 `value/onChange`。

Table 未设置 `rowKey` 时按数据对象生成内部行标识，不自动读取 `id` 或首列。显式指定的字段缺失、为 null/undefined，或计算函数未返回有效键时，同样使用内部标识；0 是有效业务键。同一对象排序后保留内部键，接口刷新产生新对象时分配新键。跨请求保留勾选或用选中键提交业务操作时，应显式配置唯一的业务 `rowKey`。

选择弹框关闭卸载后，重新打开时可向 `createSelectionPlugin` 同时传入 `selectedKeys` 和 `selectedRows`，恢复其他分页上的已选明细。`selectedRows` 不添加选择、不进入当前页列表，当前页同键数据优先；跨页已选计数按去重后的 `selectedKeys` 统计，即使行数据尚未加载也不缩小计数。

表格 `createSelectionPlugin` 的跨页行缓存由每个 Table 实例独立持有。业务可以在渲染时重新创建插件，已选数量、已选明细及 `onChange` 返回的行数据仍跨页保留；取消勾选或清空会移除对应缓存，关闭跨页保留时只保留当前页选择，表格卸载后缓存释放。

组件库的公开组件、属性、配置、回调、实例方法和相关数据类型，必须直接在源码声明前使用中文 JSDoc（`/** ... */`）。普通 `//` 注释不能作为编辑器悬停说明使用。

说明应写清实际用途。受控属性需说明更新方式；异步回调需说明触发时机、参数、成功和失败行为；尺寸和时长应注明单位；默认值使用 `@defaultValue`，并以实现为准。不要仅重复属性名，也不要把其他组件中同名属性的含义直接套用。

注释必须聚焦当前声明或代码块。不要为了记录一次修改而追加其他对象的行为、无关样式细节、修复经过或对话背景。只有会影响当前对象使用的关联规则才需要说明；样式实现原因放在对应 CSS 或实现代码处。例如，`Form.Item.label` 只说明字段标签及其支持文本或 React 节点，必填星号的颜色应在星号样式处说明。

例如，快捷查询的持久化由业务方负责，`savedQueries` 的注释需要说明点击回填和查询行为，以及保存、删除后由业务方更新数组的要求。

```ts
/**
 * 未指定 popupMode 时，选项总数超过此值自动使用弹框。
 * @defaultValue 15
 */
modalThreshold?: number;
```

公开静态方法也需要注释，例如 `Modal.open`、`message.success`、`Form.useForm`。通过工厂函数返回的状态类型、内联配置和嵌套类型也属于说明范围。

## 检查

### 外部字段校验

`form.setFields([{ name: ['rows', rowKey, 'code'], errors: ['编号重复'] }])` 可批量回填 Excel 或接口返回的字段错误；`errors: []` 清除错误，省略 `errors` 保留原错误。`value` 省略时不改变输入，显式 `undefined` 清空值。一次调用只通知视图一次，不触发 `onValuesChange`，未挂载的动态字段也可预先回填，挂载后呈现。调用方仍负责跨字段业务校验和重试；`resetFields()` 同时清除外部错误。

```sh
# 检查六个发布入口可达的自有类型和成员是否缺少说明
pnpm check:api-docs

# 构建后验证业务项目从 npm 包名导入时的实际悬停结果
pnpm --filter @sia.soul/sia-react-ui build
pnpm test:api-docs
```

后一个检查使用 TypeScript Language Service，从包的 `exports.types` 指向的构建产物解析，而不是通过源码别名解析。它验证 JSX 属性、静态方法、插件函数和嵌套接口的中文说明，同时检查 ESM/CJS 类型声明保留注释。

继承的 React/DOM 属性沿用上游类型的说明，不复制到每一个组件。修改注释后，需要重新构建并发布新版本，业务项目升级依赖后才会读取新声明；仅修改仓库源码不会更新业务项目已安装的 npm 包。

## 后续新增和修改的强制要求

本规范适用于每一次框架修改，由根目录 [AGENTS.md](../AGENTS.md) 持续约束后续开发。新增组件、属性、函数、Hook、插件、静态 API、嵌套配置、返回句柄和相关类型时，必须同步写注释；修改默认值或行为时，必须更新现有注释和示例，不等待用户再次提醒。

完成前逐项核对：

1. 组件说明适用场景；属性说明用途、默认值、单位、可选值区别和与其他属性的关系。
2. 受控数据说明由谁更新；事件说明触发时机、参数和清空值；异步 API 说明等待、成功、失败及取消行为。
3. 函数说明参数和返回值；返回句柄说明更新和销毁的语义；嵌套结构的各个字段也必须可悬停查看说明。
4. 不使用“配置项”“见签名”等空泛注释代替实际行为。内部复杂逻辑应解释原因，简单赋值不要求逐行注释。
5. CSS 变量在源码或文档说明默认值、单位和优先级；文档示例与实际实现保持一致。
6. 检查文件编码及生成声明，确保中文没有乱码；继承属性改变了原生行为时，需要补充框架行为说明。

## 自动执行入口与检查边界

- 根目录 `pnpm check` 先检查公开 API 注释，构建后验证实际包导入的悬停说明。
- 组件包 `prepublishOnly` 在 npm 发布（包括一键发布）前执行注释检查、类型检查、构建和悬停验证，任一步失败均中止发布。
- `check:api-docs` 从组件包 `package.json` 的 `exports` 中发现类型入口。新入口必须有对应源码，不能静默跳过缺失入口。
- 覆盖检查不等同于“所有描述都足够详细”：开发者仍须对照实现人工检查语义、默认值、参数与失败行为。悬停测试是代表性回归，重要新增接口应追加用例。

## 查询表单布局变量

### 查询云设置

启用设置后，“查询、重置、另存为”紧凑按钮组末尾显示竖向三点图标，悬停提示“查询设置”，点击打开设置面板；未启用另存为时，图标紧跟重置按钮。

拖动排序支持实时预览：拖动项跟随指针，经过其他项时立即让位；松手更新面板草稿，点击保存才写入配置。拖动时按 Escape、指针取消或窗口失焦会恢复本次拖动前的顺序；列表内容较多时，靠近上下边缘会自动滚动。也可以使用每项右侧的上下按钮排序。

`QueryForm.settings={{ adapter, scope }}` 启用“查询设置”。复用列设置的 `TableSettingsAdapter` 实例和 `{ moduleName, businessKey }`，同一接口记录的 `queryForm` 保存 `{ fields: [{ key, visible, order }], defaultCollapsed }`。`columns`、`pageSize` 继续用于表格，查询值与快捷查询不写入该设置。

面板支持勾选显示／隐藏、拖动或上下移动排序、默认收起、恢复默认；编辑后点击保存才生效，取消不保存。挂载和打开面板时读取配置，读取失败可重试，保存失败保留草稿。字段使用稳定的 `fields[].key`；面板名称优先 `settingsLabel`，其次 `label`、控件 `placeholder`、key。使用 children 时应指定稳定 React key。新增字段默认显示并追加，暂时不存在的字段配置在保存时保留；隐藏字段不卸载、不清空值，仍参与表单查询和校验。

云端默认收起在初次加载和保存成功时应用；`collapsed` 受控值优先，`collapsible=false` 禁用折叠，能放入一行时不额外折叠。保存前读取最新完整快照并仅合并本次属性；同一页面的表格和查询区应复用同一个适配器实例，以串行处理同 scope 的写入。适配器的 load/save 必须完整透传 queryForm，读取失败时不得返回伪造空配置。跨浏览器同时写入的冲突仍需后端用版本号或原子合并处理。

```tsx
// settingsAdapter 复用已有云接口；两个组件使用同一实例和业务标识。
const scope = { moduleName: "brand", businessKey: "list" };
<QueryForm settings={{ adapter: settingsAdapter, scope }} fields={fields} onSearch={search} />;
<Table plugins={[createColumnSettingPlugin({ adapter: settingsAdapter, scope })]} columns={columns} dataSource={rows} />;
```

QueryForm 未指定 `collapsed` / `defaultCollapsed`、没有已保存的云端收起设置且用户未手动切换时，按可见查询条件完整展开后的实际行数判断：达到 3 行（含 3 行）自动收起，少于 3 行展开。行数不包含操作按钮、快捷查询和被查询设置隐藏的字段；容器宽度或条件数量变化后重新计算。显式 `defaultCollapsed={false}` 保持默认展开，受控 `collapsed` 优先；用户点击展开/收起后保持其选择，不再因行数变化自动切换。云端没有记录时保留自动模式，已保存的云端默认值仍按原有规则应用；`collapsible={false}` 始终不折叠。自动判断不触发 `onCollapsedChange`，该回调仅通知用户的展开/收起操作。

QueryForm 收起时默认预留操作区宽度，按字段实际宽度依次保留单行能容纳的条件，不再默认限制为 3 个字段。`collapsedCount` 默认 `Infinity`，业务显式指定时作为数量上限；空间不足仍会减少显示数量。隐藏字段保留挂载和值，窗口宽度变化后重新计算，全部字段与操作区能单行显示时不执行收起。

- `QueryForm.fieldWidth`：单列宽度，默认 `220px`；日期／时间区间与横向组合字段默认为两倍单列宽度加列间距，SelectDateRange 为三倍单列宽度加两处列间距，默认 `672px`。
- `--sia-query-field-gap`：字段横向与纵向间距，默认 `8px`，使用 CSS 长度值；双列和三列宽度计算使用同一个变量，可在 QueryForm 的 `style` 或 `className` 中覆盖。
- `fields[].width`：显式指定单个字段宽度时优先于自动双列／三列规则；窄屏展开布局仍适配容器宽度。

## 默认布局间距

布局间距变量 `--sia-spacing` 默认值为 `8px`，主题令牌 `SIA_THEME.spacing` 同步为 `8`（单位 px）。容器或组件可覆盖同名变量；组件显式设置的内边距优先于变量。有边框 Card 正文四周使用该变量，无边框正文使用 `8px 0`。

## 默认字号变量

- `--sia-font-size`：默认 `13px`，用于组件基础文字；单位为 CSS 长度，可通过容器或组件上的同名变量覆盖，组件自身显式设置的字号优先。
- `--sia-font-size-small`：默认 `13px`，用于按钮、输入框等组件的小字号文本；单位为 CSS 长度，业务可在组件或容器上覆盖。
- `--sia-control-font-size`：默认 `13px`，用于选择及日期控件字号；尺寸类在控件上分别指定 small `12px`、medium `13px`、large `16px`，优先于父级继承值；组件内联变量可覆盖尺寸类。

## 框架交互默认行为

- 表格列头仅在文字实际超宽省略时显示完整标题提示；完整显示时不提示。判断覆盖排序、筛选及列宽调整插件内部的文字容器，并在延迟显示前再次检查；列说明图标的提示保持独立。

- Input 的 `showCount` 按当前计数文字的实际宽度占位，例如 `0/50`、`10/50` 随位数变化自适应；不设固定计数宽度或额外内边距，与左侧内容保持 4px 间距。

- 日期范围开启 `showTime` 后，在日历中点选结束日期会自动将时间设为 `23:59`；开启 `showTime.showSecond` 时为 `23:59:59`，时间列同步定位，之后可手动调整。每次重新点选结束日期都会采用当天末尾，开始日期保持已有时间；“此刻”仍取点击时的当前时间，快捷范围仍保留其预设时间，纯日期不附加时间。

- 日期面板的 `showToday` 入口文案为“此刻”：每次点击取本机当前日期，开启 `showTime` 时填入当前时分，`showTime.showSecond` 为 true 时包含秒；未开启时间时只填日期。日历定位到当前月份，禁用日期不变更值；沿用 `needConfirm` 和范围分步确认规则，范围仅修改当前活动端点。多选模式确保今天已选中并更新其时间，不切换为取消选中。

- 日期范围选择器的活动底线在开始、结束输入区域之间以 220ms 平滑移动，包括带时间时点击“确定”进入另一端及手动切换端点；关闭面板后隐藏，系统启用减少动态效果时直接定位。
- TextArea 默认正文及浮动占位字号为 `14px`，small / medium / large 分别为 `12 / 14 / 16px`。
- Checkbox、Radio、Switch 默认标签字号为 `13px`，small / medium / large 分别为 `12 / 13 / 16px`，不改变勾选框、圆点或开关的图形尺寸。

- 原生 `title` 转换为框架提示后，鼠标停留或键盘聚焦 600ms 才显示；鼠标点击产生的焦点不会保留提示，移出、点击、滚动、窗口失焦或页面隐藏会取消等待或隐藏提示。
- 表格单元格选区在点击表格空白处或外部时清除；勾选框对应的行选择保持不变。拖拽经过表格外部不会提前清除选区。

## 清空能力的默认值

输入、输入选择、下拉选择、级联选择、树选择、日期／时间及数字区间控件禁用时隐藏清空入口，不保留按钮占位；直接设置组件 `disabled` 或通过 `Form disabled` / 原生 `fieldset disabled` 禁用均适用。恢复启用后，清空入口继续按各控件的 `allowClear` 和当前值显示。

框架中已提供 `allowClear` 的组件统一默认启用（`true`），显式传入 `allowClear={false}` 可关闭对应清空入口或再次点击取消选择的能力。包括 Input、InputSelect、Select、Cascader、TreeSelect、ColorPicker、DatePicker、TimePicker 和 Rate；日期／时间区间继承对应配置。新增带有该属性的组件也应遵守此约定。各组件保留原有清空值及回调语义，禁用状态下仍遵循原有交互限制。

## Form 标签与必填标记

Form 的提交只作用于当前表单：点击提交按钮或回车时，阻止浏览器默认提交及提交事件冒泡，再执行当前表单校验和回调。Modal 等 Portal 中的子 Form / QueryForm 不会触发祖先 Form 的保存，业务无需额外包裹提交事件隔离容器。

`Form.Item` 标签默认字号为 `13px`，适用于水平、垂直和行内布局。

水平和行内布局默认按同一 Form 内最宽的可见标签统一列宽，包含必填星号和自定义 React 节点；标签文字、字体或可见项变化后重新计算，移除最长标签时列宽同步缩小，各表单独立测量。垂直布局及窄屏水平布局保留上下排列。

`--sia-form-label-width` 可在 Form 或单个 Form.Item 的 CSS 类中指定标签列宽，接受 CSS 长度值，例如 `120px`，优先于自动测量值；未设置时使用内部 `--sia-form-auto-label-width`（单位 px，测量前为 `0px`），无需业务手动维护。

`Form.Item.label` 支持文本和包含 Tooltip 的 React 节点。必填星号使用独立类名 `sia-form-item__required-mark`，红色仅标识星号，不表示字段已校验失败，也不应改变自定义标签的颜色。只有用户交互触发校验或提交校验时，才按原有规则显示字段错误。

## Upload 已上传图片回填

Upload 的 `maxCount` 统计全部列表项（包括等待和失败项）。达到上限时，普通上传、拖拽上传及照片墙统一隐藏上传入口，已选列表保持原有配置；移除文件至低于上限后自动恢复。受控 `fileList` 需由业务在 `onChange` 中回填，入口随回填列表更新。未配置上限时不因数量隐藏入口。

回填记录可使用 `{ uid, name, url, status: "done" }`。Upload 统一按 `thumbUrl`、图片 MIME、文件名或 URL 路径后缀判断缩略图与内置预览；URL 的查询参数和 hash 不影响后缀识别。没有 MIME 和后缀的远程图片，在 `accept="image/*"` 等纯图片限制下尝试加载；混合文件场景应提供准确的 `type` 或 `thumbUrl`，已知非图片 MIME 保持文件预览。

Upload 会在选择、进度和完成时通知 `onChange`。若业务要求“上传完成”才算合法，应通过 `Form.Item validateTrigger={[]}` 在提交时验证，避免进度变化被当作用户填写错误；上传完成后可对该字段单独校验，清除先前提交的错误。


## Dropdown.Button 两侧独立禁用

主操作与菜单有不同权限时，使用 `buttonDisabled` 控制主操作，使用 `dropdownDisabled` 控制箭头入口。`disabled` 为 true 时优先禁用整组，两侧属性不能重新启用它。省略新属性时保持原有行为。`buttonProps` 继续统一控制两段的颜色与尺寸，业务无需拼接按钮或覆盖箭头宽度。

```tsx
// 核销和反核销具有独立权限，加载时统一禁用。
<Dropdown.Button
  disabled={loading}
  buttonDisabled={!canVerify}
  dropdownDisabled={!canUnverify}
  buttonProps={{ variant: "primary" }}
  menu={{ items: [{ key: "unverify", label: "批量反核销" }], onClick: unverify }}
  onClick={verify}
>
  批量核销
</Dropdown.Button>
```

此能力需随框架正式发布后由业务升级依赖接入；不能通过修改已安装包替代发布。

## 数字区间

- NumberRange 复用 InputNumber 的失焦、Enter 和方向键提交规则，两端为 `[number | null, number | null]`，0 为有效值，空端点表示未填写；组件不自动交换上下限，业务通过表单规则校验。
- 单一边框和波浪线分隔，宽度默认跟随容器；QueryForm 自动分配两列，不需要业务设置宽度。收起 QueryForm 后底部已保存快捷查询始终保留。
- `pnpm test:number-range` 检查空端点、0、精度、禁用/只读和清空入口；`pnpm test:api-docs` 检查区间值、回调及清空能力的发布声明。这些检查不替代浏览器交互验收。


## Modal 命令式关闭生命周期

`Modal.confirm`、`Modal.open` 及其余静态提示弹框在取消、确认成功或调用 `destroy()` 后，等待组件自身关闭动画结束，先调用 `afterOpenChange(false)`，再卸载宿主。业务可在该回调释放防重复打开的句柄；返回 false 的确认不关闭，也不触发关闭完成回调。创建后立即 destroy 同样完成关闭通知和宿主清理。


## Input 展开编辑

Input 的 expandable 默认 false；启用后显示展开图标，正文仅包含 TextArea。maxLength 与 showCount 继承输入框，确定通过 onChange 回填，取消保留原值；单行输入回填时换行转为空格。禁用、只读或非 text 类型不显示展开入口。示例：<Input expandable maxLength={500} showCount />。

`Segmented` 的 `zigzag` 变体支持 `shape="capsule" | "rectangle" | "rounded"`（默认胶囊）；选中块以 200ms 平滑缩放至 1.04 倍，取消选中平滑还原，不改变布局尺寸；遵循减少动态效果的系统设置。

## SQL Server 编辑器高亮

`Editor language="sql-sqlserver"` 区分 T-SQL 保留字、常用系统函数（如 COUNT/COUNT_BIG、ISNULL、GETDATE、DATEADD）、数据类型、@ 局部变量、@@ 系统变量、十六进制常量及 N'中文' 字符串。不执行 SQL，也不以词法高亮判断 SQL 的语法或性能是否正确。示例见 Editor 组件页。

Tree 默认 blockNode=true，节点标题填充剩余行宽；highlightSelectedAncestors 默认 false，仅选中项显示选中背景。需要强调祖先路径时显式设置 highlightSelectedAncestors。

Icon 的 settings 使用六齿轮廓，在 24×24 画布内居中；主体最长边按统一规则归一化为 18 单位（不含描边）。描边仍使用统一 strokeWidth，不随内部轮廓归一化改变粗细。

Tree 指定高度或通过 flex 填充容器时，节点按自然行高从顶部排列，剩余空间保留在底部；内容超出后仍由树自身浮动滚动条滚动。

## Result 操作结果

`Result` 从完整入口及 `core` 入口导出，用于展示成功、失败、信息或警告结果。默认 `status="info"`；`title`、`subTitle` 接受 React 节点，`children` 展示详情，`extra` 放置业务按钮。`icon` 不传时使用状态图标，传 `null` 或 `false` 时不保留图标占位。组件不请求接口、不增加默认按钮、不自动触发重试。长说明换行，操作区可换行，继承主题色。

```tsx
<Result status="success" title="文件已上传，正在后台导入中" extra={<Button onClick={openRecords}>前往查看导入记录</Button>} />
```


## 表单剩余高度与图片组

Form.fill 默认 false；开启后 Form 为纵向 flex 容器，父级需提供确定高度，内部列表可分配剩余空间。不会改变字段的横向/纵向布局和校验规则。

ImagePreviewGroup 按内部 Image 的页面顺序提供分组预览，可嵌套布局。preview=false 和受控预览图片不加入组；左右方向键及上一张/下一张按钮首尾不循环，删除当前图片会关闭预览。ImagePreview 的 current、count、onCurrentChange 用于受控导航，切换时调用方同步 src 与 alt。


## Table 工作表插件

createWorksheetPlugin 提供双击编辑、TSV 批量复制粘贴、填充柄与整次撤销恢复；通过 canWrite 和 setValue 适配业务属性，不在框架请求接口。使用契约、交互及验证范围见 [Table 工作表插件](worksheet.md)，组件示例见 Table 页。
