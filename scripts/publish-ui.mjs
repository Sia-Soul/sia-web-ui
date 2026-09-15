import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '../packages/react');
const registry = '--registry=https://registry.npmjs.org/';

function runNpm(args, capture = false) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd: packageDir,
    shell: process.platform === 'win32',
    stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  return result;
}

export function publishUi(args = [], run = runNpm, log = console.log) {
  const bumps = args.filter(arg => ['patch', 'minor', 'major'].includes(arg));
  if (args.some(arg => !['patch', 'minor', 'major', '--dry-run', '--no-bump'].includes(arg)) || bumps.length > 1 || (bumps.length && args.includes('--no-bump'))) {
    throw new Error('用法：pnpm release:ui [patch|minor|major] [--dry-run]，或 pnpm release:ui --no-bump [--dry-run]。');
  }
  const bump = args.includes('--no-bump') ? null : bumps[0] ?? 'patch';
  const dryRun = args.includes('--dry-run');
  let { name, version } = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf8'));
  log(`${dryRun ? '预演' : '发布'} ${name}@${version} → npm 官方源`);
  if (!dryRun) {
    let identity = run(['whoami', registry], true);
    if (identity.status !== 0) {
      const output = `${identity.stdout ?? ''}\n${identity.stderr ?? ''}`;
      if (!/E401|ENEEDAUTH|Unauthorized|need auth/i.test(output)) {
        throw new Error('无法检查 npm 登录状态，请检查网络或 npm 配置后重试。');
      }
      log('官方源登录凭据不可用，请按提示在浏览器中登录有发布权限的账号并完成验证。');
      if (run(['login', registry, '--auth-type=web']).status !== 0) throw new Error('npm 登录未完成，已停止发布。');
      identity = run(['whoami', registry], true);
      if (identity.status !== 0) throw new Error('登录后仍无法确认 npm 身份，已停止发布。');
    }
    log(`当前 npm 账号：${identity.stdout.trim()}`);
  }
  if (bump && !dryRun) {
    log(`递增 ${bump} 版本（不创建 Git 提交或标签）。`);
    const updated = run(['version', bump, '--no-git-tag-version', registry], true);
    if (updated.status !== 0) throw new Error(`版本更新失败，已停止发布。\n${updated.stderr ?? ''}`);
    version = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf8')).version;
    log(`即将发布 ${name}@${version}。`);
  } else if (bump) {
    log(`正式执行时将递增 ${bump} 版本；本次预演保留当前版本号。`);
  }
  log('执行 npm publish；prepublishOnly 将自动完成类型检查和构建，失败时停止发布。');
  const result = run(['publish', '--access=public', '--tag=latest', registry, ...(dryRun ? ['--dry-run'] : [])]);
  if (result.status !== 0) throw new Error('发布未成功，本地保留当前版本号，不会自动重试。请检查 npm 发布结果，确认未发布后使用 pnpm release:ui --no-bump 重试，避免再次递增版本。');
  log(dryRun ? '预演通过，未上传到 npm。' : `已发布 ${name}@${version}。`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { publishUi(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
