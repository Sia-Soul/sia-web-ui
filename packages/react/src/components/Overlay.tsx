import { useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";

/** 弹层挂载节点或返回挂载节点的函数。 */
export type OverlayContainer = HTMLElement | (() => HTMLElement);

let bodyLockCount = 0;
let previousBodyOverflow = "";
const overlayStack: symbol[] = [];
const overlayPanels = new Map<symbol, RefObject<HTMLElement>>();
const overlayListeners = new Set<() => void>();

/** 订阅已挂载模态层的变化；取消订阅后不再收到通知。仅供框架浮层同步层级。 */
export function subscribeOverlayLayers(listener: () => void) {
  overlayListeners.add(listener);
  return () => { overlayListeners.delete(listener); };
}

/** 判断触发元素是否被当前模态层阻挡；关闭动画期间仍保持原层级。 */
export function isAnchorBehindOverlay(anchor: Element) {
  const top = overlayStack.at(-1);
  const panel = top ? overlayPanels.get(top)?.current : undefined;
  if (!panel) return false;
  // 同一模态根节点中的下拉/气泡使用 Portal，不一定在 panel 内，但仍属于当前层。
  const root = panel.closest('.sia-modal-root, .sia-drawer-root');
  return root ? anchor.closest('.sia-modal-root, .sia-drawer-root') !== root : !panel.contains(anchor);
}

function lockBodyScroll() {
  if (bodyLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  bodyLockCount += 1;
  return () => {
    bodyLockCount = Math.max(0, bodyLockCount - 1);
    if (bodyLockCount === 0) document.body.style.overflow = previousBodyOverflow;
  };
}

function focusableElements(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
}

/** 按正文 DOM 顺序查找可编辑或可选择的字段，跳过隐藏、只读、禁用及非 Tab 停靠点。 */
function firstModalInput(panel: HTMLElement) {
  const body = panel.querySelector(":scope > .sia-modal__body");
  const candidates = body?.querySelectorAll<HTMLElement>(
    'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, select, [contenteditable="true"], [role="combobox"], .sia-picker__trigger, .sia-cascader__trigger, .sia-tree-select__trigger',
  );
  return [...(candidates ?? [])].find(element => (element.tabIndex >= 0 || (element.isContentEditable && !element.hasAttribute("tabindex")))
    && !element.matches(":disabled, [readonly], [aria-readonly='true']")
    && !element.closest('[hidden], [inert], [aria-hidden="true"], [aria-disabled="true"]')
    && element.getClientRects().length > 0
    && getComputedStyle(element).visibility === "visible");
}

/** 管理弹层滚动锁、键盘循环与焦点归还；autoFocusInput 默认 false，为 true 时首次聚焦优先选择 Modal 正文中的可用字段。 */
export function useOverlayLifecycle(
  open: boolean,
  panelRef: RefObject<HTMLElement>,
  onRequestClose: () => void,
  keyboard = true,
  autoFocusInput = false,
) {
  const overlayIdRef = useRef(Symbol("sia-overlay"));
  const closeRef = useRef(onRequestClose);
  closeRef.current = onRequestClose;

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const overlayId = overlayIdRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlayStack.push(overlayId);
    overlayPanels.set(overlayId, panelRef);
    overlayListeners.forEach(listener => listener());
    const unlockBody = lockBodyScroll();
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel || overlayStack.at(-1) !== overlayId) return;
      // 尊重内容自身的 autoFocus 或业务已设置的焦点，嵌套弹层仅由最上层接管。
      if (panel.contains(document.activeElement) && document.activeElement !== panel) return;
      const [firstFocusable] = focusableElements(panel);
      const input = autoFocusInput ? firstModalInput(panel) : undefined;
      (input ?? firstFocusable ?? panel).focus({ preventScroll: true });
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (overlayStack.at(-1) !== overlayId) return;
      if (event.key === "Escape" && keyboard) {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = focusableElements(panelRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      const index = overlayStack.lastIndexOf(overlayId);
      if (index >= 0) overlayStack.splice(index, 1);
      overlayPanels.delete(overlayId);
      overlayListeners.forEach(listener => listener());
      unlockBody();
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [keyboard, open, panelRef, autoFocusInput]);
}

export function OverlayPortal({ children, container }: { children: ReactNode; container?: OverlayContainer }) {
  if (typeof document === "undefined") return null;
  const target = typeof container === "function" ? container() : container ?? document.body;
  return createPortal(children, target);
}
