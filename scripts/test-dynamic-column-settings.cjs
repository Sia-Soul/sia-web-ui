// 使用实际内部算法核对父子列切换及持久化，不依赖业务列 key 的点号约定。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('packages/react/src/components/Table/columnSettings.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: exportsObject });
const { reconcileColumnSettings: project, mergeColumnSettings: merge } = exportsObject;
const plain = (value) => JSON.parse(JSON.stringify(value));
const collapsed = [{ key: 'name' }, { key: 'metrics', width: 180 }, { key: 'date' }];
const expanded = [{ key: 'name' }, { key: 'metrics', children: [{ key: 'runs', width: 130 }, { key: 'duration', width: 130 }] }, { key: 'date' }];
const defaults = (columns) => columns.flatMap((column) => column.children ? defaults(column.children) : [{ key: column.key, width: column.width, visible: true }]).map((item, order) => ({ ...item, order }));
let saved = defaults(collapsed);
let active = project(expanded, defaults(expanded), saved);
assert.deepEqual(plain(active.map((item) => item.key)), ['name', 'runs', 'duration', 'date']);
active = active.map((item) => item.key === 'duration' ? { ...item, visible: false, width: 222 } : item);
saved = merge(expanded, saved, active);
let closed = project(collapsed, defaults(collapsed), saved);
assert.deepEqual(plain(closed.map((item) => item.key)), ['name', 'metrics', 'date']);
// 收起状态下调整另一个列后保存，再展开仍要保留子列宽度、显隐及父列位置。
saved = merge(collapsed, saved, closed.map((item) => item.key === 'name' ? { ...item, width: 333 } : item));
active = project(expanded, defaults(expanded), saved);
assert.deepEqual(plain(active.map((item) => item.key)), ['name', 'runs', 'duration', 'date']);
assert.equal(active.find((item) => item.key === 'duration').width, 222);
assert.equal(active.find((item) => item.key === 'duration').visible, false);
assert.equal(active.find((item) => item.key === 'name').width, 333);
// 修改父列顺序后，展开的整组跟随父列位置，而不是旧子列全局序号。
closed = project(collapsed, defaults(collapsed), saved);
saved = merge(collapsed, saved, [closed[2], closed[1], closed[0]].map((item, order) => ({ ...item, order })));
active = project(expanded, defaults(expanded), saved);
assert.deepEqual(plain(active.map((item) => item.key)), ['date', 'runs', 'duration', 'name']);
const fresh = project(expanded, defaults(expanded), [{ key: 'metrics', visible: false, fixed: 'left', order: 1 }]);
assert.equal(fresh.find((item) => item.key === 'runs').visible, false);
assert.equal(fresh.find((item) => item.key === 'runs').fixed, 'left');
assert.equal(project([...collapsed, { key: 'new' }], defaults([...collapsed, { key: 'new' }]), saved).length, 4);
assert.equal(merge(collapsed, [{ key: '__index__', visible: true, order: 0 }], closed).some((item) => item.key === '__index__'), false);
// 同时执行插件真实 apply/resize/pageSize 入口，防止只有算法修复而保存路径仍丢数据。
const source = fs.readFileSync('packages/react/src/components/Table/plugins.tsx', 'utf8');
const ast = ts.createSourceFile('plugins.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['isTableAuxiliaryColumn', 'createColumnSettingItems', 'applyColumnSettingsToTree', 'orderColumnSettings', 'createColumnSettingPlugin'];
const selected = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map((node) => node.getText(ast)).join('\n');
const pluginExports = {};
const flatten = (columns) => columns.flatMap((column) => column.children?.length ? flatten(column.children) : [column]);
vm.runInNewContext(ts.transpileModule(selected, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React } }).outputText, {
  exports: pluginExports,
  reconcileColumnSettings: project,
  mergeColumnSettings: merge,
  flattenTableColumns: flatten,
  normalizeFixed: (fixed) => fixed === true ? 'left' : fixed || undefined,
  columnSettingLoadTokens: new WeakMap(),
});
const snapshots = [];
const plugin = pluginExports.createColumnSettingPlugin({ scope: { moduleName: 'test', businessKey: 'dynamic' }, adapter: { save: async (_scope, snapshot) => snapshots.push(plain(snapshot)) } });
const context = {
  baseColumns: collapsed,
  state: { ...plugin.initialState, items: defaults(collapsed) },
  setState(update) { this.state = update(this.state); },
};
context.baseColumns = expanded;
let settings = plugin.getApi(context).getSettings();
assert.equal(settings.length, 4);
plugin.getApi(context).apply(settings.map((item) => item.key === 'duration' ? { ...item, width: 240, visible: false } : item));
assert.deepEqual(plain(plugin.transformColumns(expanded, context).map((column) => column.key)), ['name', 'metrics', 'date']);
context.baseColumns = collapsed;
plugin.onEvent({ type: 'columnResize', payload: { columnKey: 'metrics', width: 200 } }, context);
plugin.onEvent({ type: 'pageSizeChange', payload: 50 }, context);
assert.equal(snapshots.at(-1).columns.find((item) => item.key === 'duration').width, 240);
assert.equal(snapshots.at(-1).pageSize, 50);
context.baseColumns = expanded;
settings = plugin.getApi(context).getSettings();
assert.equal(settings.find((item) => item.key === 'duration').visible, false);
assert.equal(settings.find((item) => item.key === 'runs').width, 130);
console.log('PASS dynamic column settings: expand, collapse, restore, reorder, new columns, inheritance, auxiliary columns, plugin apply/resize/pageSize persistence');
