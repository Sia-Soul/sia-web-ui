import { useEffect, useMemo, useState } from "react";
import { Button, Icon, applySiaTheme } from "@sia-ui/react";

export interface BrowserMenuItem {
  type?: "divider";
  key?: string;
  label?: string;
  subtitle?: string;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  danger?: boolean;
  variant?: "theme";
  children?: BrowserMenuItem[];
}

export interface BrowserMenuPayload {
  darkMode: boolean;
  heading?: string;
  items: BrowserMenuItem[];
}

interface BrowserMenuAction {
  action: string;
  value?: string;
}

async function invokeNative<T>(command: string, args?: Record<string, unknown>) {
  if (!window.__TAURI__) throw new Error("浏览器菜单仅在桌面版中可用");
  return window.__TAURI__.core.invoke<T>(command, args);
}

export default function BrowserMenuWindow() {
  const [payload, setPayload] = useState<BrowserMenuPayload | null>(null);
  const [submenu, setSubmenu] = useState<BrowserMenuItem | null>(null);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void invokeNative<BrowserMenuPayload | null>("get_browser_menu_state")
      .then((state) => {
        if (!disposed && state) setPayload(state);
      })
      .catch(() => undefined);
    if (window.__TAURI__) {
      void window.__TAURI__.event.listen<BrowserMenuPayload>(
        "sia://browser-menu-state",
        ({ payload: nextPayload }) => {
          setSubmenu(null);
          setPayload(nextPayload);
        },
      ).then((dispose) => {
        if (disposed) dispose();
        else unlisten = dispose;
      });
    }
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!payload) return;
    applySiaTheme(payload.darkMode ? "dark" : "light");
  }, [payload]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (submenu) {
        setSubmenu(null);
        return;
      }
      void invokeNative("close_browser_menu").catch(() => undefined);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submenu]);

  const items = useMemo(
    () => submenu?.children ?? payload?.items ?? [],
    [payload, submenu],
  );

  async function selectItem(item: BrowserMenuItem) {
    if (item.disabled) return;
    if (item.children?.length) {
      setSubmenu(item);
      return;
    }
    if (!item.key) return;
    setPayload(null);
    await invokeNative("browser_menu_action", {
      action: {
        action: item.key,
      } satisfies BrowserMenuAction,
    });
  }

  if (!payload) return null;

  return (
    <div
      className="browser-window-menu"
      role="menu"
      onContextMenu={(event) => event.preventDefault()}
    >
      {!submenu && payload.heading ? (
        <div className="browser-window-menu__heading">{payload.heading}</div>
      ) : null}
      {submenu ? (
        <>
          <Button
            className="browser-window-menu__item browser-window-menu__back"
            variant="text"
            size="small"
            icon={<Icon name="chevron-left" size={14} />}
            onClick={() => setSubmenu(null)}
          >
            {submenu.label}
          </Button>
          <div className="browser-window-menu__divider" role="separator" />
        </>
      ) : null}
      {items.map((item, index) => {
        if (item.type === "divider") {
          return (
            <div
              key={`divider-${index}`}
              className="browser-window-menu__divider"
              role="separator"
            />
          );
        }
        return (
          <Button
            key={item.key ?? `item-${index}`}
            className={`browser-window-menu__item${item.danger ? " is-danger" : ""}${item.subtitle ? " has-subtitle" : ""}`}
            variant="text"
            size="small"
            disabled={item.disabled}
            onClick={() => void selectItem(item)}
          >
            <span className="browser-window-menu__copy">
              <span className="browser-window-menu__label">{item.label}</span>
              {item.subtitle ? (
                <span className="browser-window-menu__subtitle">{item.subtitle}</span>
              ) : null}
            </span>
            {item.variant === "theme" ? (
              <span
                className={`browser-window-menu__theme${item.checked ? " is-dark" : ""}`}
                aria-label={item.checked ? "当前为深色主题" : "当前为浅色主题"}
              >
                <span className={!item.checked ? "is-active" : ""}>
                  <Icon name="sun" size={13} />
                </span>
                <span className={item.checked ? "is-active" : ""}>
                  <Icon name="moon" size={13} />
                </span>
              </span>
            ) : item.children?.length ? (
              <Icon name="chevron-right" size={13} />
            ) : item.checked !== undefined ? (
              <span className={`browser-window-menu__check${item.checked ? " is-checked" : ""}`}>
                {item.checked ? "✓" : ""}
              </span>
            ) : item.shortcut ? (
              <span className="browser-window-menu__shortcut">{item.shortcut}</span>
            ) : null}
          </Button>
        );
      })}
    </div>
  );
}
