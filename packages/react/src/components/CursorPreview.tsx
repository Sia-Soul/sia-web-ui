import { useEffect, useState, type HTMLAttributes, type PointerEvent, type ReactNode } from 'react';
import { Image } from './DataDisplay';
import './cursor-preview.css';

/** 指针预览中的单帧位图、显示时间与点击热点；数据由业务解析 CUR 或 ANI 后提供。 */
export interface CursorPreviewFrame {
  /** 可被浏览器读取的位图 URL，支持 data URL；不执行资源中的脚本。 */
  src: string;
  /** 本帧显示时长，单位毫秒；小于 16 时按 16 处理。@defaultValue 100 */
  duration?: number;
  /** 热点在图像宽度中的归一化横坐标，0 表示最左，1 表示最右；越界时限制到 0～1。@defaultValue 0 */
  hotspotX?: number;
  /** 热点在图像高度中的归一化纵坐标，0 表示最上，1 表示最下；越界时限制到 0～1。@defaultValue 0 */
  hotspotY?: number;
}

/** 指针位图预览属性；只影响组件内部显示，不修改操作系统鼠标。 */
export interface CursorPreviewProps extends HTMLAttributes<HTMLDivElement> {
  /** 按播放顺序排列的帧；空数组显示 empty 内容。更新资源后重新从第一帧播放。 */
  frames: readonly CursorPreviewFrame[];
  /** 位图宽高，单位 CSS 像素，最小为 8；受浏览器缩放影响。@defaultValue 48 */
  size?: number;
  /** 是否循环播放；false 显示第一帧。系统偏好减少动态效果时也显示第一帧。@defaultValue true */
  playing?: boolean;
  /** 移入区域后隐藏原生指针，并按热点跟随鼠标位置；移出后回到中央。图片加载失败时保留原生指针。@defaultValue true */
  followPointer?: boolean;
  /** 区域高度，数值单位为 CSS 像素；也可传 CSS 长度。@defaultValue 180 */
  height?: number | string;
  /** 未提供帧时显示的内容。@defaultValue '暂无指针预览' */
  empty?: ReactNode;
  /** 图像的无障碍说明。@defaultValue '鼠标指针预览' */
  alt?: string;
}

/** 展示指针原画、逐帧动画与热点跟随，复用 Sia 图片组件和主题令牌。 */
export function CursorPreview({ frames, size = 48, playing = true, followPointer = true, height = 180, empty = '暂无指针预览', alt = '鼠标指针预览', className = '', style, children, onPointerMove, onPointerLeave, ...props }: CursorPreviewProps) {
  const [index, setIndex] = useState(0);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [reduced, setReduced] = useState(false);
  const [failed, setFailed] = useState(false);
  const safeSize = Math.max(8, Number.isFinite(size) ? size : 48);
  const frame = frames[playing && !reduced ? index % Math.max(1, frames.length) : 0];
  useEffect(() => { setIndex(0); }, [frames]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!playing || reduced || frames.length < 2) return;
    const duration = Number.isFinite(frame?.duration) ? frame!.duration! : 100;
    const timer = window.setTimeout(() => setIndex(value => (value + 1) % frames.length), Math.max(16, duration));
    return () => window.clearTimeout(timer);
  }, [playing, reduced, frames, index, frame]);
  function move(event: PointerEvent<HTMLDivElement>) {
    // 使用边框盒内的 CSS 坐标，确保页面滚动和浏览器缩放后热点仍然对齐。
    const rect = event.currentTarget.getBoundingClientRect();
    if (followPointer && event.pointerType !== 'touch') setPoint({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    onPointerMove?.(event);
  }
  const following = !!point && followPointer && !!frame && !failed;
  const offset = (value?: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value! : 0)) * safeSize;
  return <div {...props} className={`sia-cursor-preview${following ? ' is-following' : ''} ${className}`.trim()} style={{ height, ...style }} onPointerMove={move} onPointerLeave={event => { setPoint(null); onPointerLeave?.(event); }}>
    {frame ? <span className="sia-cursor-preview__bitmap" style={{ width: safeSize, height: safeSize, left: following ? point.x - offset(frame.hotspotX) : '50%', top: following ? point.y - offset(frame.hotspotY) : '50%', transform: following ? undefined : 'translate(-50%, -50%)' }}>
      <Image src={frame.src} width={safeSize} height={safeSize} alt={alt} preview={false} draggable={false} onLoad={() => setFailed(false)} onError={() => setFailed(true)}/>
    </span> : <span className="sia-cursor-preview__empty">{empty}</span>}
    {children ? <div className="sia-cursor-preview__caption">{children}</div> : null}
  </div>;
}
