import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@sia-ui/react";
import type { IconName } from "@sia-ui/react";

interface MenuState {
  x: number;
  y: number;
  target: Element | null;
}

interface InspectedElement {
  element: Element;
  label: string;
  rect: DOMRect;
}

interface ContextMenuItem {
  key: string;
  label: string;
  icon: IconName;
  shortcut: string;
  action: (state: MenuState) => void;
}

function getPageSnapshot() {
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".docs-context-menu, .docs-inspector-highlight, .docs-inspector-label").forEach((node) => node.remove());
  if (!clone.querySelector("base")) {
    const base = document.createElement("base");
    base.href = document.baseURI;
    clone.querySelector("head")?.prepend(base);
  }
  return `<!doctype html>\n${clone.outerHTML}`;
}

function savePage() {
  const url = URL.createObjectURL(new Blob([getPageSnapshot()], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  const name = (document.title || "sia-web-ui").replace(/[\\/:*?"<>|]+/g, "-");
  link.href = url;
  link.download = `${name}.html`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function viewPageSource() {
  const url = URL.createObjectURL(new Blob([getPageSnapshot()], { type: "text/plain;charset=utf-8" }));
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function getElementLabel(element: Element) {
  const id = element.id ? `#${element.id}` : "";
  const classNames = Array.from(element.classList).slice(0, 2).map((name) => `.${name}`).join("");
  return `${element.tagName.toLowerCase()}${id}${classNames}`;
}

export function PageContextMenu() {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<MenuState>();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [inspected, setInspected] = useState<InspectedElement>();

  function inspectElement(state: MenuState) {
    if (!state.target) return;
    const event = new CustomEvent("sia:inspect", {
      cancelable: true,
      detail: { target: state.target, x: state.x, y: state.y },
    });
    if (!window.dispatchEvent(event)) return;
    setInspected({
      element: state.target,
      label: getElementLabel(state.target),
      rect: state.target.getBoundingClientRect(),
    });
  }

  const items: readonly ContextMenuItem[] = [
    { key: "refresh", label: "刷新页面", icon: "refresh", shortcut: "Ctrl R", action: () => window.location.reload() },
    { key: "save", label: "页面另存为", icon: "download", shortcut: "Ctrl S", action: savePage },
    { key: "source", label: "查看页面源码", icon: "code", shortcut: "Ctrl U", action: viewPageSource },
    { key: "inspect", label: "检查", icon: "search", shortcut: "F12", action: inspectElement },
  ];

  useEffect(() => {
    const openMenu = (event: globalThis.MouseEvent) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      const target = event.target instanceof Element ? event.target : null;
      const rect = target?.getBoundingClientRect();
      const x = event.clientX || rect?.left || 8;
      const y = event.clientY || rect?.bottom || 8;
      setInspected(undefined);
      setPosition({ x, y });
      setMenu({ x, y, target });
    };
    document.addEventListener("contextmenu", openMenu);
    return () => document.removeEventListener("contextmenu", openMenu);
  }, []);

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    setPosition({
      x: Math.min(Math.max(8, menu.x), Math.max(8, window.innerWidth - rect.width - 8)),
      y: Math.min(Math.max(8, menu.y), Math.max(8, window.innerHeight - rect.height - 8)),
    });
    menuRef.current.querySelector<HTMLButtonElement>("button")?.focus();
  }, [menu]);

  useEffect(() => {
    if (!menu) return undefined;
    const closeOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(undefined);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(undefined);
    };
    const close = () => setMenu(undefined);
    document.addEventListener("pointerdown", closeOutside, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  useEffect(() => {
    if (!inspected) return undefined;
    const update = () => setInspected((current) => current ? {
      ...current,
      rect: current.element.getBoundingClientRect(),
    } : undefined);
    const close = () => setInspected(undefined);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    document.addEventListener("pointerdown", close, { once: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      document.removeEventListener("pointerdown", close);
    };
  }, [inspected]);

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const direction = event.key === "ArrowDown" ? 1 : -1;
    buttons[(index + direction + buttons.length) % buttons.length]?.focus();
  }

  return createPortal(<>
    {menu ? <div
      ref={menuRef}
      className="docs-context-menu"
      role="menu"
      aria-label="页面右键菜单"
      style={{ left: position.x, top: position.y }}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={handleMenuKeyDown}
    >
      {items.map((item, index) => <div key={item.key}>
        {index === 1 || index === 3 ? <div className="docs-context-menu__divider" role="separator" /> : null}
        <button type="button" role="menuitem" onClick={() => {
          item.action(menu);
          setMenu(undefined);
        }}>
          <Icon name={item.icon} size={17} />
          <span>{item.label}</span>
          <kbd>{item.shortcut}</kbd>
        </button>
      </div>)}
    </div> : null}
    {inspected ? <>
      <div className="docs-inspector-highlight" style={{
        left: inspected.rect.left,
        top: inspected.rect.top,
        width: inspected.rect.width,
        height: inspected.rect.height,
      }} />
      <div className="docs-inspector-label" style={{
        left: Math.max(8, Math.min(inspected.rect.left, window.innerWidth - 280)),
        top: inspected.rect.top > 36 ? inspected.rect.top - 30 : inspected.rect.bottom + 6,
      }}>{inspected.label}<span>再次点击关闭</span></div>
    </> : null}
  </>, document.body);
}
