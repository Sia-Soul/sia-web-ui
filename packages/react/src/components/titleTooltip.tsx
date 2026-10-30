import "../title-tooltip.css";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { PopupPortal } from "./PopupPortal";

// 标记挂在文档上并使用跨模块共享的 Symbol，热更新和多个打包入口不能重复注册全局监听。
const installedKey = Symbol.for("sia.ui.titleTooltip.installed");

/** 将原生 title 转为框架提示数据，保留其他属性且不增加布局包裹元素。同一文档的组件及框架副本共用一个提示服务和提示层。鼠标悬停或键盘聚焦 600ms 后显示；鼠标点击产生的焦点不会保留提示，移出、点击、滚动或窗口失焦时沿入场轨迹以 320ms 反播关闭，减少动态效果时直接关闭。无 title 时原样返回，服务端渲染时不安装 DOM 事件。 */
export function withTitleTooltip<T>(props: T): T {
  if (!props || typeof props !== "object" || !("title" in props)) return props;
  const { title, ...rest } = props as T & { title?: unknown };
  if (typeof document !== "undefined") installTitleTooltips(document);
  return { ...rest, "data-sia-title": title == null ? undefined : String(title) } as T;
}

function installTitleTooltips(doc: Document) {
  const owner = doc as Document & { [installedKey]?: boolean };
  if (owner[installedKey]) return;
  owner[installedKey] = true;
  let hovered: Element | null = null;
  let focused: Element | null = null;
  // 鼠标点击也会触发 focusin，必须与键盘焦点区分，否则移出后会被 focused 再次唤起。
  let keyboardFocus = true;
  let active: Element | null = null;
  let pending: Element | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let root: Root | undefined;
  let observer: MutationObserver | undefined;
  let tooltipId = "";

  /** 按需检查省略标记；同时检查插件内部的文字容器，避免排序、筛选包裹层遮蔽真实溢出。 */
  const canShow = (element: Element) => {
    if (!element.hasAttribute("data-sia-title-overflow-only")) return true;
    return [element, ...element.querySelectorAll("*")].some(node => {
      if (node.clientWidth <= 0 || node.scrollWidth <= node.clientWidth) return false;
      const style = doc.defaultView?.getComputedStyle(node);
      return style?.textOverflow === "ellipsis" && (style.overflowX === "hidden" || style.overflowX === "clip");
    });
  };

  const candidate = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return null;
    const element = target.closest("[data-sia-title]");
    // An explicit Tooltip/Popover owns the interaction and must not show twice.
    return element?.getAttribute("data-sia-title") && !element.closest(".sia-floating") && canShow(element) ? element : null;
  };
  const hasExplicitTooltip = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest(".sia-floating"));
  const hide = () => {
    clearTimeout(timer);
    pending = null;
    observer?.disconnect();
    observer = undefined;
    if (active) {
      const ids = (active.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(id => id && id !== tooltipId);
      if (ids.length) active.setAttribute("aria-describedby", ids.join(" "));
      else active.removeAttribute("aria-describedby");
    }
    // 保留已有锚点和文字直到退场完成；新提示到来时旧完成回调不能清掉新内容。
    const closing = active;
    active = null;
    if (closing && root) root.render(<PopupPortal anchorRef={{ current: closing as HTMLElement }} open={false} placement="top-start"
      id={tooltipId} role="tooltip" className="sia-title-tooltip" afterOpenChange={opened => { if (!opened && !active) root?.render(null); }}>{closing.getAttribute("data-sia-title")}</PopupPortal>);
  };
  const render = () => {
    const text = active?.getAttribute("data-sia-title");
    // 延迟期间列宽或文字可能变化，显示前再次确认仍有省略。
    if (!active?.isConnected || !text || !canShow(active)) { hide(); return; }
    if (!root) {
      const host = doc.createElement("div");
      host.setAttribute("data-sia-title-tooltip-host", "");
      doc.body.append(host);
      root = createRoot(host);
      tooltipId = `sia-title-tooltip-${Math.random().toString(36).slice(2)}`;
    }
    const ids = new Set((active.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean));
    ids.add(tooltipId);
    active.setAttribute("aria-describedby", [...ids].join(" "));
    root.render(<PopupPortal anchorRef={{ current: active as HTMLElement }} placement="top-start"
      id={tooltipId} role="tooltip" className="sia-title-tooltip">{text}</PopupPortal>);
  };
  const show = (element: Element | null) => {
    if (!element && !active && !pending) return;
    if (element && (element === active || element === pending)) return;
    hide();
    if (!element) return;
    pending = element;
    timer = setTimeout(() => {
      pending = null;
      if (!element.isConnected) return;
      active = element;
      render();
      if (!active) return;
      observer = new MutationObserver(() => {
        if (!active?.isConnected) hide();
        else if (active.getAttribute("data-sia-title") !== doc.getElementById(tooltipId)?.textContent) render();
      });
      observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-sia-title"] });
    // 停留 600ms 才显示，快速经过按钮时不遮挡操作区域。
    }, 600);
  };
  doc.addEventListener("pointerover", event => { if (event.pointerType === "touch") return; hovered = candidate(event.target); if (hasExplicitTooltip(event.target)) hide(); else show(hovered ?? focused); }, true);
  doc.addEventListener("pointermove", event => { if (event.pointerType === "touch" || event.buttons) return; hovered = candidate(event.target); if (!hasExplicitTooltip(event.target)) show(hovered ?? focused); }, true);
  doc.addEventListener("pointerout", event => { if (event.pointerType === "touch") return; hovered = candidate(event.relatedTarget); if (hasExplicitTooltip(event.relatedTarget)) hide(); else show(hovered ?? focused); }, true);
  doc.addEventListener("focusin", event => { focused = keyboardFocus ? candidate(event.target) : null; if (hasExplicitTooltip(event.target)) hide(); else if (keyboardFocus) show(focused ?? hovered); }, true);
  doc.addEventListener("focusout", event => { focused = keyboardFocus ? candidate(event.relatedTarget) : null; show(hovered ?? focused); }, true);
  doc.addEventListener("pointerdown", () => { keyboardFocus = false; focused = null; hide(); }, true);
  doc.addEventListener("keydown", event => { if (event.key === "Escape") hide(); else if (event.key === "Tab") keyboardFocus = true; }, true);
  doc.addEventListener("scroll", hide, true);
  // 切出页面时清空交互来源，避免浏览器没有派发元素移出事件而残留提示。
  doc.addEventListener("visibilitychange", () => { if (doc.hidden) { hovered = focused = null; hide(); } });
  doc.defaultView?.addEventListener("blur", () => { hovered = focused = null; hide(); });
}
