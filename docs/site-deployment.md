# 官网首页与文档站部署

首页位于 `/`，组件文档仍位于 `/components/*`，设计令牌位于 `/design/tokens`。首页不展开完整组件目录，访客通过顶部组件文档入口访问；概览中的文档入口数量仍从导航自动统计。

## 构建与上传

在仓库根目录执行：

```sh
pnpm --filter @sia-ui/docs build
```

将 `apps/docs/dist` 中的全部文件上传到站点静态目录。本配置默认部署到域名根路径；部署到子目录时，需要同时配置 Vite `base` 和 React Router 的 `basename`，不能只移动目录。

## 路由回退

当前站点使用浏览器历史路由。服务器必须让非静态资源路径回退到 `index.html`，否则刷新组件文档时会出现 404。

Nginx 示例（放入对应站点的 server 配置）：

```nginx
# 保留真实静态文件；其余请求交给前端路由。
location / {
    try_files $uri $uri/ /index.html;
}
```

发布后检查：首页访问、组件页面直接访问和刷新、深浅主题切换、安装命令复制。剪贴板功能需要 HTTPS 或 localhost 安全上下文。

## 当前范围与注意事项

- 首页复用框架自己的 Input、Select、Table、Tag、Button、Icon 和 ThemeSwitch；示例项目为虚构展示数据。
- 安装示例使用 `@sia.soul/sia-react-ui`，发布前请确认 npm 上的目标版本已由维护者发布。
- 文档站包含编辑器、图表等大型演示依赖，当前构建存在大分包警告；生产发布建议进一步拆分文档路由并验证首屏加载性能。
- 本次仅准备本地页面与构建产物，不执行域名配置、站点部署或 npm 发布。
