/** 从发布入口导入 API，用 TypeScript Language Service 验证业务项目能看到悬停说明。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const packageRoot = path.resolve(__dirname, '../packages/react');
const filename = path.join(packageRoot, '__api-doc-consumer__.tsx').replaceAll('\\', '/');
// 上传新增的命令式句柄、OSS 配置及自定义渲染同样从发布产物检查悬停。
const source = `import { Upload, type UploadRef, type UploadHttpRequest, type UploadRequestOptions, QueryForm, Select, Modal, message, Form, createColumnSettingPlugin, type TableSettingsAdapter, type BarChartProps, type SelectModalConfig, type QueryFormProps, type TableProps, type TreeProps } from '@sia.soul/sia-react-ui';
import type { CardProps, TagProps, CheckboxGroupProps, TabsProps, UploadProps, UploadItemActions, PopconfirmProps, TooltipProps } from '@sia.soul/sia-react-ui';
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
cardProps.onSelectedChange;
cardProps.hoverActions;
// 无边框的留白规则必须随发布声明提供。
cardProps.bordered;
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
checkboxGroupProps.columns;
checkboxGroupProps.direction;
checkboxGroupProps.gap;
// 动画完成时机必须能从发布声明中直接获知。
declare const tabsProps: TabsProps;
tabsProps.deferContent;
tabsProps.contentGap;
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
// 业务接管上传入口时必须明确返回 false 的含义。
uploadProps.onChoose;
declare const uploadActions: UploadItemActions;
uploadActions.download;
const query = <QueryForm savedQueries={[]} onSaveQuery={async ({name,values})=>{}} onSearch={()=>{}} />;
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
queryProps.fieldWidth;
declare const tableProps: TableProps;
tableProps.cellSelection;
tableProps.showIndex;
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
const cases=[['savedQueries', '业务方'],['onSaveQuery','快照'],['allowClear','清空'],['modalThreshold','阈值'],['Modal.open','打开'],['message.success','成功'],['Form.useForm','表单实例'],['createColumnSettingPlugin({','列设置'],['adapter.save','保存'],['chart.barCategoryGap','间距'],['selection.maxHeight','像素'],['selection.extraValues','浅拷贝'],['selection.onConfirm','取消'],['queryProps.fieldWidth','列间距'],['tableProps.cellSelection','单元格选择'],['tableProps.showIndex','序号列']];
cases.push(['recursive', '子文件夹'], ['pastable', '粘贴'], ['autoUpload', '手动'], ['itemRender', '自定义'], ['uploadRef.upload', '取消'], ['httpUpload.body', '二进制'], ['uploadRequest.signal', '取消']);
// Tag 主入口属性注释与 core 配色类型都必须在发布后可用。
cases.push(['tagProps.color', 'CSS 颜色'], ['tagProps.variant', '边框'], ['tagProps.closeOnHover', '向右扩展'], ['tagProps.size', '继承 Form']);
cases.push(['checkboxGroupProps.columns', '等宽网格'], ['checkboxGroupProps.direction', '纵向单列'], ['checkboxGroupProps.gap', '行间距']);
cases.push(['tabsProps.contentGap', '仅影响当前 Tabs'], ['tabsProps.deferContent', '保留旧面板'], ['tabsProps.onAfterChange', '连续切换']);
cases.push(['uploadProps.downloadRequest', 'Blob'], ['uploadActions.download', '不打开新标签页']);
cases.push(['uploadProps.cardSize', '卡片尺寸']);
cases.push(['uploadProps.onChoose', '返回 false']);
// 剩余高度的优先级与容器约束必须随发布声明提供给业务使用者。
cases.push(['tableProps.fillRemaining', '剩余高度'], ['remaining.container', '独立确定高度'], ['remaining.bottomOffset', 'px'], ['remaining.minHeight', '最小总高度']);
cases.push(['toolbarItem.title', '禁用时仍可显示']);
cases.push(['treeOptions.showLine', 'ignoreChildrenColumn=false']);
cases.push(['treeProps.virtual', '自动启用虚拟滚动'], ['treeProps.virtualThreshold', '最少可见节点数'], ['treeProps.virtualItemHeight', '固定高度']);
cases.push(['cardProps.selectable', '非交互区域'], ['cardProps.onSelectedChange', '布尔状态'], ['cardProps.hoverActions', '滑入']);
// 验证新增属性的编辑器提示，而非仅检查源码注释存在。
cases.push(['cardProps.bordered', '内边距']);
cases.push(['confirmProps.skipConfirm', '跳过气泡'], ['confirmProps.onConfirm', 'Promise'], ['confirmProps.onConfirmError', '原始错误'], ['confirmProps.arrow', 'pointAtCenter'], ['floatingProps.autoAdjustOverflow', '可视区域'], ['floatingArrow.pointAtCenter', '中心']);
for(const[needle,expected]of cases){const offset=needle.includes('.')?needle.lastIndexOf('.')+1:0;const pos=source.indexOf(needle)+offset+1;const info=service.getQuickInfoAtPosition(filename,pos);const text=ts.displayPartsToString(info?.documentation);assert(text.includes(expected),`${needle}: expected ${expected}, got ${JSON.stringify(text)}`);console.log(`PASS hover ${needle}: ${text.slice(0,70)}`);}
for(const entry of ['index.d.ts','index.d.cts']){
  const text=fs.readFileSync(path.join(packageRoot,'dist',entry),'utf8');assert(text.includes('底部已保存快捷查询标签'));assert(text.includes('@defaultValue'));assert(!text.includes('\uFFFD'),'UTF-8 replacement character found');
}
service.dispose();
console.log('PASS published ESM/CJS declarations preserve Chinese JSDoc and default values.');
