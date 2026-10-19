# 菜单图片与当前生效标记

`MenuItem.iconSize` 设置图标槽的正方形尺寸，单位 px；省略时沿用 `--sia-menu-icon-size`（默认 16px）。图片图标同时设置 Image 的宽高与 iconSize，例如均为 28，保留原始宽高比例。

`MenuItem.applied` 默认为 false。为 true 时，在菜单项右侧显示透明度 18% 的勾选背景水印。`appliedLabel` 默认为“当前使用”，提供无障碍说明。水印不拦截点击，独立于 `selectedKeys`：浏览其他项不会改变生效状态，应由业务确认应用成功后更新。

```tsx
// 框架只呈现状态；实际生效项由宿主读取系统设置决定。
<Menu selectedKeys={[previewKey]} items={themes.map(theme => ({
  key: theme.id, label: theme.name, iconSize: 28,
  icon: <Image src={theme.image} width={28} height={28} preview={false}/>,
  applied: theme.id === appliedKey,
}))}/>
```
