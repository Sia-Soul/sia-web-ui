# Sia Web UI

Sia Web UI 是 SiaUI 的 Web 端设计系统与项目母版。它把客户端已有的品牌、设计令牌和组件语义带到 React，同时提供可发布组件包、交互式文档和项目生成器，让后续项目从同一套基础开始。

## 仓库结构

```text
apps/docs/                  组件文档与交互预览
apps/desktop/               Tauri 2 + React 桌面客户端
apps/database-studio/       数据库连接与 SQL 工作台
apps/browser/               无边框 Tauri 浏览器
apps/disk-space/            实时磁盘空间探测器
apps/notepad/               多标签、自动保存的轻量记事本
packages/react/             @sia-ui/react 组件包
packages/create-sia-web/    create-sia-web 项目生成器
docs/design/                Web 端视觉基准
```

## 本地开发

```powershell
pnpm install
pnpm dev
```

启动桌面客户端：

```powershell
pnpm desktop:dev
```

只在浏览器中预览客户端界面：

```powershell
pnpm desktop:web
```

启动数据库工作台：

```powershell
pnpm database:dev
```

只在浏览器中预览数据库工作台（使用演示数据）：

```powershell
pnpm database:web
```

启动无边框浏览器：

```powershell
pnpm browser:dev
```

只预览浏览器外壳（真实网页需要 Tauri 子 WebView）：

```powershell
pnpm browser:web
```

启动磁盘空间探测器：

```powershell
pnpm disk:dev
```

只在浏览器中预览磁盘空间探测器（使用增量演示数据）：

```powershell
pnpm disk:web
```

启动轻量记事本：

```powershell
pnpm notepad:dev
```

只在浏览器中预览记事本（数据保存在浏览器本地）：

```powershell
pnpm notepad:web
```

生成可直接运行的桌面程序：

```powershell
pnpm desktop:build
```

生成浏览器桌面程序：

```powershell
pnpm browser:build
```

生成 MSI/NSIS 等平台安装包（需要能够下载平台打包工具）：

```powershell
pnpm desktop:bundle
```

构建与类型检查：

```powershell
pnpm check
```

生成一个新项目：

```powershell
pnpm create:sia my-sia-app
cd my-sia-app
pnpm install
pnpm dev
```

## 设计基线

- 主色：`#1677ff`，悬停 `#4096ff`，激活 `#0958d9`
- 控件高度：32px；圆角：6px；基准间距：16px
- 正文与控件：16px；辅助文字：14px；大号文字：18px
- 亮色背景：`#f5f7fa`；表面：`#ffffff`
- 所有主题值通过 `--sia-*` CSS 变量暴露，组件禁止写死品牌颜色

## 图标

常用图标采用 24×24 视图和圆角描边，可按名称调用：

```tsx
import { Icon } from "@sia-ui/react";

<Icon name="search" />
<Icon name="settings" size={20} />
<Icon name="loader" spin label="正在加载" />
<Icon name="arrow-right" rotate={45} />
```

图标组件支持 `size`、`strokeWidth`、`rotate`、`spin`、`pulse` 和无障碍 `label`。语义与分类参考 Ant Design Icons，SVG 路径已按 Sia 的柔和圆角风格重新绘制；许可证说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

详细分层和扩展规则见 [架构说明](docs/architecture.md)。
