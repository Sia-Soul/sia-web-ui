# @sia-ui/react-business

面向现有业务系统的 SiaWebUI 组件包。入口为 `../react/src/business.ts`，所有组件共用 `@sia.soul/sia-react-ui` 的源码，不复制组件实现。

此入口仅包含业务基础组件、表格与反馈组件，不包含编辑器、图表及其第三方运行时依赖。React 和 React DOM 以 peer dependency 引用，最低版本为 18。

在 SiaWebUI 根目录构建：

```powershell
pnpm build:business
```

构建产物位于本目录的 `dist`，包含 ESM、CommonJS、类型声明和独立 CSS。业务项目必须同时导入：

```tsx
import { Button } from '@sia-ui/react-business';
import '@sia-ui/react-business/styles.css';
```

在本目录运行 `pnpm pack --pack-destination <目标目录>` 可生成固定版本依赖包。已交付版本不应覆盖，更新时应同时递增本包版本并更新消费项目锁文件。
