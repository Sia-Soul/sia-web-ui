import { useEffect, useRef, useState } from "react";
import { Button, Icon, message } from "@sia.soul/sia-react-ui";

/** 密码表格单元格，仅在用户点击显示或复制时读取对应账号的密码。 */
export default function BrowserPasswordCell({ credentialId }: { credentialId: string }) {
  const [password, setPassword] = useState<string>();
  const [pending, setPending] = useState<"reveal" | "copy">();
  const mounted = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  /** 复制不切换明文显示；离开当前行后忽略尚未完成的读取结果。 */
  async function readPassword(action: "reveal" | "copy") {
    if (busy.current) return;
    if (action === "reveal" && password !== undefined) {
      setPassword(undefined);
      return;
    }
    busy.current = true;
    setPending(action);
    try {
      if (!window.__TAURI__) throw new Error("仅桌面版支持读取密码");
      const credential = await window.__TAURI__.core.invoke<{ password: string }>(
        "get_browser_password", { id: credentialId },
      );
      if (!mounted.current) return;
      if (action === "copy") {
        await navigator.clipboard.writeText(credential.password);
        if (mounted.current) message.success("密码已复制");
      } else {
        setPassword(credential.password);
      }
    } catch {
      // 不将原生返回值放入通知，避免失败信息意外包含密码内容。
      if (mounted.current) message.error(action === "copy" ? "复制密码失败，请重试" : "读取密码失败，请重试");
    } finally {
      busy.current = false;
      if (mounted.current) setPending(undefined);
    }
  }

  const visible = password !== undefined;
  return (
    <div className="browser-password-cell">
      <span className="browser-password-cell__value">{visible ? password : "••••••••"}</span>
      <Button
        variant="text"
        size="small"
        icon={<Icon name={visible ? "eye-off" : "eye"} size={16} />}
        aria-label={visible ? "隐藏密码" : "显示密码"}
        aria-pressed={visible}
        title={visible ? "隐藏密码" : "显示密码"}
        loading={pending === "reveal"}
        disabled={pending !== undefined}
        onClick={() => void readPassword("reveal")}
      />
      <Button
        variant="text"
        size="small"
        icon={<Icon name="copy" size={16} />}
        aria-label="复制密码"
        title="复制密码"
        loading={pending === "copy"}
        disabled={pending !== undefined}
        onClick={() => void readPassword("copy")}
      />
    </div>
  );
}
