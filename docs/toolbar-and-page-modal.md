# 单行工具栏与页面弹框

`Toolbar` 从 `@sia.soul/sia-react-ui` 或 `/core` 导出。默认使用 small、link 按钮；容器宽度不足时，尾部操作自动进入 hover 展开的省略菜单，变宽后自动恢复。页面无需测量按钮或覆盖框架内部样式。

```tsx
createToolbarPlugin({
  start: <Toolbar items={[
    { key: 'create', label: '新增' },
    { key: 'enable', label: '批量启用', split: true,
      children: [{ key: 'disable', label: '批量禁用' }] },
  ]} onAction={runAction} />,
});
```

权限判断和请求状态属于调用方：使用 `hidden`、`disabled`、`loading` 控制操作。`onAction` 收到原始 key，在可见按钮、下拉菜单和溢出菜单中行为一致。禁用父项时，其下级操作也不可执行。

`Modal` 和 `Modal.open` 支持 `height`（数字为像素或 CSS 长度）。设置后，标题与页脚保持可见，正文占剩余高度并滚动，整体不超出视口。嵌入表格页面时，页面使用纵向 Flex 和剩余高度表格即可；业务页面仍由应用维护。

```tsx
Modal.open({ title: '查看日志', width: '80%', height: '80vh', footer: null,
  children: <OperationLogPage /> });
```

`Form.Item` 直接绑定 `Select` 时，未选择产生的空字符串不会成为幽灵选项；数值 `0` 和明确配置的空字符串选项仍是有效选项。无需在页面重复传递 value/onChange。
