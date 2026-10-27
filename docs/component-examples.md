# 组件属性样例维护

文档站的「开始 → 组件属性样例」提供属性索引与补充交互样例，地址为 `/components/property-examples`。现有组件页标题下也提供入口，并携带组件名称。

## 查找与运行

- 选择组件或子组件，按属性名筛选，查看真实 JSX 所在文件和行号。
- 「查看源码」读取对应源文件；「查看演示」切换到包含该属性的补充交互分组。
- 补充样例分为基础布局、导航、操作结果、反馈、选择、日期、展示、光标与图片预览、游戏框架、表单、浮层、编辑器、上传、图表、图表基础图层和数据转移 16 组。每次挂载一组；图表组通过选择器查看各类图表，游戏组按需加载游戏入口和皮肤。
- 预览与复制代码使用同一份 TSX 文件。受控值配套状态更新，事件结果显示在样例内；默认值使用独立实例，避免被受控值覆盖。
- 可使用 `?component=TreeSelect` 或 `?group=SelectionExamples` 分享入口。

光标与图片预览组（`?group=MediaExamples`）提供帧播放、跟随指针、热点标注、物理像素与空态切换，同时展示自动图片分组和 `current / count / onCurrentChange` 受控切图。位图复用仓库内的应用图标，放在 `public/examples/`，不依赖外部图片服务。

游戏组（`?group=GameExamples`）可在完整 `IdleGameApp` 与受控面板之间切换。受控模式使用真实引擎，提供逐回合推进、挂机与暂停、装备比较、伙伴和能力配置、存档导出与导入确认；状态只保存在内存中。完整宿主使用独立文档存档键 `sia-docs-property-examples-game-v1`，自动保存到本地，关闭离线收益。切换模式会卸载旧宿主并清理时钟。示例贴图用于展示接口，正式项目应替换为自己的 PNG/WebP 角色与场景。

导航组可用“定位首项／末项”观察网格菜单自身滚动；展示组可切换窗口文字是否可选；表单组演示有界容器中的 `fill`；上传组可切换 `acceptMode`，比较严格校验与仅提示系统文件选择器的行为。

## 覆盖检查

```sh
# 修改样例或组件属性后，更新属性位置索引
pnpm generate:component-examples

# 检查缺项和索引是否过期，不修改文件
pnpm check:component-examples

# 验证注释、样例类型和文档构建
pnpm check:api-docs
pnpm --filter @sia-ui/docs typecheck
pnpm --filter @sia-ui/docs build
```

`pnpm check` 已包含属性样例检查。检查脚本从组件包的发布清单发现全部类型入口，通过 TypeScript 解析公开组件和静态子组件，核对自有属性及继承自框架的属性。React / DOM 上游继承属性不逐个重复计数。

只统计文档样例中的实际 JSX 属性、子内容及可解析的显式展开对象。文档外壳、导航、属性索引页面、API 表和代码字符串不计作样例；仅有 `Partial<Props>` 类型标注也不能填补缺项。新增源码入口缺失或生成索引过期时检查失败。

静态覆盖表示属性有使用位置，不代表所有枚举值、嵌套配置字段、属性组合与异常路径都已验证。新增复杂配置时仍需人工检查运行效果、可触发条件、回调结果和复制代码的完整性。

## 浏览器检查

```sh
pnpm --filter @sia-ui/docs dev --port 4197 --strictPort
node scripts/test-component-examples-browser.cjs <Playwright包路径> http://127.0.0.1:4197

# 深入验证本轮补充交互；参数与全分组回归一致
node scripts/test-component-examples-supplement-browser.cjs <Playwright包路径> http://127.0.0.1:4197
```

使用与 Playwright 版本兼容的 Node.js。两个脚本默认使用独立的无头 Edge，也可在服务地址之后传入浏览器可执行文件路径。全分组回归挂载全部 16 组、切换 24 种图表、验证动态表单和弹框操作，并核验属性筛选及源码读取；发现页面异常立即失败。

补充回归检查光标空态、图片加载事件、自动分组与受控切图、菜单定位、填充表单提交、全部游戏面板、装备比较、存档下载与导入、无效存档反馈、完整宿主的挂机与暂停回调。截图写入 `logs/component-examples/`，供人工检查布局。静态覆盖与浏览器检查都通过后，再更新维护结论。

上传示例关闭自动上传，仅选择和校验本地文件。`request.action` 是业务接入占位地址，启用实际上传前需要替换；地图宿主样例使用本地投影，不依赖第三方地图密钥。Markdown 编辑器的空 `assetBaseUrl` 使用内置资源，私有资源部署可替换为包含 `dist/index.min.js` 的根地址。
