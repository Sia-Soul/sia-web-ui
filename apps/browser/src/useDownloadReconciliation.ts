import { useEffect, useRef, type MutableRefObject } from "react";

/** 有未结束任务时每秒读取内核快照，修复漏送事件；请求串行，卸载后不再更新界面。 */
export function useDownloadReconciliation<T>(ids: string[], receive: MutableRefObject<((event: { payload: T }) => void) | undefined>) {
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const active = ids.length > 0;
  useEffect(() => {
    if (!active || !window.__TAURI__) return;
    let disposed = false;
    let busy = false;
    const refresh = async () => {
      if (busy || disposed || !idsRef.current.length) return;
      busy = true;
      try {
        const states = await window.__TAURI__!.core.invoke<T[]>("get_browser_download_states", { ids: idsRef.current });
        if (!disposed && Array.isArray(states)) states.forEach(payload => receive.current?.({ payload }));
      } catch {
        // 短暂 IPC 失败保留当前记录，下一次核对重试，不把下载误标为完成或失败。
      } finally { busy = false; }
    };
    const timer = window.setInterval(() => void refresh(), 1000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [active, receive]);
}
