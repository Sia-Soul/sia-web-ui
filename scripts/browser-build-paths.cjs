const path = require('node:path');
const { execFileSync } = require('node:child_process');

/** 读取浏览器实际 Cargo 输出目录，遵循仓库配置及 CARGO_TARGET_DIR 覆盖。 */
function browserTargetDirectory() {
  const browser = path.resolve(__dirname, '../apps/browser');
  const metadata = execFileSync('cargo', ['metadata', '--no-deps', '--format-version', '1', '--manifest-path', 'src-tauri/Cargo.toml'], {
    cwd: browser, encoding: 'utf8', windowsHide: true,
  });
  return JSON.parse(metadata).target_directory;
}

module.exports = { browserTargetDirectory };
