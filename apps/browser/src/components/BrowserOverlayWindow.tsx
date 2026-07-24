import { useEffect, useState } from "react";
import {
  Icon,
  Input,
  Modal,
  applySiaTheme,
  message,
} from "@sia-ui/react";
import PasswordManagerModal, { type PasswordSubmission } from "./PasswordManagerModal";

export type BrowserOverlayFormKind =
  | "new-group"
  | "new-small-group"
  | "rename-group"
  | "rename-small-group";

interface FormOverlayPayload {
  kind: "form";
  formKind: BrowserOverlayFormKind;
  title: string;
  label: string;
  initialValue?: string;
  placeholder: string;
  description?: string;
  groupId?: string;
  smallGroupId?: string;
  darkMode: boolean;
}

interface PasswordManagerOverlayPayload {
  kind: "passwords";
  darkMode: boolean;
}

interface PasswordSaveOverlayPayload extends PasswordSubmission {
  kind: "password-save";
  darkMode: boolean;
}

interface ConfirmOverlayPayload {
  kind: "confirm";
  title: string;
  description: string;
  okText: string;
  action: string;
  danger?: boolean;
  darkMode: boolean;
}

export type BrowserOverlayPayload =
  | FormOverlayPayload
  | PasswordManagerOverlayPayload
  | PasswordSaveOverlayPayload
  | ConfirmOverlayPayload;

interface BrowserOverlayAction {
  action: string;
  value?: string;
}

async function invokeNative<T>(command: string, args?: Record<string, unknown>) {
  if (!window.__TAURI__) throw new Error("浏览器覆盖层仅在桌面版中可用");
  return window.__TAURI__.core.invoke<T>(command, args);
}

export default function BrowserOverlayWindow() {
  const [payload, setPayload] = useState<BrowserOverlayPayload | null>(null);
  const [formValue, setFormValue] = useState("");

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void invokeNative<BrowserOverlayPayload | null>("get_browser_overlay_state")
      .then((state) => {
        if (!disposed && state) setPayload(state);
      })
      .catch(() => undefined);
    if (window.__TAURI__) {
      void window.__TAURI__.event.listen<BrowserOverlayPayload>(
        "sia://browser-overlay-state",
        ({ payload: nextPayload }) => {
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
    if (payload.kind === "form") setFormValue(payload.initialValue ?? "");
  }, [payload]);

  async function closeOverlay() {
    setPayload(null);
    await invokeNative("close_browser_overlay").catch(() => undefined);
  }

  async function sendAction(action: string, value?: string) {
    setPayload(null);
    await invokeNative("browser_overlay_action", {
      action: { action, value } satisfies BrowserOverlayAction,
    });
  }

  async function submitForm() {
    if (!payload || payload.kind !== "form") return false;
    const value = formValue.trim();
    if (!value) {
      message.warning(`请输入${payload.label}`);
      return false;
    }
    await sendAction([
      "form",
      payload.formKind,
      payload.groupId ?? "",
      payload.smallGroupId ?? "",
    ].join("|"), value);
    return true;
  }

  async function savePassword(submission: PasswordSaveOverlayPayload) {
    try {
      await invokeNative("save_browser_password", {
        credential: {
          id: submission.credentialId,
          origin: submission.origin,
          username: submission.username,
          password: submission.password,
        },
      });
      message.success(submission.isUpdate ? "密码已更新" : "密码已保存");
      await closeOverlay();
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  if (!payload) return null;
  if (payload.kind === "passwords") {
    return (
      <PasswordManagerModal
        open
        onOpenChange={(open) => {
          if (!open) void closeOverlay();
        }}
      />
    );
  }

  const title = payload.kind === "password-save"
    ? payload.isUpdate ? "更新保存的密码？" : "保存此密码？"
    : payload.title;
  const formPayload = payload.kind === "form";
  const confirmPayload = payload.kind === "confirm";
  const passwordSavePayload = payload.kind === "password-save";

  return (
    <Modal
      className={`browser-overlay-modal browser-overlay-modal--${payload.kind}`}
      open
      title={title}
      centered
      width={420}
      okText={formPayload
        ? payload.formKind.startsWith("new-") ? "创建" : "保存"
        : confirmPayload
          ? payload.okText
          : passwordSavePayload && payload.isUpdate ? "更新" : "保存"}
      cancelText={passwordSavePayload ? "暂不" : "取消"}
      okButtonProps={confirmPayload && payload.danger ? { danger: true } : undefined}
      maskClosable
      onOk={formPayload
        ? submitForm
        : confirmPayload
          ? () => sendAction(payload.action)
          : passwordSavePayload
            ? () => savePassword(payload)
            : undefined}
      onOpenChange={(open) => {
        if (!open) void closeOverlay();
      }}
    >
      {formPayload ? (
        <div className="browser-overlay-form">
          <label htmlFor="browser-overlay-form-value">{payload.label}</label>
          <Input
            id="browser-overlay-form-value"
            value={formValue}
            autoFocus
            maxLength={24}
            placeholder={payload.placeholder}
            onChange={(event) => setFormValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submitForm();
            }}
          />
          {payload.description ? <small>{payload.description}</small> : null}
        </div>
      ) : confirmPayload ? (
        <p className="browser-overlay-confirm-description">{payload.description}</p>
      ) : passwordSavePayload ? (
        <div className="password-save-prompt">
          <span className="password-save-prompt__icon">
            <Icon name="key" size={20} />
          </span>
          <div>
            <strong>{payload.origin}</strong>
            <span>{payload.username || "未填写用户名"}</span>
            <span className="password-save-prompt__masked">••••••••••••</span>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
