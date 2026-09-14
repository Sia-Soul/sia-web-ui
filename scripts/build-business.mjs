import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', [
  'exec', 'tsup', 'src/business.ts', '--format', 'esm,cjs', '--dts',
  '--out-dir', '../react-business/dist',
], { cwd: resolve(root, 'packages/react'), stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(result.status ?? 1);
