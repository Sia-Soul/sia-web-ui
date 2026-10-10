// 使用真实实现验证共享配置合并、失败恢复及拖动让位，避免仅验证界面文案。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(name) {
  const exports = {};
  const source = fs.readFileSync(`packages/react/src/components/${name}.ts`, 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, require: () => ({}) });
  return exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const { reconcileQueryFields, mergeQueryFields } = load('queryFormSettingsUtils');
const { getQuerySortPreview } = load('useQueryFieldSort');
const { saveSettingsPatch } = load('settingsPersistence');
async function main() {
  const fields = reconcileQueryFields(['a', 'b', 'new'], [{ key: 'b', order: 0, visible: false }, { key: 'a', order: 1, visible: true }]);
  assert.deepEqual(plain(fields), [{ key: 'b', order: 0, visible: false }, { key: 'a', order: 1, visible: true }, { key: 'new', order: 2, visible: true }]);
  assert.equal(mergeQueryFields([{ key: 'old', order: 4, visible: false }], fields).length, 4);
  // 不等高行向下与向上拖动时，旁边的行要按拖动行高度让出位置。
  const rects = [{ top: 0, height: 40 }, { top: 46, height: 60 }, { top: 112, height: 40 }];
  assert.deepEqual(plain(getQuerySortPreview(['a', 'b', 'c'], rects, 0, 120, 6)), { ordered: ['b', 'c', 'a'], offsets: { b: -46, c: -46, a: 112 } });
  // 指针长时间停在边界外，所有预览行仍处于原始内容范围，不能制造新的滚动空间。
  for (const from of [0, 1, 2]) {
    for (const dy of [-10000, 10000]) {
      const preview = getQuerySortPreview(['a', 'b', 'c'], rects, from, dy, 6);
      ['a', 'b', 'c'].forEach((key, index) => {
        const top = rects[index].top + preview.offsets[key];
        assert.ok(top >= 0 && top + rects[index].height <= 152);
      });
    }
  }
  assert.deepEqual(plain(getQuerySortPreview(['a', 'b', 'c'], rects, 2, -130, 6)).ordered, ['c', 'a', 'b']);
  let record = { columns: [{ key: 'a' }], pageSize: 20, extra: '保留' };
  const adapter = { load: async () => structuredClone(record), save: async (_, next) => { record = structuredClone(next); } };
  const scope = { moduleName: 'test', businessKey: 'shared' };
  const queryForm = { fields: plain(fields), defaultCollapsed: true };
  await Promise.all([saveSettingsPatch(adapter, scope, { queryForm }), saveSettingsPatch(adapter, scope, { pageSize: 50, columns: undefined })]);
  assert.deepEqual(record, { columns: [{ key: 'a' }], pageSize: 50, extra: '保留', queryForm });
  // 读取失败不能写空快照，失败后的队列仍应允许下一次保存。
  let fail = true;
  let writes = 0;
  const unstable = { load: async () => { if (fail) throw Error('load'); return record; }, save: async () => { writes++; } };
  await assert.rejects(saveSettingsPatch(unstable, scope, { pageSize: 30 }), /load/);
  assert.equal(writes, 0);
  fail = false;
  await saveSettingsPatch(unstable, scope, { pageSize: 30 });
  assert.equal(writes, 1);
  console.log('查询设置：共享配置合并、失败恢复、字段投影和实时让位验证通过');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
