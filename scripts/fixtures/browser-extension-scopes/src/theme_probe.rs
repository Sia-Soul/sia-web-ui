//! 使用隐藏 WebView 和临时 Profile 验证网页内核主题，不访问用户站点或桌面。
#[path = "../../../../apps/browser/src-tauri/src/browser_theme.rs"]
mod browser_theme;
use tauri::{WebviewUrl, WebviewWindowBuilder};
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2_13, COREWEBVIEW2_PREFERRED_COLOR_SCHEME,
    COREWEBVIEW2_PREFERRED_COLOR_SCHEME_DARK, COREWEBVIEW2_PREFERRED_COLOR_SCHEME_LIGHT,
};
use windows::core::Interface;

/// 本地返回空的 502 响应，触发与用户截图相同的 WebView2 内置错误页。
fn error_server() -> String {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    std::thread::spawn(move || {
        for mut stream in listener.incoming().flatten() {
            let _ = stream.set_read_timeout(Some(std::time::Duration::from_secs(2)));
            let _ = stream.read(&mut [0u8; 4096]);
            let _ = stream.write_all(
                b"HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
            );
        }
    });
    format!("http://{address}/error")
}

/// 读取错误页的实际背景和媒体偏好，验证原生主题不仅改了配置值。
async fn page_colors(view: &tauri::Webview) -> Result<serde_json::Value, String> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    view.with_webview(move |view| unsafe {
        let handler = webview2_com::ExecuteScriptCompletedHandler::create(Box::new(move |status, value| {
            let _ = sender.send(status.map(|_| value).map_err(|error| error.to_string())); Ok(())
        }));
        if let Ok(core) = view.controller().CoreWebView2() {
            let _ = core.ExecuteScript(&windows::core::HSTRING::from("({error: document.body?.innerText.includes('502'), dark: matchMedia('(prefers-color-scheme: dark)').matches, background: document.body && getComputedStyle(document.body).backgroundColor})"), &handler);
        }
    }).map_err(|error| error.to_string())?;
    let value = tokio::time::timeout(std::time::Duration::from_secs(10), receiver)
        .await
        .map_err(|_| "读取错误页颜色超时".to_string())?
        .map_err(|error| error.to_string())??;
    serde_json::from_str(&value).map_err(|error| error.to_string())
}

async fn error_colors(view: &tauri::Webview, dark: bool) -> Result<serde_json::Value, String> {
    for _ in 0..50 {
        let colors = page_colors(view).await?;
        if colors["error"] == true && colors["dark"] == dark {
            return Ok(colors);
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    Err(format!("错误页主题未切换：{}", page_colors(view).await?))
}

/// 查询 Profile 的实际主题，捕获外壳浅色但内核仍为 Auto/Dark 的配置缺口。
async fn scheme(view: &tauri::Webview) -> Result<i32, String> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    view.with_webview(move |view| {
        let result = (|| unsafe {
            let profile = view
                .controller()
                .CoreWebView2()?
                .cast::<ICoreWebView2_13>()?
                .Profile()?;
            let mut color = COREWEBVIEW2_PREFERRED_COLOR_SCHEME::default();
            profile.PreferredColorScheme(&mut color)?;
            Ok::<_, windows::core::Error>(color.0)
        })();
        let _ = sender.send(result.map_err(|error| error.to_string()));
    })
    .map_err(|error| error.to_string())?;
    tokio::time::timeout(std::time::Duration::from_secs(10), receiver)
        .await
        .map_err(|_| "读取 Profile 主题超时".to_string())?
        .map_err(|error| error.to_string())?
}

async fn probe(app: tauri::AppHandle) -> Result<(), String> {
    let directory =
        std::env::temp_dir().join(format!("sia-browser-theme-probe-{}", std::process::id()));
    // 保留隐藏宿主，避免休眠测试关闭最后一个窗口时 Tauri 自动退出。
    let _host = WebviewWindowBuilder::new(
        &app,
        "theme-probe-host",
        WebviewUrl::External("about:blank".parse().unwrap()),
    )
    .visible(false)
    .focused(false)
    .skip_taskbar(true)
    .data_directory(directory.join("host"))
    .build()
    .map_err(|error| error.to_string())?;
    let view = WebviewWindowBuilder::new(
        &app,
        "browser-tab-theme-probe",
        WebviewUrl::External("about:blank".parse().unwrap()),
    )
    .visible(false)
    .focused(false)
    .skip_taskbar(true)
    .data_directory(directory.clone())
    .build()
    .map_err(|error| error.to_string())?;
    // 使用产品实际同步入口，确保系统深色时网页仍服从默认浅色。
    browser_theme::apply_browser_theme(&app, view.as_ref()).await?;
    let actual = scheme(view.as_ref()).await?;
    if actual != COREWEBVIEW2_PREFERRED_COLOR_SCHEME_LIGHT.0 {
        return Err(format!(
            "浏览器默认浅色，但网页 Profile 主题为 {actual}（0=Auto，1=Light，2=Dark）"
        ));
    }
    view.navigate(error_server().parse().unwrap())
        .map_err(|error| error.to_string())?;
    let light_colors = error_colors(view.as_ref(), false).await?;
    browser_theme::set_browser_theme(app.clone(), true).await?;
    let dark_colors = error_colors(view.as_ref(), true).await?;
    if light_colors["background"] == dark_colors["background"] {
        return Err(format!(
            "内置 502 页背景没有跟随主题：{light_colors} / {dark_colors}"
        ));
    }
    if scheme(view.as_ref()).await? != COREWEBVIEW2_PREFERRED_COLOR_SCHEME_DARK.0 {
        return Err("已打开网页未切到深色".into());
    }
    view.close().map_err(|error| error.to_string())?;
    browser_theme::set_browser_theme(app.clone(), false).await?;
    let restored = WebviewWindowBuilder::new(
        &app,
        "browser-tab-theme-restored",
        WebviewUrl::External("about:blank".parse().unwrap()),
    )
    .visible(false)
    .focused(false)
    .skip_taskbar(true)
    .data_directory(directory)
    .build()
    .map_err(|error| error.to_string())?;
    browser_theme::apply_browser_theme(&app, restored.as_ref()).await?;
    if scheme(restored.as_ref()).await? != COREWEBVIEW2_PREFERRED_COLOR_SCHEME_LIGHT.0 {
        return Err("休眠恢复沿用了旧深色主题".into());
    }
    println!("PASS: 系统深色下默认浅色、502 错误页背景切换、休眠恢复覆盖旧主题；{light_colors} / {dark_colors}");
    Ok(())
}

fn main() {
    let mut context = tauri::generate_context!();
    context.config_mut().app.windows.clear();
    tauri::Builder::default()
        .manage(browser_theme::BrowserThemeStore::default())
        .setup(|app| {
            let app = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let result =
                    tokio::time::timeout(std::time::Duration::from_secs(90), probe(app.clone()))
                        .await;
                let code = match result {
                    Ok(Ok(())) => 0,
                    error => {
                        eprintln!("FAIL: {error:?}");
                        1
                    }
                };
                app.exit(code);
            });
            Ok(())
        })
        .build(context)
        .expect("创建隐藏主题测试失败")
        .run(|_, _| {});
}
