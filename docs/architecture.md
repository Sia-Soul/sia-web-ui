# 架构说明

## 分层

1. **设计令牌**：颜色、间距、字号、圆角、阴影和动效统一定义在 `@sia.soul/sia-react-ui` 的 CSS 变量中。
2. **基础组件**：Button、Input、Switch、Tag、Card、Alert、Divider、Space 等只依赖令牌，不依赖业务代码。
3. **文档应用**：既是组件手册，也是主题、状态与响应式行为的验收环境。
4. **项目生成器**：复制最小 Vite + React + TypeScript 项目，默认接入相同组件与样式入口。

## 组件扩展约定

- **组件库优先是硬性规则**：`apps/*` 业务应用只能组合 `@sia.soul/sia-react-ui` 的公开组件，不得在业务目录中自行实现可复用 UI 控件，也不得用原生表单元素配合业务 CSS 仿造组件。
- 业务开发发现缺失控件时，必须先在 `packages/react` 中实现组件、状态样式和 TypeScript 类型，通过 `src/index.ts` 导出，并在 `apps/docs` 增加示例与 API 文档；完成后业务应用才能引用。
- 业务应用只负责页面编排、领域数据和流程状态。仅在不构成 UI 控件或可复用视觉模式时使用语义 HTML；一旦出现重复交互或视觉模式，应上提为组件库组件。
- 公共属性优先复用原生 HTML 属性，避免重新发明事件和无障碍语义。
- 视觉差异用 `variant`、`size`、`status` 等有限枚举表达，不允许业务项目复制组件 CSS 后二次修改。
- 组件颜色只引用语义令牌，如 `--sia-color-primary`、`--sia-color-text-secondary`。
- 新组件必须覆盖 hover、active、focus-visible、disabled 和暗色主题。
- 对话框、下拉菜单等复杂交互后续优先基于无样式可访问原语实现，视觉仍由 Sia 令牌控制。

## 发布建议

- `@sia.soul/sia-react-ui` 与 `create-sia-web` 独立版本发布。
- 使用 Changesets 管理版本与变更日志。
- 在 CI 中固定执行 `pnpm check`，后续增加 Vitest、Playwright 与视觉回归基线。
- 业务模板只依赖公开 API，禁止从 `src/` 深层导入。
