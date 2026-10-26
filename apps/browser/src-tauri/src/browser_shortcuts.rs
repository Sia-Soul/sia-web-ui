//! 将网页视图中的快捷键交给外壳执行，保持标签状态和原生视图同步。
use tauri::{AppHandle, Emitter, Webview};
use webview2_com::{
    AcceleratorKeyPressedEventHandler,
    Microsoft::Web::WebView2::Win32::{COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN, COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN},
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetKeyState, VK_CONTROL, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT,
};

/// 首次导航前安装外壳快捷键；查找、打印、缩放及文本编辑保留内核行为，安装失败返回错误。
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
                if (kind != COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN && kind != COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN)
                    || [VK_LWIN, VK_RWIN]
                        .iter()
                        .any(|key| GetKeyState(i32::from(key.0)) < 0)
                {
                    return Ok(());
                }
                let Some(action) = shortcut_action(key, GetKeyState(i32::from(VK_CONTROL.0)) < 0,
                    GetKeyState(i32::from(VK_SHIFT.0)) < 0, GetKeyState(i32::from(VK_MENU.0)) < 0, &tab_id) else { return Ok(()); };
                // 必须在原生加速键阶段标记已处理，防止 WebView2 弹出内置下载面板。
                args.SetHandled(true)?;
                let mut lparam = 0;
                args.KeyEventLParam(&mut lparam)?;
                // 长按产生的重复事件也要吞掉，防止切换焦点后连续关闭其他标签。
                if lparam & (1 << 30) == 0 {
                    let app = app.clone();
                    // 原生输入回调同步阻塞网页进程；异步通知外壳，避免在回调里销毁视图。
                    tauri::async_runtime::spawn(async move {
                        if let Err(error) = app.emit_to("main", "sia://native-menu-action", action)
                        {
                            eprintln!("无法发送浏览器快捷键：{error}");
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

/// 使用与前端相同的快捷键表，避免焦点切换后出现功能或修饰键差异。
fn shortcut_action(key: u32, ctrl: bool, shift: bool, alt: bool, tab_id: &str) -> Option<String> {
    #[derive(serde::Deserialize)]
    struct Binding { key: String, #[serde(default)] ctrl: bool, #[serde(default)] shift: bool, #[serde(default)] alt: bool, action: String }
    static BINDINGS: std::sync::OnceLock<Vec<Binding>> = std::sync::OnceLock::new();
    let bindings = BINDINGS.get_or_init(|| serde_json::from_str(include_str!("../../src/browserShortcuts.json")).expect("快捷键表必须有效"));
    let key_name = match key {
        0x09 => "tab".into(), 0x21 => "pageup".into(), 0x22 => "pagedown".into(), 0x73 => "f4".into(),
        0x30..=0x39 | 0x41..=0x5A => char::from_u32(key)?.to_ascii_lowercase().to_string(), _ => return None,
    };
    bindings.iter().find(|binding| binding.key == key_name && binding.ctrl == ctrl && binding.shift == shift && binding.alt == alt)
        .map(|binding| format!("shortcut|{}|{tab_id}", binding.action))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn download_shortcut_routes_to_shell_without_changing_close() {
        // 下载指向外壳面板，关闭仍携带来源标签，其余加速键交还网页。
        assert_eq!(shortcut_action(0x4A, true, false, false, "sample").as_deref(), Some("shortcut|downloads|sample"));
        assert_eq!(shortcut_action(0x57, true, false, false, "sample").as_deref(), Some("shortcut|close-tab|sample"));
        assert_eq!(shortcut_action(0x44, false, false, true, "sample").as_deref(), Some("shortcut|address|sample"));
        assert_eq!(shortcut_action(0x54, true, true, false, "sample").as_deref(), Some("shortcut|reopen-tab|sample"));
        // 查找、打印、缩放、控制台及编辑组合保持未处理，让 WebView2 执行。
        for (key, shift) in [(0x46, false), (0x50, false), (0xBB, false), (0x4A, true), (0x43, false), (0x56, false), (0x5A, false)] {
            assert_eq!(shortcut_action(key, true, shift, false, "sample"), None);
        }
    }
}
