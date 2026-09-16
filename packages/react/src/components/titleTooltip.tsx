import "../title-tooltip.css";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { PopupPortal } from "./PopupPortal";

const documents = new WeakSet<Document>();

/** 将原生 title 转为框架提示数据，避免浏览器提示与 Sia Tooltip 重复出现；保留其他属性且不增加布局包裹元素。无 title 时原样返回，服务端渲染时不安装 DOM 事件。 */
export function withTitleTooltip<T>(props: T): T {
  if (!props || typeof props !== "object" || !("title" in props)) return props;
  const { title, ...rest } = props as T & { title?: unknown };
  if (typeof document !== "undefined") installTitleTooltips(document);
  return { ...rest, "data-sia-title": title == null ? undefined : String(title) } as T;
}

function installTitleTooltips(doc: Document) {
  if (documents.has(doc)) return;
  documents.add(doc);
  let hovered: Element | null = null;
  let focused: Element | null = null;
  let active: Element | null = null;
  let pending: Element | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let root: Root | undefined;
  let observer: MutationObserver | undefined;
  let tooltipId = "";

  const candidate = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return null;
    const element = target.closest("[data-sia-title]");
    // An explicit Tooltip/Popover owns the interaction and must not show twice.
    return element?.getAttribute("data-sia-title") && !element.closest(".sia-floating") ? element : null;
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
    active = null;
    root?.render(null);
  };
  const render = () => {
    const text = active?.getAttribute("data-sia-title");
    if (!active?.isConnected || !text) { hide(); return; }
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
  doc.addEventListener("focusin", event => { focused = candidate(event.target); if (hasExplicitTooltip(event.target)) hide(); else show(focused ?? hovered); }, true);
  doc.addEventListener("focusout", event => { focused = candidate(event.relatedTarget); show(hovered ?? focused); }, true);
  doc.addEventListener("pointerdown", hide, true);
  doc.addEventListener("keydown", event => { if (event.key === "Escape") hide(); }, true);
  doc.addEventListener("scroll", hide, true);
  doc.defaultView?.addEventListener("blur", () => { hovered = focused = null; hide(); });
}
