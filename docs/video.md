# Video 视频展示

从 `@sia.soul/sia-react-ui` 引入 `Video` 和 `VideoProps`。组件默认显示播放控制栏、在页面内播放，不默认静音；宽度随容器变化，完整显示画面，表面色与圆角继承框架主题。

```tsx
import { Video } from "@sia.soul/sia-react-ui";

// 普通视频支持原生媒体属性、播放事件和封面。
<Video src="/demo.mp4" poster="/cover.jpg" aria-label="演示视频" />;
```

窗口共享预览可传入 `ref`、`muted` 和 `controls={false}`。ref 指向真实的 `HTMLVideoElement`，调用方可设置 `srcObject`、调用 `play()` 并读取视频尺寸供画布采样。组件不申请媒体权限，不停止外部流；调用方必须处理播放失败，并在停止或卸载时释放轨道、清空 `srcObject`。

可通过 `className` 或 `style` 调整最大高度、背景及圆角。默认样式不裁剪画面。
