import { useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";

export type OverlayContainer = HTMLElement | (() => HTMLElement);

let bodyLockCount = 0;
let previousBodyOverflow = "";
const overlayStack: symbol[] = [];

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

export function useOverlayLifecycle(
  open: boolean,
  panelRef: RefObject<HTMLElement>,
  onRequestClose: () => void,
  keyboard = true,
) {
  const overlayIdRef = useRef(Symbol("sia-overlay"));
  const closeRef = useRef(onRequestClose);
  closeRef.current = onRequestClose;

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const overlayId = overlayIdRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlayStack.push(overlayId);
    const unlockBody = lockBodyScroll();
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const [firstFocusable] = focusableElements(panel);
      (firstFocusable ?? panel).focus({ preventScroll: true });
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
      unlockBody();
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [keyboard, open, panelRef]);
}

export function OverlayPortal({ children, container }: { children: ReactNode; container?: OverlayContainer }) {
  if (typeof document === "undefined") return null;
  const target = typeof container === "function" ? container() : container ?? document.body;
  return createPortal(children, target);
}
