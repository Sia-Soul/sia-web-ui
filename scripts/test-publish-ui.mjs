import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publishUi } from './publish-ui.mjs';

function scenario(results) {
  const calls = [];
  return { calls, run: (args) => { calls.push(args); assert(results.length, 'Unexpected npm call'); return results.shift(); } };
}
const ok = { status: 0, stdout: 'sia.soul\n' };
const versionOk = { status: 0, stdout: 'v0.1.7\n' };
test('有效身份直接发布，所有调用固定官方源', () => {
  const s = scenario([ok, versionOk, ok]);
  publishUi([], s.run, () => {});
  assert.deepEqual(s.calls.map(args => args[0]), ['whoami', 'version', 'publish']);
  assert(s.calls.every(args => args.includes('--registry=https://registry.npmjs.org/')));
});
test('过期凭据触发登录并再次验证身份', () => {
  const s = scenario([{ status: 1, stderr: 'E401 Unauthorized' }, ok, ok, versionOk, ok]);
  publishUi([], s.run, () => {});
  assert.deepEqual(s.calls.map(args => args[0]), ['whoami', 'login', 'whoami', 'version', 'publish']);
});
test('网络故障或登录取消不能继续发布', () => {
  for (const results of [[{status:1,stderr:'ETIMEDOUT'}], [{status:1,stderr:'ENEEDAUTH'}, {status:1}]]) {
    const s = scenario(results);
    assert.throws(() => publishUi([], s.run, () => {}));
    assert(!s.calls.some(args => args[0] === 'publish'));
  }
});
test('预演不登录且发布命令包含 dry-run', () => {
  const s = scenario([ok]);
  publishUi(['--dry-run'], s.run, () => {});
  assert.equal(s.calls.length, 1);
  assert(s.calls[0].includes('--dry-run'));
});
test('发布失败不重试，不接受其他发布参数', () => {
  const s = scenario([ok, versionOk, {status:1}]);
  assert.throws(() => publishUi([], s.run, () => {}));
  assert.equal(s.calls.length, 3);
  assert.throws(() => publishUi(['--ignore-scripts'], s.run, () => {}));
});

for (const bump of ['patch', 'minor', 'major']) {
  test(`支持 ${bump} 版本递增且不生成 Git 标签`, () => {
    const s = scenario([ok, versionOk, ok]);
    publishUi([bump], s.run, () => {});
    assert.deepEqual(s.calls[1], ['version', bump, '--no-git-tag-version', '--registry=https://registry.npmjs.org/']);
  });
}
test('默认递增 patch', () => {
  const s = scenario([ok, versionOk, ok]);
  publishUi([], s.run, () => {});
  assert.equal(s.calls[1][1], 'patch');
});
test('no-bump 重试不修改版本', () => {
  const s = scenario([ok, ok]);
  publishUi(['--no-bump'], s.run, () => {});
  assert.deepEqual(s.calls.map(args => args[0]), ['whoami', 'publish']);
});
test('版本更新失败后停止，冲突参数不能执行任何命令', () => {
  const s = scenario([ok, {status:1,stderr:'version failed'}]);
  assert.throws(() => publishUi([], s.run, () => {}), /版本更新失败/);
  assert.equal(s.calls.length, 2);
  for (const args of [['major','minor'], ['patch','--no-bump']]) {
    assert.throws(() => publishUi(args, () => assert.fail('不应运行 npm'), () => {}), /用法/);
  }
});
