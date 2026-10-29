//! 外部网页拖入桥接；网页与外壳的每个 WebView 都转交主界面创建新标签。

// 网页保留站点自定义上传区域；主壳层和侧栏直接导入脚本，使用捕获阶段接收外部拖入。
pub const SCRIPT: &str = concat!("window.__siaBrowserDropPage = true;\n", include_str!("browser_drop.js"));

/// 只使用 WebView2 提供的真实 File 路径，不信任网页消息中自报的本地文件路径。
#[cfg(windows)]
pub fn attach(app: &tauri::AppHandle, webview: &tauri::Webview) -> Result<(), String> {
    use tauri::Manager;
    use windows::core::{Interface, PWSTR};
    use webview2_com::{CoTaskMemPWSTR, WebMessageReceivedEventHandler, Microsoft::Web::WebView2::Win32::{
        ICoreWebView2File, ICoreWebView2WebMessageReceivedEventArgs2,
    }};
    let app = app.clone();
    let label = webview.label().to_string();
    webview.with_webview(move |platform| {
        let result = (|| -> windows::core::Result<()> {
            let core = unsafe { platform.controller().CoreWebView2()? };
            let handler = WebMessageReceivedEventHandler::create(Box::new(move |_, args| {
                let Some(args) = args else { return Ok(()); };
                let mut raw = PWSTR::null();
                if unsafe { args.TryGetWebMessageAsString(&mut raw) }.is_err() { return Ok(()); }
                let Ok(message) = serde_json::from_str::<serde_json::Value>(&CoTaskMemPWSTR::from(raw).to_string()) else { return Ok(()); };
                let url = match message["kind"].as_str() {
                    Some("sia-open-dropped-url") => message["url"].as_str().and_then(crate::default_browser::web_url),
                    Some("sia-open-dropped-file") => {
                        let objects = unsafe { args.cast::<ICoreWebView2WebMessageReceivedEventArgs2>()?.AdditionalObjects()? };
                        let mut count = 0;
                        unsafe { objects.Count(&mut count)?; }
                        if count == 0 { return Ok(()); }
                        let file = unsafe { objects.GetValueAtIndex(0)? }.cast::<ICoreWebView2File>()?;
                        let mut path = PWSTR::null();
                        unsafe { file.Path(&mut path)?; }
                        crate::default_browser::html_file_url(std::path::Path::new(&CoTaskMemPWSTR::from(path).to_string()))
                    }
                    _ => None,
                };
                if let (Some(url), Some(view)) = (url, app.get_webview(&label)) {
                    let context = crate::window_context::BrowserContext::new(&app, view.window().label());
                    let _ = context.emit("sia://open-dropped-url", url);
                }
                Ok(())
            }));
            let mut token = 0;
            unsafe { core.add_WebMessageReceived(&handler, &mut token)?; }
            Ok(())
        })();
        if let Err(error) = result { eprintln!("无法初始化网页拖入：{error}"); }
    }).map_err(|error| error.to_string())
}

#[cfg(not(windows))]
pub fn attach(_app: &tauri::AppHandle, _webview: &tauri::Webview) -> Result<(), String> { Ok(()) }
