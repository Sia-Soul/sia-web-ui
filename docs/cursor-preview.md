# 指针预览 CursorPreview

此组件展示业务提供的 PNG 等位图，不生成指针图案，也不修改操作系统设置。
动画帧应由业务读取 ANI 后传入，`duration` 单位为毫秒，默认 100。
热点使用图像尺寸的归一化坐标，例如 64 像素宽图像的第 8 像素为 `8 / 64`。

```tsx
import { CursorPreview } from '@sia.soul/sia-react-ui';

// frames 应保留稳定引用；资源变化时动画自动回到第一帧。
const frames = [{ src: '/cursor.png', duration: 100, hotspotX: 8 / 64, hotspotY: 2 / 64 }];
<CursorPreview frames={frames} size={48} height={200}>
  移入试用区查看指针和热点
</CursorPreview>;
```

`followPointer=false` 只在中央展示，适合主题列表中的缩略预览。
`playing=false` 或系统偏好减少动态效果时显示第一帧。
没有帧时展示 `empty`，默认文案为“暂无指针预览”。
颜色、圆角和文字采用已有 `--sia-*` 令牌，没有新增主题变量。
尺寸为 CSS 像素；原生系统指针的物理像素大小由宿主程序另行控制。
