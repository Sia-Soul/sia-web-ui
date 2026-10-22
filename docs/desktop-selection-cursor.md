# 桌面列表的指针形状

`Menu` 和 `Card` 提供 `interactionCursor="default"`，适合希望在列表卡片及间隙之间保持普通系统指针的桌面应用。默认值为 `pointer`，继续使用系统链接选择指针。

```tsx
// 选择列表沿用普通指针；选中状态、悬停高亮与键盘操作保持原有行为。
<Menu mode="grid" interactionCursor="default" items={items} />
<Card selectable interactionCursor="default">角色预览</Card>
```

Menu 的配置传递到分组和子菜单，包括 Portal 子菜单；独立嵌套 Menu 使用自身配置。Card 仅在 selectable 或 onAction 场景使用该属性，内部按钮、链接及输入控件仍按各自的样式选择指针。该属性不加载或修改系统指针文件，不改变点击回调、焦点和禁用语义。
