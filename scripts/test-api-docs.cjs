/** 从发布入口导入 API，用 TypeScript Language Service 验证业务项目能看到悬停说明。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const packageRoot = path.resolve(__dirname, '../packages/react');
const filename = path.join(packageRoot, '__api-doc-consumer__.tsx').replaceAll('\\', '/');
const source = `import { QueryForm, Select, Modal, message, Form, createColumnSettingPlugin, type TableSettingsAdapter, type BarChartProps, type SelectModalConfig, type QueryFormProps, type TableProps } from '@sia.soul/sia-react-ui';
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
`;
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,jsx:ts.JsxEmit.ReactJSX,strict:true,skipLibCheck:true,noEmit:true,esModuleInterop:true};
const host={getScriptFileNames:()=>[filename],getScriptVersion:()=> '0',getScriptSnapshot:file=>file===filename?ts.ScriptSnapshot.fromString(source):fs.existsSync(file)?ts.ScriptSnapshot.fromString(fs.readFileSync(file,'utf8')):undefined,getCurrentDirectory:()=>packageRoot,getCompilationSettings:()=>options,getDefaultLibFileName:ts.getDefaultLibFilePath,fileExists:file=>file===filename||ts.sys.fileExists(file),readFile:file=>file===filename?source:ts.sys.readFile(file),readDirectory:ts.sys.readDirectory,directoryExists:ts.sys.directoryExists,getDirectories:ts.sys.getDirectories};
const service=ts.createLanguageService(host);
const errors=service.getSemanticDiagnostics(filename).filter(d=>d.category===ts.DiagnosticCategory.Error);
assert.equal(errors.length,0,ts.formatDiagnosticsWithColorAndContext(errors,{getCurrentDirectory:()=>packageRoot,getCanonicalFileName:f=>f,getNewLine:()=> '\n'}));
const cases=[['savedQueries', '业务方'],['onSaveQuery','快照'],['allowClear','清空'],['modalThreshold','阈值'],['Modal.open','打开'],['message.success','成功'],['Form.useForm','表单实例'],['createColumnSettingPlugin({','列设置'],['adapter.save','保存'],['chart.barCategoryGap','间距'],['selection.maxHeight','像素'],['selection.extraValues','浅拷贝'],['selection.onConfirm','取消'],['queryProps.fieldWidth','列间距'],['tableProps.cellSelection','单元格选择'],['tableProps.showIndex','序号列']];
for(const[needle,expected]of cases){const offset=needle.includes('.')?needle.lastIndexOf('.')+1:0;const pos=source.indexOf(needle)+offset+1;const info=service.getQuickInfoAtPosition(filename,pos);const text=ts.displayPartsToString(info?.documentation);assert(text.includes(expected),`${needle}: expected ${expected}, got ${JSON.stringify(text)}`);console.log(`PASS hover ${needle}: ${text.slice(0,70)}`);}
for(const entry of ['index.d.ts','index.d.cts']){
  const text=fs.readFileSync(path.join(packageRoot,'dist',entry),'utf8');assert(text.includes('底部已保存快捷查询标签'));assert(text.includes('@defaultValue'));assert(!text.includes('\uFFFD'),'UTF-8 replacement character found');
}
service.dispose();
console.log('PASS published ESM/CJS declarations preserve Chinese JSDoc and default values.');
