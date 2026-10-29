/** 仅订阅当前 WebView 的原生事件；全局广播仍会到达，其他窗口的定向事件不会串入。 */
export function listenNative<T>(event: string, handler: (event: TauriEvent<T>) => void): Promise<() => void> {
  const tauri = window.__TAURI__;
  if (!tauri) return Promise.resolve(() => undefined);
  // Tauri 的焦点、尺寸等系统事件属于原生窗口，业务事件属于具体 WebView。
  const nativeWindow = event.startsWith("tauri://");
  const label = nativeWindow ? tauri.window?.getCurrentWindow().label : tauri.webview?.getCurrentWebview().label;
  return tauri.event.listen(event, handler, label ? { target: { kind: nativeWindow ? "Window" : "Webview", label } } : undefined);
}
