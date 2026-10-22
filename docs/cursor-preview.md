# 指针预览 CursorPreview

此组件展示业务提供的 PNG 等位图，不生成指针图案，也不修改操作系统设置。
动画帧应由业务读取 ANI 后传入，`duration` 单位为毫秒，默认 100。
热点使用图像尺寸的归一化坐标，例如 64 像素宽图像的第 8 像素为 `8 / 64`。

```tsx
import { CursorPreview } from '@sia.soul/sia-react-ui';

// frames 应保留稳定引用；资源变化时动画自动回到第一帧。
const frames = [{ src: '/cursor.png', duration: 100, hotspotX: 8 / 64, hotspotY: 2 / 64 }];
<CursorPreview frames={frames} size={48} height={200} showHotspot>
  移入试用区查看指针和热点
</CursorPreview>;
```

`followPointer=false` 只在中央展示，适合主题列表中的缩略预览。
跟随位置每个显示帧最多更新一次，采用该帧收到的最后一个坐标；`onPointerMove` 仍逐事件调用。静态缩略图不在移动时测量位置。移出或卸载时取消待处理的跟随任务，避免原生指针被再次隐藏。
`playing=false` 或系统偏好减少动态效果时显示第一帧。
`showHotspot=false` 为默认值；设为 true 时，鼠标未移入且图片有效时显示青色折线与“指针点”文字。
折线起点取当前帧的 `hotspotX`、`hotspotY`，随 `size`、帧和容器尺寸更新；右侧空间不足时向左引出。
移入时立即隐藏，移出后恢复；该规则独立于 `followPointer`。业务可传 `showHotspot={role === 'Arrow'}`，仅为正常选择角色开启。
空帧和加载失败时不显示标注，标注不拦截指针事件。暗色主题使用更亮的青线和金色文字。
底层 `Image.onLoad` 会在占位状态更新后透传加载事件；图片重新成功加载时，预览退出失败状态并恢复热点说明。
没有帧时展示 `empty`，默认文案为“暂无指针预览”。
区域背景、圆角和说明文字采用已有 `--sia-*` 令牌；热点标注使用适配明暗主题的青色和金色，没有新增主题变量。
尺寸默认采用 CSS 像素。核对原生指针时使用 `sizeUnit="device"`，并让 `size` 与输入帧像素宽度一致，例如 96×96 PNG 对应 `size={96}`。此模式按屏幕物理像素显示，跟随 Windows 显示缩放、浏览器缩放及跨屏像素密度变化；位图位置吸附物理像素网格，热点标注同步更新。150% 缩放下 96px 指针占 64 CSS px，仍对应 96 个屏幕像素。

```tsx
// 真实尺寸检查使用物理像素，普通列表缩略图仍可沿用默认 CSS 尺寸。
<CursorPreview frames={frames96} size={96} sizeUnit="device" showHotspot />;
```
