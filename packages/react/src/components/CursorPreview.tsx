import { useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type PointerEvent, type ReactNode } from 'react';
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
  /** 位图宽高，默认 CSS 像素，最小为 8；sizeUnit 为 device 时改用物理像素，应与帧的原始像素宽度一致。@defaultValue 48 */
  size?: number;
  /** 尺寸单位：css 随页面缩放；device 按屏幕物理像素显示并吸附像素网格，适合核对原生指针。@defaultValue 'css' */
  sizeUnit?: 'css' | 'device';
  /** 是否循环播放；false 显示第一帧。系统偏好减少动态效果时也显示第一帧。@defaultValue true */
  playing?: boolean;
  /** 移入区域后隐藏原生指针，按显示帧跟随最新鼠标热点；移出后回到中央。图片加载失败时保留原生指针；onPointerMove 仍逐事件调用。@defaultValue true */
  followPointer?: boolean;
  /** 鼠标未移入且图片有效时，用折线和“指针点”标出当前帧真实热点；移入后立即隐藏，移出恢复。不依赖 followPointer，业务可仅在正常选择角色启用。@defaultValue false */
  showHotspot?: boolean;
  /** 区域高度，数值单位为 CSS 像素；也可传 CSS 长度。@defaultValue 180 */
  height?: number | string;
  /** 未提供帧时显示的内容。@defaultValue '暂无指针预览' */
  empty?: ReactNode;
  /** 图像的无障碍说明。@defaultValue '鼠标指针预览' */
  alt?: string;
}

/** 展示指针原画、逐帧动画与热点跟随，复用 Sia 图片组件和主题令牌。 */
export function CursorPreview({ frames, size = 48, sizeUnit = 'css', playing = true, followPointer = true, showHotspot = false, height = 180, empty = '暂无指针预览', alt = '鼠标指针预览', className = '', style, children, onPointerEnter, onPointerMove, onPointerLeave, ...props }: CursorPreviewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 0, height: 0, left: 0, top: 0 });
  const [hovered, setHovered] = useState(false);
  const [index, setIndex] = useState(0);
  const [point, setPoint] = useState<{ x: number; y: number; left: number; top: number } | null>(null);
  const moveFrame = useRef(0);
  const latestPointer = useRef({ x: 0, y: 0 });
  // 退出、卸载或禁用跟随时丢弃未显示的坐标，避免下一帧又隐藏原生鼠标。
  const cancelMove = () => { if (moveFrame.current) cancelAnimationFrame(moveFrame.current); moveFrame.current = 0; };
  useEffect(() => { if (!followPointer) setPoint(null); return cancelMove; }, [followPointer]);
  const [reduced, setReduced] = useState(false);
  const [failed, setFailed] = useState(false);
  const [density, setDensity] = useState(() => typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  const scale = sizeUnit === 'device' ? density : 1;
  const safeSize = Math.max(8, Number.isFinite(size) ? size : 48) / scale;
  // 跨屏和页面缩放均可能改变像素密度；重新绑定媒体查询，避免只响应第一次变化。
  useEffect(() => {
    if (sizeUnit !== 'device') return;
    let media: MediaQueryList;
    const update = () => {
      media?.removeEventListener('change', update);
      const next = window.devicePixelRatio || 1;
      setDensity(next);
      media = window.matchMedia(`(resolution: ${next}dppx)`);
      media.addEventListener('change', update);
    };
    update(); window.addEventListener('resize', update);
    return () => { media.removeEventListener('change', update); window.removeEventListener('resize', update); };
  }, [sizeUnit]);
  const frame = frames[playing && !reduced ? index % Math.max(1, frames.length) : 0];
  // 标注以实际容器尺寸计算，随侧栏和窗口缩放重排；无需逐帧测量 DOM。
  useLayoutEffect(() => {
    const root = rootRef.current;
    if ((!showHotspot && sizeUnit !== 'device') || !root) return;
    const measure = () => {
      const rect = root.getBoundingClientRect();
      const next = { width: root.clientWidth, height: root.clientHeight, left: rect.left, top: rect.top };
      setBounds(previous => Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    window.addEventListener('scroll', measure, true);
    return () => { observer.disconnect(); window.removeEventListener('scroll', measure, true); };
  }, [showHotspot, sizeUnit, density, hovered]);
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
    // 高频输入只保留最新位置；每个显示帧最多测量一次，静态缩略图完全跳过此路径。
    if (followPointer && event.pointerType !== 'touch') {
      latestPointer.current = { x: event.clientX, y: event.clientY };
      if (!moveFrame.current) moveFrame.current = requestAnimationFrame(() => {
        moveFrame.current = 0;
        const root = rootRef.current;
        if (!root) return;
        const rect = root.getBoundingClientRect();
        setHovered(true);
        setPoint({ x: latestPointer.current.x - rect.left, y: latestPointer.current.y - rect.top, left: rect.left, top: rect.top });
      });
    } else if (event.pointerType !== 'touch' && showHotspot) setHovered(true);
    onPointerMove?.(event);
  }
  const following = !!point && followPointer && !!frame && !failed;
  const offset = (value?: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value! : 0)) * safeSize;
  // 吸附的是相对于屏幕的左上角；半像素平移也会使 1:1 位图被浏览器再次插值。
  const origin = following ? point : bounds;
  const snap = (value: number, base: number) => sizeUnit === 'device' ? Math.round((value + base) * density) / density - base : value;
  const bitmapX = snap(following ? point.x - offset(frame.hotspotX) : (bounds.width - safeSize) / 2, origin?.left ?? 0);
  const bitmapY = snap(following ? point.y - offset(frame.hotspotY) : (bounds.height - safeSize) / 2, origin?.top ?? 0);
  // 折线起点严格对应位图热点；右侧空间不足时向左引出，顶部留白不足时缩短斜线。
  const hotspotX = bitmapX + offset(frame?.hotspotX);
  const hotspotY = bitmapY + offset(frame?.hotspotY);
  const direction = bounds.width - hotspotX >= 130 ? 1 : -1;
  const lineY = Math.max(18, hotspotY - 42);
  const elbowX = hotspotX + direction * 28;
  const endX = direction === 1 ? Math.min(bounds.width - 58, hotspotX + 82) : Math.max(58, hotspotX - 82);
  return <div {...props} ref={rootRef} className={`sia-cursor-preview${following ? ' is-following' : ''} ${className}`.trim()} style={{ height, ...style }}
    onPointerEnter={event => { if (event.pointerType !== 'touch') setHovered(true); onPointerEnter?.(event); }}
    onPointerMove={move} onPointerLeave={event => { cancelMove(); setHovered(false); setPoint(null); onPointerLeave?.(event); }}>
    {frame ? <span className="sia-cursor-preview__bitmap" style={{ width: safeSize, height: safeSize, left: sizeUnit === 'device' || following ? bitmapX : '50%', top: sizeUnit === 'device' || following ? bitmapY : '50%', transform: sizeUnit === 'device' || following ? undefined : 'translate(-50%, -50%)' }}>
      <Image src={frame.src} width={safeSize} height={safeSize} alt={alt} preview={false} draggable={false} onLoad={() => setFailed(false)} onError={() => setFailed(true)}/>
    </span> : <span className="sia-cursor-preview__empty">{empty}</span>}
    {showHotspot && !hovered && frame && !failed && bounds.width > 0 ? <svg className="sia-cursor-preview__hotspot" width="100%" height="100%" role="img" aria-label="指针点：鼠标点击的实际位置">
      <polyline points={`${hotspotX},${hotspotY} ${elbowX},${lineY} ${endX},${lineY}`}/>
      <circle cx={hotspotX} cy={hotspotY} r={2.5}/>
      <text x={endX + direction * 8} y={lineY} textAnchor={direction === 1 ? 'start' : 'end'} dominantBaseline="central">指针点</text>
    </svg> : null}
    {children ? <div className="sia-cursor-preview__caption">{children}</div> : null}
  </div>;
}
