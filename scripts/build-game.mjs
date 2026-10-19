// 独立游戏包与主包共享同一源码，产物包含所需 Sia 基础组件，React 保持 peer dependency。
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const result=spawnSync(process.platform==='win32'?'pnpm.cmd':'pnpm',['exec','tsup','src/game.ts','--format','esm,cjs','--dts','--out-dir','../react-game/dist','--clean'],{cwd:resolve(root,'packages/react'),stdio:'inherit',shell:process.platform==='win32'});
process.exit(result.status??1);
