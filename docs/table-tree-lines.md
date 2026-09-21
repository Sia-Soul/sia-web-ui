# 树形表格连接线

<!-- 商品分类等多层级选择场景统一使用框架连线，不在业务页面绘制内部样式。 -->

`createTreePlugin` 新增 `showLine?: boolean`，默认 `false`。设置 `ignoreChildrenColumn: false` 后按 `children` 构建树形行，开启 `showLine` 即可显示连接线。

```tsx
const plugins = [createTreePlugin({
  ignoreChildrenColumn: false,
  defaultExpandAllRows: true,
  showLine: true,
})];
```

连线跟随行高，区分祖先仍有后续兄弟的分支与当前末尾分支；每个虚拟行独立绘制，滚动后不依赖上方节点仍然挂载。开启连接线的首个业务列不使用省略裁剪，以免截断纵向连接线。默认关闭时保留原有缩进显示。

选择行为由 `createSelectionPlugin` 独立控制。开启连接线不会引入父子勾选联动，也不会传播禁选状态。

商品分类业务接入时，应将接口的分类父子关系转换为 `children`，移除业务单元格的手工缩进。异步加载后由业务传入 `expandedRowKeys`，避免仅初始化时展开而遗漏后加载的节点。仅禁用其他吊牌直接占用的分类，保留取消不回填、确认才保存草稿的规则。

此能力尚未发布，品牌方当前依赖 0.1.53 不支持。发布含本改动的新版本后，再升级品牌方依赖并完成实际页面接入及验收。

浏览器测试入口为 `apps/docs/tests/table-tree-lines.html`。文档服务运行于 4189 时执行 `node scripts/test-table-tree-lines.cjs`，第一个参数可以指定 Playwright 模块路径。
