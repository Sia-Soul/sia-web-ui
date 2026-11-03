import { forwardRef } from "react";
import type { VideoHTMLAttributes } from "react";
import "./Video.css";

/** 视频展示组件的属性；继承视频地址、封面、媒体事件和无障碍属性。 */
export interface VideoProps extends VideoHTMLAttributes<HTMLVideoElement> {
  /** 是否显示浏览器播放控制栏，默认 true；窗口采集预览可设为 false。 */
  controls?: boolean;
  /** 是否静音，默认 false；自动播放的采集预览建议设为 true。 */
  muted?: boolean;
  /** 是否在页面内播放，默认 true，避免移动设备自动进入全屏播放器。 */
  playsInline?: boolean;
}

/**
 * 视频展示，默认占容器宽度并完整显示画面，沿用框架表面色和圆角。
 * ref 指向 HTMLVideoElement，可赋值 srcObject 接入 MediaStream；
 * 调用方负责捕获授权、处理 play() 拒绝及停止媒体轨道，组件不申请摄像头或屏幕权限。
 */
export const Video = forwardRef<HTMLVideoElement, VideoProps>(function Video(
  { controls = true, muted = false, playsInline = true, className = "", ...props },
  ref,
) {
  return <video {...props} ref={ref} controls={controls} muted={muted} playsInline={playsInline} className={`sia-video ${className}`.trim()} />;
});
