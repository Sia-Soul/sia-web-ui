# 表头全选开关

<!-- 表头入口与行选择独立控制，不通过样式隐藏内部元素。 -->

`createSelectionPlugin({ mode: "multiple", showSelectAll: false })` 隐藏表头全选复选框，保留选择列及每行复选框。`showSelectAll` 默认 `true`，只作用于多选模式；切换开关不会清空已选项，也不会改变选择 API 的行为。单选与行选择模式不显示全选框。

分类名称及完整路径需要两行展示时，可配合 `Table` 的 `striped={false}`、`rowHeight={60}` 关闭隔行背景并增加行内空间。

浏览器回归入口：`apps/docs/tests/table-select-all.html`。文档服务端口 4189 时执行 `node scripts/test-table-select-all.cjs [Playwright模块路径]`。
