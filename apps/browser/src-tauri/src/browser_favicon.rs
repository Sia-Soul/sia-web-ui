//! 从网页所属 WebView2 Profile 读取实际站点图标，支持自定义路径、登录态和动态换图标。
use base64::Engine;
use std::{cell::Cell, rc::Rc};
use tauri::{AppHandle, Emitter, Webview};
use webview2_com::{
    CoTaskMemPWSTR, FaviconChangedEventHandler, GetFaviconCompletedHandler,
    Microsoft::Web::WebView2::Win32::{
        ICoreWebView2, ICoreWebView2_15, COREWEBVIEW2_FAVICON_IMAGE_FORMAT_PNG,
    },
};
use windows::{
    core::{Interface, PWSTR},
    Win32::System::Com::IStream,
};

/// 限制单个图标为 256 KiB，避免异常站点图标放大 IPC 和会话文件。
const MAX_ICON_BYTES: usize = 256 * 1024;

/// 读取内核已解码的 PNG，不在外壳请求需要分组 Cookie 的原始图标地址。
unsafe fn png_data_url(stream: Option<IStream>) -> windows::core::Result<String> {
    let Some(stream) = stream else {
        return Ok(String::new());
    };
    let mut data = Vec::new();
    loop {
        let mut chunk = [0u8; 4096];
        let mut count = 0;
        stream
            .Read(
                chunk.as_mut_ptr().cast(),
                chunk.len() as u32,
                Some(&mut count),
            )
            .ok()?;
        if count == 0 {
            break;
        }
        if data.len() + count as usize > MAX_ICON_BYTES {
            return Ok(String::new());
        }
        data.extend_from_slice(&chunk[..count as usize]);
    }
    if !data.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Ok(String::new());
    }
    Ok(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(data)
    ))
}

/// 获取当前文档地址，用于过滤导航后才返回的旧图标。
unsafe fn source(core: &ICoreWebView2) -> windows::core::Result<String> {
    let mut value = PWSTR::null();
    core.Source(&mut value)?;
    Ok(CoTaskMemPWSTR::from(value).to_string())
}

/// 安装监听后再导航；变化序号和文档地址共同阻止较慢的旧图标覆盖新图标。
pub async fn attach(app: &AppHandle, view: &Webview, tab_id: String) -> Result<(), String> {
    let app = app.clone();
    let (send, receive) = tokio::sync::oneshot::channel();
    view.with_webview(move |view| {
        let result = (|| unsafe {
            let core = view
                .controller()
                .CoreWebView2()?
                .cast::<ICoreWebView2_15>()?;
            let revision = Rc::new(Cell::new(0u64));
            let handler = FaviconChangedEventHandler::create(Box::new(move |sender, _| {
                let Some(sender) = sender else {
                    return Ok(());
                };
                let url = source(&sender)?;
                if url == "about:blank" {
                    return Ok(());
                }
                let current = revision.get().wrapping_add(1);
                revision.set(current);
                let revision = revision.clone();
                let app = app.clone();
                let tab_id = tab_id.clone();
                let check_core = sender.clone();
                let completed =
                    GetFaviconCompletedHandler::create(Box::new(move |status, stream| {
                        status?;
                        if revision.get() != current || source(&check_core)? != url {
                            return Ok(());
                        }
                        let favicon = png_data_url(stream)?;
                        let _ = app.emit("sia://browser-event", serde_json::json!({
                        "kind": "favicon", "tabId": tab_id, "url": url, "faviconUrl": favicon,
                    }));
                        Ok(())
                    }));
                sender
                    .cast::<ICoreWebView2_15>()?
                    .GetFavicon(COREWEBVIEW2_FAVICON_IMAGE_FORMAT_PNG, &completed)?;
                Ok(())
            }));
            let mut token = 0;
            core.add_FaviconChanged(&handler, &mut token)
        })();
        let _ = send.send(result.map_err(|error| error.to_string()));
    })
    .map_err(|error| error.to_string())?;
    tokio::time::timeout(std::time::Duration::from_secs(10), receive)
        .await
        .map_err(|_| "安装站点图标监听超时".to_string())?
        .map_err(|_| "站点图标监听已中断".to_string())?
}
