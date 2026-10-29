//! 将网页视图中的快捷键交给外壳执行，保持标签状态和原生视图同步。
use tauri::{AppHandle, Webview};
use webview2_com::{
    AcceleratorKeyPressedEventHandler,
    Microsoft::Web::WebView2::Win32::COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetKeyState, VK_CONTROL, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT, VK_W,
};

/// 在首次导航前安装 Ctrl+W 监听；安装失败或十秒内未完成时返回错误。
pub async fn attach(app: &AppHandle, view: &Webview, tab_id: String) -> Result<(), String> {
    let app = app.clone();
    let (send, receive) = tokio::sync::oneshot::channel();
    view.with_webview(move |view| {
        let result = (|| unsafe {
            let handler = AcceleratorKeyPressedEventHandler::create(Box::new(move |_, args| {
                let Some(args) = args else {
                    return Ok(());
                };
                let mut kind = COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN;
                let mut key = 0;
                args.KeyEventKind(&mut kind)?;
                args.VirtualKey(&mut key)?;
                if kind != COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN
                    || key != u32::from(VK_W.0)
                    || GetKeyState(i32::from(VK_CONTROL.0)) >= 0
                    || [VK_SHIFT, VK_MENU, VK_LWIN, VK_RWIN]
                        .iter()
                        .any(|key| GetKeyState(i32::from(key.0)) < 0)
                {
                    return Ok(());
                }
                args.SetHandled(true)?;
                let mut lparam = 0;
                args.KeyEventLParam(&mut lparam)?;
                // 长按产生的重复事件也要吞掉，防止切换焦点后连续关闭其他标签。
                if lparam & (1 << 30) == 0 {
                    let app = crate::window_context::BrowserContext::new(&app, "main").for_tab(&tab_id);
                    let action = format!("tab|{tab_id}|close");
                    // 原生输入回调同步阻塞网页进程；异步通知外壳，避免在回调里销毁视图。
                    tauri::async_runtime::spawn(async move {
                        if let Err(error) = app.emit("sia://native-menu-action", action)
                        {
                            eprintln!("无法发送关闭标签快捷键：{error}");
                        }
                    });
                }
                Ok(())
            }));
            let mut token = 0;
            view.controller()
                .add_AcceleratorKeyPressed(&handler, &mut token)
        })();
        let _ = send.send(result.map_err(|error| error.to_string()));
    })
    .map_err(|error| error.to_string())?;
    tokio::time::timeout(std::time::Duration::from_secs(10), receive)
        .await
        .map_err(|_| "安装网页快捷键监听超时".to_string())?
        .map_err(|_| "网页快捷键监听已中断".to_string())?
}
