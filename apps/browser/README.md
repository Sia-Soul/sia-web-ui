# Sia Browser

Sia Browser 是基于 Sia WebUI 与 Tauri 2 的桌面浏览器原型。

## 结构

- React 与 `@sia.soul/sia-react-ui` 负责无边框窗体、标签栏、地址栏、书签栏和新标签页。
- Tauri 主窗口关闭系统标题栏，由标签栏承担拖动和双击最大化。
- 每个真实网页标签使用独立的 Tauri 子 WebView，避免普通 `iframe` 的跨域和 `X-Frame-Options` 限制。
- 远程网页不在 capability 中，不能调用浏览器外壳的 Tauri IPC。

## 运行

```powershell
pnpm browser:dev
```

仅查看界面：

```powershell
pnpm browser:web
```

## 首版能力

- 无边框窗口和自绘最小化、最大化、关闭按钮
- 多标签页创建、切换与关闭
- 横向标签溢出列表与鼠标滚轮横向滚动
- 横向、垂直两种标签布局
- 垂直模式下的“分组 / 小分组 / 标签”树型结构
- 分组级 WebView2 数据目录，不同分组之间隔离 Cookie
- 地址识别、Bing 搜索、后退、前进、刷新、停止和主页
- 标题及地址随网页导航同步
- `window.open` 请求转为新标签页
- 书签栏、亮暗主题和 Web 预览占位

动态新增或重命名分组、下载管理、历史记录、隐私模式、网站权限、崩溃恢复和自动更新留到后续阶段。
