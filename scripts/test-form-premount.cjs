// 直接运行真实 FormStore，覆盖延迟页签先回填后挂载、嵌套路径及重置语义。
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const source = fs.readFileSync('packages/react/src/components/Form.tsx', 'utf8');
const start = source.indexOf('function pathArray(');
const end = source.indexOf('type InternalFormInstance');
const code = ts.transpileModule(source.slice(start, end) + '\nexports.Store = FormStore;', {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(code, context);
const Store = context.exports.Store;
const plain = value => JSON.parse(JSON.stringify(value));
const store = new Store();
store.setFieldsValue({ autoAudit: true, empty: '', zero: 0, disabled: false });
store.setFieldValue(['nested', 'received'], 3);
let changes = 0;
store.configure({ autoAudit: false, nested: { fallback: 4 }, untouched: 5 }, { onValuesChange: () => changes++ });
assert.deepEqual(plain(store.getFieldsValue()), { autoAudit: true, empty: '', zero: 0, disabled: false, nested: { fallback: 4, received: 3 }, untouched: 5 });
assert.equal(changes, 0, '挂载与回填不能触发业务保存');
store.configure({ autoAudit: false }, {});
assert.equal(store.getFieldValue('autoAudit'), true, '后续渲染不覆盖当前值');
store.resetFields();
assert.deepEqual(plain(store.getFieldsValue()), { autoAudit: false, nested: { fallback: 4 }, untouched: 5 });
const reset = new Store();
reset.setFieldsValue({ a: 9, b: 8 });
reset.resetFields(['a']);
reset.configure({ a: 1, b: 2 }, {});
assert.deepEqual(plain(reset.getFieldsValue()), { a: 1, b: 8 });
const resetAll = new Store();
resetAll.setFieldsValue({ a: 9 });
resetAll.resetFields();
resetAll.configure({ a: 1 }, {});
assert.equal(resetAll.getFieldValue('a'), 1);
console.log('PASS Form 挂载前回填、嵌套初值、零值/空值、重置和静默挂载');
