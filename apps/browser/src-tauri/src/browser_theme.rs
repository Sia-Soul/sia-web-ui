//! 浏览器外壳与网页内核共用主题，显式覆盖 WebView2 从系统或 Profile 继承的颜色偏好。
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::{AppHandle, Manager};

/// 浏览器默认浅色；新建和休眠恢复的网页读取同一份当前主题。
#[derive(Default)]
pub struct BrowserThemeStore(Arc<AtomicBool>);

/// 原生弹出菜单读取与外壳一致的主题，避免继承系统的不同颜色设置。
pub fn is_dark(app: &AppHandle) -> bool {
    app.state::<BrowserThemeStore>().0.load(Ordering::SeqCst)
}

/// 在 UI 线程读取最新主题并更新 Profile；调用方等待成功后再导航，避免错误页先使用旧主题。
#[cfg(windows)]
pub async fn apply_browser_theme(app: &AppHandle, webview: &tauri::Webview) -> Result<(), String> {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_13, COREWEBVIEW2_PREFERRED_COLOR_SCHEME_DARK,
        COREWEBVIEW2_PREFERRED_COLOR_SCHEME_LIGHT,
    };
    use windows::core::Interface;
    let theme = app.state::<BrowserThemeStore>().0.clone();
    let (sender, receiver) = tokio::sync::oneshot::channel();
    webview
        .with_webview(move |view| {
            let result = (|| unsafe {
                let profile = view
                    .controller()
                    .CoreWebView2()?
                    .cast::<ICoreWebView2_13>()?
                    .Profile()?;
                profile.SetPreferredColorScheme(if theme.load(Ordering::SeqCst) {
                    COREWEBVIEW2_PREFERRED_COLOR_SCHEME_DARK
                } else {
                    COREWEBVIEW2_PREFERRED_COLOR_SCHEME_LIGHT
                })
            })();
            let _ = sender.send(result.map_err(|error| format!("无法更新网页主题：{error}")));
        })
        .map_err(|error| error.to_string())?;
    tokio::time::timeout(std::time::Duration::from_secs(10), receiver)
        .await
        .map_err(|_| "网页主题同步超时".to_string())?
        .map_err(|_| "网页主题同步已中断".to_string())?
}

/// 切换所有存活网页的颜色偏好；不注入网站 CSS，也不重新加载页面。
#[tauri::command]
pub async fn set_browser_theme(app: AppHandle, dark_mode: bool) -> Result<(), String> {
    app.state::<BrowserThemeStore>()
        .0
        .store(dark_mode, Ordering::SeqCst);
    // 固定原生窗口主题，避免后续系统 ThemeChanged 事件再次覆盖网页 Profile。
    app.set_theme(Some(if dark_mode {
        tauri::Theme::Dark
    } else {
        tauri::Theme::Light
    }));
    let mut failure = None;
    for (label, webview) in app.webviews() {
        if !label.starts_with("browser-tab-") {
            continue;
        }
        if let Err(error) = apply_browser_theme(&app, &webview).await {
            // 切换主题期间关闭的标签无需报错；其他错误保留，同时继续同步剩余分组。
            if app.get_webview(&label).is_some() {
                failure = Some(error);
            }
        }
    }
    failure.map_or(Ok(()), Err)
}
