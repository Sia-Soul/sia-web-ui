# Sia React UI

SiaWebUI 的 React 组件库，包含基础控件、布局、表格、编辑器和图表。

## 安装

在已有 React 项目中执行：

```powershell
pnpm add '@sia.soul/sia-react-ui'
```

项目需要提供 React 和 React DOM。包声明的 peerDependencies 为 React >=18；具体兼容性以项目实际验证为准。

## 使用

在应用入口引入一次样式：

```tsx
import '@sia.soul/sia-react-ui/styles.css';
```

在组件中使用：

```tsx
import { Button } from '@sia.soul/sia-react-ui';

export default function App() {
  return <Button>你好，SiaWebUI</Button>;
}
```

也提供 `/core`、`/select-date-range`、`/rich-text-editor`、`/markdown-editor` 和 `/chart` 子入口。子入口不会减少包管理器安装的依赖数量。

代码编辑器使用 Monaco 和 worker 导入；在接入其他构建工具时，需要验证 worker 配置。本包的组件需要浏览器环境，服务端渲染兼容性需单独验证。

第三方说明见 THIRD_PARTY_NOTICES.md。
