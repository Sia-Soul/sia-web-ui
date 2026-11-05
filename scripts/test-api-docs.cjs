/** 从发布入口导入 API，用 TypeScript Language Service 验证业务项目能看到悬停说明。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const packageRoot = path.resolve(__dirname, '../packages/react');
const filename = path.join(packageRoot, '__api-doc-consumer__.tsx').replaceAll('\\', '/');
// 上传新增的命令式句柄、OSS 配置及自定义渲染同样从发布产物检查悬停。
// 通用布局能力从发布入口验证，避免页面被迫重新实现内部行为。
const source = `import type { ChooseBoxProps, ChooseBoxSource, ChooseBoxEntry } from '@sia.soul/sia-react-ui';
// 文件夹句柄和受控提交语义需在发布后的悬停提示中保留。
declare const chooseBox: ChooseBoxProps; chooseBox.onChange; chooseBox.kind;
declare const chooseSource: ChooseBoxSource; chooseSource.authorize;
declare const chooseEntry: ChooseBoxEntry; chooseEntry.path;
import type { VirtualGridProps } from '@sia.soul/sia-react-ui';
declare const virtualGrid: VirtualGridProps<{ id: string }>;
virtualGrid.rowHeight; virtualGrid.onLoadMore;
import { createWorksheetPlugin, type TableWorksheetApi, type TableWorksheetPluginOptions } from '@sia.soul/sia-react-ui';
declare const worksheetApi: TableWorksheetApi<Record<string, unknown>>;
declare const worksheetOptions: TableWorksheetPluginOptions<Record<string, unknown>>;
createWorksheetPlugin;
worksheetApi.fillTo; worksheetApi.undo; worksheetApi.replaceData; worksheetOptions.onChange; worksheetOptions.canWrite;
// 普通编辑器保持默认铅笔提示，工作表可关闭装饰而保留编辑行为。
import type { TableEditablePluginOptions } from '@sia.soul/sia-react-ui';
declare const editableOptions: TableEditablePluginOptions<Record<string, unknown>>;
editableOptions.showEditIcon;
import { IdleGameApp, createIdleEngine, sampleHexPlayback } from '@sia.soul/sia-react-ui/game';
import type { FormInstance, FormFieldData, FormProps, ImagePreviewGroupProps, ImagePreviewProps, StepsProps } from '@sia.soul/sia-react-ui';
// 关闭完成回调和浮层反播规则必须保留在发布声明中。
import type { AlertProps, FloatButtonGroupProps } from '@sia.soul/sia-react-ui';
// 实心按钮分组的阶段和时长必须同步发布到编辑器提示。
import type { RadioGroupProps } from '@sia.soul/sia-react-ui';
declare const animatedRadio: RadioGroupProps; animatedRadio.buttonStyle;
// 空值规则须从发布声明中可见，避免业务将未填写字段当作自定义选项。
import type { InputSelectProps } from '@sia.soul/sia-react-ui';
declare const emptyInputSelect: InputSelectProps; emptyInputSelect.value;
declare const emptySelectionPanel: SelectionPanelProps; emptySelectionPanel.includeUnknownValues;
declare const animatedAlert: AlertProps; animatedAlert.afterClose;
declare const animatedPanel: FloatingPanelProps; animatedPanel.open;
declare const animatedFloatGroup: FloatButtonGroupProps; animatedFloatGroup.open;
declare const importSteps: StepsProps; importSteps.labelPlacement;
declare const importUpload: UploadProps; importUpload.acceptMode;
declare const externalValidationForm: FormInstance;
externalValidationForm.setFields;
declare const fillForm: FormProps; fillForm.fill;
fillForm.onFinish;
fillForm.onFinishFailed;
declare const imageGroup: ImagePreviewGroupProps; imageGroup.children;
declare const previewNavigation: ImagePreviewProps; previewNavigation.onCurrentChange;
declare const externalValidationField: FormFieldData;
externalValidationField.errors;
import type { FormItemProps } from '@sia.soul/sia-react-ui';
// 弹框的默认输入聚焦行为必须保留到发布声明。
import type { ModalProps } from '@sia.soul/sia-react-ui';
declare const inputFocusModal: ModalProps;
inputFocusModal.open;
inputFocusModal.autoFocus;
inputFocusModal.deferContent; inputFocusModal.loadingFallback;
import type { DrawerProps } from "@sia.soul/sia-react-ui";
declare const deferredDrawer: DrawerProps;
deferredDrawer.open;
deferredDrawer.deferContent; deferredDrawer.loadingFallback;
import type { FloatingScrollbarProviderProps } from "@sia.soul/sia-react-ui/core";
declare const automaticScrollbar: FloatingScrollbarProviderProps; automaticScrollbar.disabled;
import type { SkeletonProps } from "@sia.soul/sia-react-ui";
declare const skeletonPreview: SkeletonProps;
skeletonPreview.rows; skeletonPreview.columns; skeletonPreview.rowHeight; skeletonPreview.gap;
declare const centeredFormItem: FormItemProps;
centeredFormItem.align;
import type { IconProps } from '@sia.soul/sia-react-ui';
declare const semanticIcon: IconProps;
semanticIcon.tone;
import type { IdleGameDefinition, GameUnitAsset, IdleEngine } from '@sia.soul/sia-react-ui/game';
declare const gameConfig: IdleGameDefinition;
gameConfig.offlineCapSeconds;
gameConfig.turnDurationMs;
sampleHexPlayback;
declare const gameAsset: GameUnitAsset;
gameAsset.flip;
declare const gameEngine: IdleEngine;
gameEngine.settleOffline;
const gameView = <IdleGameApp definition={gameConfig} />;
createIdleEngine(gameConfig);
import type { CursorPreviewProps, CursorPreviewFrame } from '@sia.soul/sia-react-ui';
// 菜单生效状态与图片尺寸的声明必须保留到发布产物。
import type { MenuItem, MenuProps } from '@sia.soul/sia-react-ui';
// 网格模式与热点标注必须从发布入口提供可读的中文说明。
declare const gridMenu: MenuProps;
gridMenu.mode;
// 视频预览组件的默认行为必须保留在发布后的编辑器提示中。
import type { VideoProps } from '@sia.soul/sia-react-ui';
declare const videoPreview: VideoProps;
videoPreview.controls;
videoPreview.muted;
videoPreview.playsInline;
gridMenu.gridColumns;
gridMenu.interactionCursor;
// 自动定位的触发时机和保留手动滚动语义必须保留到发布声明。
gridMenu.autoScrollSelected;
gridMenu.selectedKeys;
declare const appliedMenuItem: MenuItem;
// 桌面窗口的文本选择能力从发布入口验证中文声明。
import type { WindowFrameProps, WindowControlsProps } from '@sia.soul/sia-react-ui';
declare const desktopWindow: WindowFrameProps;
desktopWindow.textSelectable;
// 窗口最大化状态的图标语义应保留到发布声明。
declare const windowControls: WindowControlsProps;
windowControls.maximized;
// 标题栏主题入口的默认显示与受控更新规则必须保留到发布声明。
import type { WindowTitleBarProps } from '@sia.soul/sia-react-ui';
declare const themeTitleBar: WindowTitleBarProps;
themeTitleBar.showThemeSwitch; themeTitleBar.theme; themeTitleBar.onThemeChange;
appliedMenuItem.applied;
appliedMenuItem.appliedLabel;
appliedMenuItem.iconSize;
declare const cursorPreview: CursorPreviewProps;
cursorPreview.followPointer;
cursorPreview.size;
cursorPreview.sizeUnit;
cursorPreview.showHotspot;
declare const cursorFrame: CursorPreviewFrame;
cursorFrame.hotspotX;
cursorFrame.duration;
import type { AutoSizerProps, FloatingPanelProps, SortableListProps, PopoverProps } from '@sia.soul/sia-react-ui';
declare const autoSizeProps: AutoSizerProps;
autoSizeProps.children;
declare const taskPanelProps: FloatingPanelProps;
taskPanelProps.open;
declare const sortableProps: SortableListProps;
sortableProps.onOrderChange;
sortableProps.handlePlacement;
sortableProps.handleContent;
sortableProps.renderItem;
sortableProps.wrap;
declare const widePopoverProps: PopoverProps;
widePopoverProps.contentSize;
import type { ResultProps } from "@sia.soul/sia-react-ui";
declare const resultProps: ResultProps;
resultProps.icon;
resultProps.extra;
import type { SelectOption, SelectProps, SelectionPanelProps } from '@sia.soul/sia-react-ui';
// 直接输入与标签宽度自适应的默认语义必须出现在发布后的属性提示中。
declare const adaptiveSelect: SelectProps;
adaptiveSelect.allowInput; adaptiveSelect.searchPlaceholder; adaptiveSelect.maxTagCount;
declare const helpOption: SelectOption;
helpOption.description;
declare const groupedSelection: SelectionPanelProps;
groupedSelection.groupCheckable;
declare const groupedModal: NonNullable<SelectProps['modalConfig']>;
groupedModal.groupCheckable;
import type { NumberRangeProps, DatePickerProps } from '@sia.soul/sia-react-ui';
import type { InputNumberProps } from '@sia.soul/sia-react-ui';
// 格式化与解析的草稿/提交语义必须保留在发布声明中。
declare const inputNumberProps: InputNumberProps;
inputNumberProps.formatter;
inputNumberProps.parser;
import type { InputProps } from '@sia.soul/sia-react-ui';
import type { TableColumn } from '@sia.soul/sia-react-ui';
// 列头提示仅在实际省略时显示的约定必须保留到发布声明。
declare const headerColumn: TableColumn;
headerColumn.required; headerColumn.invalid;
headerColumn.title;
// 展开编辑的确认回填约定必须保留到发布声明。
declare const expandableInputProps: InputProps;
expandableInputProps.expandable;
// 此刻快捷入口的时间精度和确认语义应保留到发布声明。
declare const datePickerProps: DatePickerProps;
datePickerProps.showToday;
datePickerProps.showTime;
// 数字区间空值与完整回调约定必须出现在发布声明中。
declare const numberRangeProps: NumberRangeProps;
numberRangeProps.value;
numberRangeProps.onChange;
numberRangeProps.allowClear;
// Treemap 关闭聚合后的原始节点保留方式必须进入发布声明。
declare const treemapProps: TreemapProps;
treemapProps.aggregateOverflow;
treemapProps.showValueInCompactTiles;
import { Upload, type UploadRef, type UploadHttpRequest, type UploadRequestOptions, QueryForm, Select, Modal, message, Form, createColumnSettingPlugin, type TableSettingsAdapter, type BarChartProps, type SelectModalConfig, type QueryFormProps, type TableProps, type TreeProps } from '@sia.soul/sia-react-ui';
import type { CardProps, TagProps, CheckboxGroupProps, TabsProps, UploadProps, UploadItemActions, PopconfirmProps, TooltipProps, TreemapProps } from '@sia.soul/sia-react-ui';
// 设置菜单和工具栏的提示属性必须保留禁用项提示约定。
import type { TableToolbarItem } from '@sia.soul/sia-react-ui';
// 树形连接线开关的默认值与启用条件必须保留在发布声明中。
import type { TableTreePluginOptions } from '@sia.soul/sia-react-ui';
declare const treeOptions: TableTreePluginOptions<Record<string, unknown>>;
treeOptions.showLine;
// Tree 大数据虚拟滚动的自动启用条件与固定行高约定必须保留在发布声明中。
declare const treeProps: TreeProps;
treeProps.virtual;
treeProps.virtualThreshold;
treeProps.virtualItemHeight;
declare const toolbarItem: TableToolbarItem<Record<string, unknown>>;
toolbarItem.title;
// 卡片交互说明必须随发布声明保留。
declare const cardProps: CardProps;
cardProps.selectable;
cardProps.interactionCursor;
cardProps.onAction;
cardProps.fill;
cardProps.onSelectedChange;
cardProps.hoverActions;
// 无边框的留白规则必须随发布声明提供。
cardProps.bordered;
// 组合按钮定位说明必须明确整组锚点，避免业务继续按箭头宽度补偿。
import type { DropdownButtonProps } from '@sia.soul/sia-react-ui';
declare const dropdownButtonProps: DropdownButtonProps;
dropdownButtonProps.placement;
import type { TagVariant as CoreTagVariant } from '@sia.soul/sia-react-ui/core';
import type { TagSize as CoreTagSize } from '@sia.soul/sia-react-ui/core';
// 确认气泡的条件触发与异步失败约定应出现在编辑器提示中。
declare const confirmProps: PopconfirmProps;
confirmProps.skipConfirm;
confirmProps.onConfirm;
confirmProps.onConfirmError;
confirmProps.arrow;
declare const floatingProps: TooltipProps;
floatingProps.autoAdjustOverflow;
declare const floatingArrow: Exclude<NonNullable<TooltipProps['arrow']>, boolean>;
floatingArrow.pointAtCenter;
declare const tagProps: TagProps;
tagProps.color;
tagProps.variant;
tagProps.closeOnHover;
tagProps.size;
// 验证分组排列属性在发布包中保留中文说明。
declare const checkboxGroupProps: CheckboxGroupProps;
// 圆形复选框的单项和分组继承规则须保留到发布声明。
import type { CheckboxProps } from '@sia.soul/sia-react-ui';
declare const circleCheckboxProps: CheckboxProps;
circleCheckboxProps.shape;
checkboxGroupProps.shape;
checkboxGroupProps.columns;
checkboxGroupProps.direction;
checkboxGroupProps.gap;
// 动画完成时机必须能从发布声明中直接获知。
declare const tabsProps: TabsProps;
tabsProps.deferContent;
tabsProps.destroyInactiveTabPane;
tabsProps.contentGap;
// 动效选项的默认范围与时长必须出现在发布后的编辑器提示中。
tabsProps.indicatorMotion;
// 位置规则及圆角矩形样式需随类型声明发布，供编辑器直接读取。
tabsProps.indicatorPosition;
tabsProps.type;
tabsProps.onAfterChange;
const tagSize: CoreTagSize = 'large';
const tagVariant: CoreTagVariant = 'outlined';
const upload = <Upload recursive pastable autoUpload={false} itemRender={node => node} />;
declare const uploadRef: UploadRef;
uploadRef.upload;
declare const httpUpload: UploadHttpRequest;
httpUpload.body;
declare const uploadRequest: UploadRequestOptions;
uploadRequest.signal;
// 下载入口必须明确 Blob 约定和失败行为。
declare const uploadProps: UploadProps;
uploadProps.downloadRequest;
uploadProps.cardSize;
// 数量上限控制上传入口显隐的说明必须保留到发布声明。
uploadProps.maxCount;
// 业务接管上传入口时必须明确返回 false 的含义。
uploadProps.onChoose;
declare const uploadActions: UploadItemActions;
uploadActions.download;
const query = <QueryForm showSettings={undefined} savedQueries={[]} onSaveQuery={async ({name,values})=>{}} onSearch={()=>{}} />;
const select = <Select options={[]} allowClear modalThreshold={15} />;
Modal.open({title:'示例'});
message.success('成功');
Form.useForm();
createColumnSettingPlugin({});
declare const adapter: TableSettingsAdapter;
adapter.save;
declare const chart: BarChartProps;
chart.barCategoryGap;
declare const selection: SelectModalConfig;
selection.maxHeight;
selection.extraValues;
selection.onConfirm;
declare const queryProps: QueryFormProps;
queryProps.collapsed;
queryProps.fieldWidth;
  // 默认折叠阈值和手动选择优先级必须出现在发布后的悬停说明中。
  queryProps.defaultCollapsed;
// 确认发布声明保留收起字段默认按可用宽度排列的说明。
queryProps.collapsedCount;
// 查询云设置及共享快照的嵌套说明必须能从发布包读取。
queryProps.settings;
queryProps.fields![0].settingsHideDisabled;
declare const querySettings: NonNullable<QueryFormProps['settings']>;
querySettings.adapter;
querySettings.scope.businessKey;
declare const querySnapshot: NonNullable<Awaited<ReturnType<typeof querySettings.adapter.load>>>;
querySnapshot.queryForm;
querySnapshot.queryForm!.defaultCollapsed;
querySnapshot.queryForm!.fields[0].visible;
declare const tableProps: TableProps;
// 行定位必须通过发布入口保留失败条件与表头避让说明。
declare const progressTable: import('@sia.soul/sia-react-ui').TableRef<Record<string, unknown>>;
progressTable.scrollToRow;
progressTable.focusCell;
// 公开视觉配置必须在发布包中保留颜色、倍率与单位说明。
declare const focusOptions: import('@sia.soul/sia-react-ui').TableCellFocusOptions;
focusOptions.color;
focusOptions.speed;
focusOptions.lineWidth;
tableProps.cellSelection;
tableProps.showIndex;
tableProps.rowStatus;
// 不等行高和组合属性空值语义必须随正式包提供给业务编辑器。
tableProps.rowHeights; tableProps.rowResizable; tableProps.onRowHeightChange;
worksheetOptions.isEmpty;
tableProps.maxBodyHeight;
tableProps.fillRemaining;
declare const remaining: Exclude<NonNullable<TableProps['fillRemaining']>, boolean>;
remaining.container;
remaining.bottomOffset;
remaining.minHeight;
`;
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,jsx:ts.JsxEmit.ReactJSX,strict:true,skipLibCheck:true,noEmit:true,esModuleInterop:true};
const host={getScriptFileNames:()=>[filename],getScriptVersion:()=> '0',getScriptSnapshot:file=>file===filename?ts.ScriptSnapshot.fromString(source):fs.existsSync(file)?ts.ScriptSnapshot.fromString(fs.readFileSync(file,'utf8')):undefined,getCurrentDirectory:()=>packageRoot,getCompilationSettings:()=>options,getDefaultLibFileName:ts.getDefaultLibFilePath,fileExists:file=>file===filename||ts.sys.fileExists(file),readFile:file=>file===filename?source:ts.sys.readFile(file),readDirectory:ts.sys.readDirectory,directoryExists:ts.sys.directoryExists,getDirectories:ts.sys.getDirectories};
const service=ts.createLanguageService(host);
const errors=service.getSemanticDiagnostics(filename).filter(d=>d.category===ts.DiagnosticCategory.Error);
assert.equal(errors.length,0,ts.formatDiagnosticsWithColorAndContext(errors,{getCurrentDirectory:()=>packageRoot,getCanonicalFileName:f=>f,getNewLine:()=> '\n'}));
// 行状态须保留主题和交互优先级的编辑器说明。
const cases=[['tableProps.rowStatus','悬停和勾选反馈优先'],['showSettings', '两行'],['savedQueries', '业务方'],['onSaveQuery','快照'],['allowClear','清空'],['modalThreshold','阈值'],['Modal.open','打开'],['message.success','成功'],['Form.useForm','表单实例'],['createColumnSettingPlugin({','列设置'],['adapter.save','保存'],['chart.barCategoryGap','间距'],['selection.maxHeight','像素'],['selection.extraValues','浅拷贝'],['selection.onConfirm','取消'],['queryProps.fieldWidth','列间距'],['tableProps.cellSelection','单元格选择'],['tableProps.showIndex','序号列']];
cases.push(['tableProps.rowHeights', '受控行高'], ['tableProps.rowResizable', '键盘上下键'], ['tableProps.onRowHeightChange', '撤销历史'], ['worksheetOptions.isEmpty', '组合属性']);
cases.push(['chooseBox.onChange', '取消'], ['chooseBox.kind', 'directory'], ['chooseSource.authorize', '取消返回 null'], ['chooseEntry.path', '不能视为本机绝对路径']);
cases.push(['inputNumberProps.formatter', '原始草稿'], ['inputNumberProps.parser', '不经过 parser']);
cases.push(['adaptiveSelect.allowInput', '自动聚焦'], ['adaptiveSelect.searchPlaceholder', '输入或搜索'], ['adaptiveSelect.maxTagCount', '默认不限制数量']);
  cases.push(['queryProps.defaultCollapsed', '达到 3 行'], ['queryProps.defaultCollapsed', '用户手动切换']);
cases.push(['inputFocusModal.autoFocus', '首个可用输入组件'], ['inputFocusModal.autoFocus', '异步加载']);
// 验证默认自适应排列及显式数量上限都能在编辑器悬停正文中读取。
cases.push(['queryProps.collapsedCount', '自动填满一行'], ['queryProps.collapsedCount', '显式指定时作为数量上限']);
// 不可隐藏是布局限制，不应被误解为表单必填校验。
cases.push(['queryProps.fields![0].settingsHideDisabled', '不改变表单必填校验']);
// 防止“此刻”时间赋值规则在声明构建后丢失。
// 结束日期的默认时间及精度也必须在悬停中可见。
cases.push(['datePickerProps.showTime', '23:59:59']);
cases.push(['expandableInputProps.expandable', '取消不修改原值']);
cases.push(['datePickerProps.showToday', '当前时分'], ['datePickerProps.showToday', 'needConfirm']);
cases.push(['recursive', '子文件夹'], ['pastable', '粘贴'], ['autoUpload', '手动'], ['itemRender', '自定义'], ['uploadRef.upload', '取消'], ['httpUpload.body', '二进制'], ['uploadRequest.signal', '取消']);
// Tag 主入口属性注释与 core 配色类型都必须在发布后可用。
cases.push(['tagProps.color', 'CSS 颜色'], ['tagProps.variant', '边框'], ['tagProps.closeOnHover', '向右扩展'], ['tagProps.size', '继承 Form']);
cases.push(['checkboxGroupProps.columns', '等宽网格'], ['checkboxGroupProps.direction', '纵向单列'], ['checkboxGroupProps.gap', '行间距']);
cases.push(['circleCheckboxProps.shape', 'circle 为圆形'], ['checkboxGroupProps.shape', '子项显式 shape 优先']);
cases.push(['tabsProps.contentGap', '仅影响当前 Tabs'], ['tabsProps.deferContent', '保留旧面板'], ['tabsProps.onAfterChange', '连续切换']);
cases.push(['tabsProps.indicatorMotion', '先拉长再收拢'], ['tabsProps.indicatorMotion', '300ms']);
cases.push(['tabsProps.indicatorPosition', '默认朝向内容区'], ['tabsProps.indicatorPosition', '横向标签可选'], ['tabsProps.type', 'rounded 圆角矩形']);
// 默认保留、首次挂载与显式销毁的区别必须随发布声明出现在悬停正文中。
cases.push(['tabsProps.destroyInactiveTabPane', '默认 false'], ['tabsProps.destroyInactiveTabPane', '首次激活时挂载'], ['tabsProps.destroyInactiveTabPane', 'true 时切走后卸载']);
cases.push(['uploadProps.downloadRequest', 'Blob'], ['uploadActions.download', '不打开新标签页']);
cases.push(['uploadProps.cardSize', '卡片尺寸']);
cases.push(['headerColumn.title', '完整显示时不提示']);
cases.push(['queryProps.settings', 'queryForm'], ['querySettings.adapter', '合并'], ['querySettings.scope.businessKey', '稳定标识'], ['querySnapshot.queryForm', '排序'], ['querySnapshot.queryForm!.defaultCollapsed', '受控'], ['querySnapshot.queryForm!.fields[0].visible', '不清空']);
cases.push(['uploadProps.maxCount', '隐藏上传入口'], ['uploadProps.maxCount', '低于上限后恢复']);
cases.push(['uploadProps.onChoose', '返回 false']);
// 剩余高度的优先级与容器约束必须随发布声明提供给业务使用者。
cases.push(['tableProps.fillRemaining', '剩余高度'], ['remaining.container', '独立确定高度'], ['remaining.bottomOffset', 'px'], ['remaining.minHeight', '最小总高度']);
cases.push(['toolbarItem.title', '禁用时仍可显示']);
cases.push(['treeOptions.showLine', 'ignoreChildrenColumn=false']);
cases.push(['treeProps.virtual', '自动启用虚拟滚动'], ['treeProps.virtualThreshold', '最少可见节点数'], ['treeProps.virtualItemHeight', '固定高度']);
cases.push(['cardProps.selectable', '非交互区域'], ['cardProps.onSelectedChange', '布尔状态'], ['cardProps.hoverActions', '滑入']);
// 整卡动作的互斥规则必须保留在发布声明的编辑器提示中。
cases.push(['cardProps.onAction', '内部按钮']);
cases.push(['cardProps.fill', '父容器']);
// 验证新增属性的编辑器提示，而非仅检查源码注释存在。
cases.push(['cardProps.bordered', '内边距']);
// 发布声明应保留组合菜单相对于整组按钮定位的约定。
cases.push(['dropdownButtonProps.placement', '整组按钮']);
cases.push(['confirmProps.skipConfirm', '跳过气泡'], ['confirmProps.onConfirm', 'Promise'], ['confirmProps.onConfirmError', '原始错误'], ['confirmProps.arrow', 'pointAtCenter'], ['floatingProps.autoAdjustOverflow', '可视区域'], ['floatingArrow.pointAtCenter', '中心']);
// 覆盖区间受控、清空和回调语义，防止打包丢失中文说明。
cases.push(['numberRangeProps.value', 'null'], ['numberRangeProps.onChange', '完整区间'], ['numberRangeProps.allowClear', '只读']);
// 验证紧凑布局与紧凑数值显示的编辑器提示，而非只检查源码覆盖率。
cases.push(['treemapProps.aggregateOverflow', '紧凑网格'], ['treemapProps.showValueInCompactTiles', '截断']);
// 分组选择及帮助说明必须在发布入口保留悬停文档。
cases.push(['helpOption.description', '说明'], ['groupedSelection.groupCheckable', '分组'], ['groupedModal.groupCheckable', '分组']);
cases.push(['resultProps.icon', 'undefined'], ['resultProps.extra', '调用方']);
cases.push(['autoSizeProps.children', '重新显示'], ['taskPanelProps.open', '不抢夺焦点'], ['sortableProps.onOrderChange', '取消'], ['widePopoverProps.contentSize', '宽']);
// 标题手柄的摆放与第三参数语义须保留到实际发布声明。
cases.push(['sortableProps.handlePlacement', 'custom'], ['sortableProps.handleContent', '卡片标题'], ['sortableProps.renderItem', '第三个参数']);
// 指针预览的重要单位、热点和交互语义需保留在正式声明的悬停提示中。
cases.push(['cursorPreview.followPointer', '热点'], ['cursorPreview.size', 'CSS 像素'], ['cursorFrame.hotspotX', '归一化'], ['cursorFrame.duration', '毫秒']);
// 物理像素模式的提示必须随类型声明发布，避免使用方误认为 size 一直是 CSS 像素。
cases.push(['cursorPreview.sizeUnit', '物理像素']);
cases.push(['gridMenu.gridColumns', '88px']);
// 普通指针模式须在发布声明保留默认值与使用场景。
cases.push(['gridMenu.interactionCursor', '普通选择指针'], ['cardProps.interactionCursor', '内部独立控件']);
cases.push(['gridMenu.autoScrollSelected', '手动滚动']);
cases.push(['gridMenu.mode', '双列圆角卡片'], ['cursorPreview.showHotspot', '真实热点']);
cases.push(['appliedMenuItem.applied', '浏览选中'], ['appliedMenuItem.appliedLabel', '当前使用'], ['appliedMenuItem.iconSize', 'px']);
cases.push(['desktopWindow.textSelectable', '输入框']);
cases.push(['windowControls.maximized', '叠放方框']);
cases.push(['videoPreview.controls', '默认 true'], ['videoPreview.muted', '默认 false'], ['videoPreview.playsInline', '默认 true']);
// 重内容延后挂载和占位说明必须保留在发布声明。
cases.push(['skeletonPreview.rows', '默认 6']);
cases.push(['skeletonPreview.columns', '默认 2']);
cases.push(['skeletonPreview.rowHeight', 'CSS px']);
cases.push(['skeletonPreview.gap', '默认 16']);
cases.push(['inputFocusModal.deferContent', '入场完成']);
cases.push(['inputFocusModal.loadingFallback', '关闭退场']);
cases.push(['deferredDrawer.deferContent', '默认 false']);
cases.push(['automaticScrollbar.disabled', '默认全局接管']);
cases.push(['deferredDrawer.loadingFallback', '占位']);
cases.push(['themeTitleBar.showThemeSwitch', '默认 true']);
cases.push(['gridMenu.selectedKeys', '260ms']);
cases.push(['themeTitleBar.theme', '由宿主']);
cases.push(['themeTitleBar.onThemeChange', '目标主题']);
// 六边形回放和在线/离线统一时钟的公开说明必须保留在发布声明中。
cases.push(['gameConfig.turnDurationMs','毫秒'],['sampleHexPlayback;','命中前不扣血']);
// 游戏独立入口同样验证真实编辑器悬停和时间单位。
cases.push(['gameConfig.offlineCapSeconds','秒'],['gameAsset.flip','水平翻转'],['gameEngine.settleOffline','避免重复结算']);
cases.push(['centeredFormItem.align', '整个内容区居中']);
cases.push(['semanticIcon.tone', '图标语义色']);
// 外部字段错误回填与清除语义须完整保留到业务端悬停提示。
cases.push(['fillForm.fill', '剩余高度'], ['imageGroup.children', '不加入分组'], ['previewNavigation.onCurrentChange', '序号']);
cases.push(['importSteps.labelPlacement', '图标右侧'], ['tableProps.maxBodyHeight', '自然高度']);
cases.push(['importUpload.acceptMode', '完整失败明细']);
cases.push(['externalValidationForm.setFields', '不触发'], ['externalValidationField.errors', '空数组']);
// 校验失败与保存失败的区别必须保留在发布声明的编辑器提示中。
cases.push(['fillForm.onFinish', '可返回 Promise'], ['fillForm.onFinishFailed', '仅字段校验失败']);
// 工作表 API 必须从发布包解析并保留同步受控写回、整次历史和兼容检查约束。
cases.push(['createWorksheetPlugin;', '整次撤销恢复'], ['worksheetApi.fillTo', '递增'], ['worksheetApi.undo', '整次操作'], ['worksheetApi.replaceData', '同一历史'], ['worksheetOptions.onChange', '同步'], ['worksheetOptions.canWrite', '跳过单元格']);
cases.push(['progressTable.scrollToRow', '吸顶表头']);
// 单元格定位的异步结果及动效约束必须保留在发布声明中。
// 定位能力的编辑器提示应说明固定尾端增长的新动效语义。
cases.push(['progressTable.focusCell', '尾端固定']);
cases.push(['focusOptions.color', '#fa8c16'], ['focusOptions.speed', '速度倍率'], ['focusOptions.lineWidth', 'CSS px']);
cases.push(['editableOptions.showEditIcon', '默认 true']);
// 必填和校验外观必须通过正式发布声明提供中文业务语义。
cases.push(['headerColumn.required', '不自动校验'], ['headerColumn.invalid', '不改变行高']);
cases.push(['queryProps.collapsed', '240ms']);
cases.push(['animatedRadio.buttonStyle', '液体轮廓']);
cases.push(['emptyInputSelect.value', '空字符串']);
// 面板快速关闭是成对时长规则的明确例外，发布声明必须告知业务。
cases.push(['inputFocusModal.open', '160ms'], ['deferredDrawer.open', '180ms']);
cases.push(['emptySelectionPanel.includeUnknownValues', '纯空格']);
cases.push(['animatedAlert.afterClose', '180ms'], ['animatedPanel.open', '反播'], ['animatedFloatGroup.open', '保留原有面板外观']);
// 虚拟列表的固定高度及触底去重约束须在业务编辑器中可见。
cases.push(['virtualGrid.rowHeight', '固定高度'], ['virtualGrid.onLoadMore', '只通知一次']);
// 换行排序公开属性必须在发布包悬停中解释方向约束。
cases.push(['sortableProps.wrap', '自动换行']);
for(const[needle,expected]of cases){const offset=needle.includes('.')?needle.lastIndexOf('.')+1:0;const pos=source.indexOf(needle)+offset+1;const info=service.getQuickInfoAtPosition(filename,pos);const text=ts.displayPartsToString(info?.documentation);assert(text.includes(expected),`${needle}: expected ${expected}, got ${JSON.stringify(text)}`);console.log(`PASS hover ${needle}: ${text.slice(0,70)}`);}
for(const entry of ['index.d.ts','index.d.cts']){
  const text=fs.readFileSync(path.join(packageRoot,'dist',entry),'utf8');assert(text.includes('底部已保存快捷查询标签'));assert(text.includes('@defaultValue'));assert(!text.includes('\uFFFD'),'UTF-8 replacement character found');
}
service.dispose();
console.log('PASS published ESM/CJS declarations preserve Chinese JSDoc and default values.');
