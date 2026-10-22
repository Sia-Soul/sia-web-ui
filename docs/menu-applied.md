# 菜单图片与当前生效标记

`Menu mode="grid"` 提供双列圆角卡片：图标居上、名称居下，长名称可以换行。卡片高度至少 108px，列间距为 8px；容器可滚动时保持双列。分组与分隔线跨两列，子菜单沿用弹层交互。默认 `mode="vertical"` 的列表排列不变。

`MenuItem.iconSize` 设置图标槽的正方形尺寸，单位 px；省略时沿用 `--sia-menu-icon-size`（默认 16px）。图片图标同时设置 Image 的宽高与 iconSize，例如均为 28，保留原始宽高比例。

`MenuItem.applied` 默认为 false。为 true 时，在菜单项右侧显示92%不透明度的主题色实心圆形标记，内部为白色勾选图案，浅色与深色主题下均保持清晰。网格模式显示在卡片右上角。`appliedLabel` 默认为“当前使用”，提供无障碍说明。标记不拦截点击，独立于 `selectedKeys`：浏览其他项不会改变生效状态，应由业务确认应用成功后更新。

网格模式把生效水印放在卡片右上角；浏览选中仍使用主题选中背景，两种状态独立。

```tsx
// 框架只呈现状态；实际生效项由宿主读取系统设置决定。
<Menu mode="grid" selectedKeys={[previewKey]} items={themes.map(theme => ({
  key: theme.id, label: theme.name, iconSize: 44,
  icon: <Image src={theme.image} width={44} height={44} preview={false}/>,
  applied: theme.id === appliedKey,
}))}/>
```

## 可配置列数

`autoScrollSelected` 默认 `false`。对自身可纵向滚动的 Menu 设置为 `true` 后，首次渲染、异步项目加载以及第一个选中标识改变时，会将该项目滚动至可见范围；项目已完整可见时不滚动，否则尽量居中。只调整 Menu 自身，不滚动外层页面或移动键盘焦点，也不自动展开子菜单。成功定位后，相同选中项的普通重渲染不会覆盖用户手动滚动位置。水平菜单不使用此行为。

`gridColumns` 默认 2。传入正整数可指定列数，例如 `gridColumns={3}`；传入 `"auto"` 时，每列最少 88px，随容器宽度自动增减列数，适合放在 `Splitter.Panel` 内。

`--sia-menu-grid-columns` 控制根菜单与分组的 CSS 列轨道定义，无单位；默认 `repeat(2, minmax(0, 1fr))`。`gridColumns` 会设置行内变量，优先于继承值；调用方 `style` 中的同名变量优先级最高。该变量只影响 grid 模式。
