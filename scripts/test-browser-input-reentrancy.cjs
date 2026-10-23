/** 校验测试与浏览器使用同一版 Tao，再对独立隐藏窗口执行原生输入重入压力测试。 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { browserTargetDirectory } = require('./browser-build-paths.cjs');
const root = path.resolve(__dirname, '..');
const browser = path.join(root, 'apps/browser/src-tauri');
const fixture = path.join(__dirname, 'fixtures/browser-input-reentrancy');
function taoVersion(directory) {
  const lock = fs.readFileSync(path.join(directory, 'Cargo.lock'), 'utf8');
  const versions = [...lock.matchAll(/\[\[package\]\]\s+name = "tao"\s+version = "([^"]+)"/g)];
  if (versions.length !== 1) throw new Error('必须使用唯一版本的 Tao 执行原生窗口回归测试');
  return versions[0][1];
}
if (process.platform !== 'win32') throw new Error('此回归测试需要 Windows 原生消息循环');
if (taoVersion(browser) !== taoVersion(fixture)) throw new Error('测试夹具与浏览器的 Tao 版本不一致，请同步更新锁文件');
console.log(`Testing browser Tao ${taoVersion(browser)}`);
// 与正式 EXE 共用有效构建目录，不能回退到 C 盘旧路径。
const result = spawnSync('cargo', ['run', '--release', '--locked', '--manifest-path', path.join(fixture, 'Cargo.toml'), '--target-dir', browserTargetDirectory()], { stdio: 'inherit', env: process.env });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
