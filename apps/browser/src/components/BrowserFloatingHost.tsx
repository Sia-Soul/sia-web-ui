import { cloneElement, useEffect, useLayoutEffect, useRef } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { FloatingScrollbarProvider, applySiaTheme } from "@sia.soul/sia-react-ui";
import type { BrowserMenuPayload } from "./BrowserMenuWindow";

/** 原生窗口内可交互的真实表面；框架级联菜单通过 Portal 渲染，也参与统一命中。 */
const surfaceSelector = '[data-browser-floating-surface], .sia-menu__popup.is-open';

/** 六类业务面板共用的原生浮层宿主；统一主题、根定位、浮动滚动条及就绪后的表面回传。 */
export default function BrowserFloatingHost({ payload, children }: {
  /** 当前原生显示批次及根面板尺寸，进度更新不改变显示批次。 */
  payload: BrowserMenuPayload;
  /** 已有业务面板的根元素；保留其内容与交互，只补充共同的承载属性。 */
  children: ReactElement<{ style?: CSSProperties }>;
}) {
  const sequence = useRef(0);
  useLayoutEffect(() => { applySiaTheme(payload.darkMode ? 'dark' : 'light'); }, [payload.darkMode]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest(`${surfaceSelector}, .sia-floating-scrollbar`)) {
        void window.__TAURI__?.core.invoke('close_browser_menu').catch(() => undefined);
      }
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

  useLayoutEffect(() => {
    const revision = payload.hitRegionRevision;
    if (revision === undefined) return;
    let frame = 0;
    let previous = '';
    const observed = new Set<HTMLElement>();
    const resize = new ResizeObserver(() => schedule());
    const report = () => {
      frame = 0;
      const surfaces = new Set(document.querySelectorAll<HTMLElement>(surfaceSelector));
      // 子菜单关闭后解除尺寸监听，避免长期复用窗口时累积已卸载节点。
      for (const node of observed) if (!surfaces.has(node)) { resize.unobserve(node); observed.delete(node); }
      const regions = [...surfaces].flatMap(node => {
        if (!observed.has(node)) { resize.observe(node); observed.add(node); }
        const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
        if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') return [];
        return [{ x: rect.x, y: rect.y, width: rect.width, height: rect.height, radius: parseFloat(style.borderTopLeftRadius) || 0 }];
      });
      const serialized = JSON.stringify(regions);
      if (!regions.length || serialized === previous) return;
      previous = serialized;
      // 同一批次也带递增序号，迟到的旧测量不能重新裁切刚展开的子面板。
      void window.__TAURI__?.core.invoke('update_browser_menu_regions', { revision, sequence: ++sequence.current, regions }).catch(() => undefined);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(report); };
    const mutations = new MutationObserver(records => {
      if (records.some(record => !(record.target instanceof Element) || !record.target.closest('.sia-floating-scrollbar-layer'))) schedule();
    });
    mutations.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    window.addEventListener('resize', schedule);
    // WAAPI 完成不会触发 ResizeObserver；结束后再次核对原生绘制边界。
    window.addEventListener('sia-overlay-motion-end', schedule);
    document.addEventListener('scroll', schedule, true);
    // 隐藏的原生窗口可能暂停动画帧，首轮直接测量，与只读气泡采用相同的就绪显示方式。
    report();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('sia-overlay-motion-end', schedule);
      document.removeEventListener('scroll', schedule, true);
    };
  }, [payload.hitRegionRevision]);

  const layout = payload.menuLayout;
  const style: CSSProperties = layout ? {
    position: 'absolute', left: layout.left, top: layout.top, width: layout.width, margin: 0,
    maxHeight: `min(640px, ${layout.height}px, calc(100vh - ${layout.top + 20}px))`,
  } : {};
  return <div className="browser-floating-host" data-panel-kind={payload.kind ?? 'menu'}>
    <FloatingScrollbarProvider />
    {cloneElement(children, { 'data-browser-floating-surface': 'root', style: { ...children.props.style, ...style } } as Record<string, unknown>)}
  </div>;
}

/** 子面板的锚点矩形，坐标相对当前原生浮层窗口，单位为 CSS 像素。 */
export interface BrowserFloatingAnchor {
  /** 左边缘位置。 */
  x: number;
  /** 上边缘位置。 */
  y: number;
  /** 锚点宽度；右键点击可为零。 */
  width: number;
  /** 锚点高度；右键点击可为零。 */
  height: number;
}

/** 下载右键与扩展操作共用的子面板承载，使用真实尺寸避让边缘，不增加整窗遮罩。 */
export function BrowserFloatingSubmenu({ anchor, placement, children, onClose }: {
  /** 触发行或右键点击位置。 */
  anchor: BrowserFloatingAnchor;
  /** beside 在触发行所属面板旁展开；point 从右键坐标展开。 */
  placement: 'beside' | 'point';
  /** 复用现有 Sia Menu，保留按钮、确认和动作处理。 */
  children: ReactNode;
  /** 点击子面板之外时关闭当前子层；父面板继续保留。 */
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => {
      const root = document.querySelector('[data-browser-floating-surface="root"]')?.getBoundingClientRect();
      const rect = node.getBoundingClientRect();
      const right = placement === 'beside' && root ? root.right + 9 : anchor.x;
      const left = placement === 'beside' && root ? root.left - rect.width - 9 : anchor.x - rect.width;
      const x = right + rect.width <= innerWidth - 8 ? right : left;
      node.style.left = `${Math.max(8, Math.min(x, innerWidth - rect.width - 8))}px`;
      node.style.top = `${Math.max(8, Math.min(anchor.y, innerHeight - rect.height - 8))}px`;
    };
    const observer = new ResizeObserver(update);
    observer.observe(node);
    window.addEventListener('resize', update);
    update();
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, [anchor, placement]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !ref.current?.contains(target)
        && !(target instanceof Element && target.closest('.sia-floating-scrollbar'))) onClose();
    };
    document.addEventListener('pointerdown', dismiss, true);
    return () => document.removeEventListener('pointerdown', dismiss, true);
  }, [onClose]);
  return <div ref={ref} className="browser-floating-submenu" data-browser-floating-surface="submenu">{children}</div>;
}
