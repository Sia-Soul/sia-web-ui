# 整卡执行操作

<!-- 业务页面使用公开动作入口，键盘、焦点与鼠标外观由框架提供。 -->

只执行下钻或打开详情、不切换选中的卡片使用 `onAction`：

```tsx
<Card title="订单统计" onAction={() => openDetails(record)}>
  统计内容
</Card>
```

提供 `onAction` 后，卡片具备按钮语义，可以通过点击非交互区域、Enter 或空格触发一次动作。内部按钮、链接、输入控件独立操作；`disabled` 禁用整卡动作，保留内部独立操作。无需业务页面添加 `role`、`tabIndex`、键盘回调或鼠标样式。

`selectable` 优先于 `onAction`；同时提供时保持原有选择行为，不执行动作。原有 `onClick` / `onKeyDown` 回调仍保留，调用 `preventDefault` 可阻止卡片默认行为。

## 填充页面剩余高度

表格等需要占满卡片正文时使用 `<Card fill>`，父容器提供确定高度或弹性空间。框架保持标题高度，正文填充剩余空间，无需页面通过 `bodyStyle` 重写内部弹性布局。显式 `bodyHeight` 优先，未设置 `fill` 时沿用内容撑高。
