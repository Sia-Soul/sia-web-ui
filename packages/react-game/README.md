# Sia 放置游戏框架

独立包 `@sia-ui/react-game`，与主包的 `@sia.soul/sia-react-ui/game` 共享源码。源代码位于 `packages/react/src/game/`，`scripts/build-game.mjs` 生成这个独立包；不要直接修改 dist。

框架提供内容配置、战斗与成长规则、挂机与离线时钟、三栏界面、地图、装备、伙伴、首领、日志及存档组件。按钮和模态框复用 Sia Button、Modal，项目不需要定义自己的组件。

```jsx
// 业务只提供题材配置，挂载框架宿主。
import { IdleGameApp } from '@sia-ui/react-game';
import '@sia-ui/react-game/styles.css';
import { definition } from './definition';
createRoot(document.getElementById('app')).render(<IdleGameApp definition={definition} />);
```

完整内容格式、组件目录和规则边界见仓库 `docs/game-framework.md`。公开类型附中文 JSDoc，游戏入口纳入根目录 `check:api-docs` 与 `test:api-docs`。

本地执行 `node scripts/build-game.mjs` 构建，再从本目录 `npm pack` 生成本地测试包。框架版本发布由用户执行，构建与 pack 不会发布到 npm。
