//! 独立临时 Profile 的隐藏窗口回归，不打开主界面或读取用户浏览器数据。
#[path = "../../../../apps/browser/src-tauri/src/extension_runtime.rs"]
#[allow(dead_code)]
mod extension_runtime;

use std::{
    io::{Read, Write},
    path::PathBuf,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::Duration,
};
use tauri::{WebviewUrl, WebviewWindowBuilder};
use webview2_com::ExecuteScriptCompletedHandler;
use windows::core::HSTRING;

/// 本地测试站点记录后台脚本启动，同时为内容脚本提供普通 HTTP 页面。
fn server() -> (u16, Arc<AtomicUsize>) {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let count = Arc::new(AtomicUsize::new(0));
    let counter = count.clone();
    std::thread::spawn(move || {
        for mut stream in listener.incoming().flatten() {
            let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
            let mut buffer = [0u8; 4096];
            let length = stream.read(&mut buffer).unwrap_or(0);
            if String::from_utf8_lossy(&buffer[..length]).starts_with("GET /background") {
                counter.fetch_add(1, Ordering::SeqCst);
            }
            let body = "<!doctype html><html><body>Extension scope fixture</body></html>";
            let _ = write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
        }
    });
    (port, count)
}

/// 脚本回调只返回 JSON 字符串，所有 COM 访问都在 WebView2 的线程执行。
async fn marker(view: &tauri::Webview) -> Result<String, String> {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    view.with_webview(move |platform| unsafe {
        let handler = ExecuteScriptCompletedHandler::create(Box::new(move |status, result| {
            let _ = sender.send(status.map(|_| result).map_err(|error| error.to_string()));
            Ok(())
        }));
        if let Ok(core) = platform.controller().CoreWebView2() {
            let _ = core.ExecuteScript(&HSTRING::from("document.readyState === 'complete' ? (document.documentElement.dataset.extensionScope || 'absent') : 'loading'"), &handler);
        }
    }).map_err(|error| error.to_string())?;
    tokio::time::timeout(Duration::from_secs(10), receiver)
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())?
}

async fn expect_marker(view: &tauri::Webview, expected: &str) -> Result<(), String> {
    for _ in 0..80 {
        if marker(view).await? == format!("\"{expected}\"") {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    Err(format!(
        "页面扩展标记应为 {expected}，实际为 {}",
        marker(view).await?
    ))
}

fn hidden(
    app: &tauri::AppHandle,
    label: &str,
    directory: PathBuf,
) -> Result<tauri::WebviewWindow, String> {
    WebviewWindowBuilder::new(
        app,
        label,
        WebviewUrl::External("about:blank".parse().unwrap()),
    )
    .visible(false)
    .focused(false)
    .skip_taskbar(true)
    .data_directory(directory)
    .browser_extensions_enabled(true)
    .build()
    .map_err(|error| error.to_string())
}

async fn probe(app: tauri::AppHandle) -> Result<(), String> {
    let (port, starts) = server();
    let root =
        std::env::temp_dir().join(format!("sia-extension-scope-probe-{}", std::process::id()));
    std::fs::create_dir_all(root.join("extension")).map_err(|error| error.to_string())?;
    let extension = root.join("extension");
    // 固定一个受测扩展，同时验证内容脚本和后台脚本的真实运行状态。
    std::fs::write(extension.join("manifest.json"), r#"{"manifest_version":3,"name":"Scope fixture","version":"1.0","host_permissions":["http://127.0.0.1/*"],"background":{"service_worker":"background.js"},"content_scripts":[{"matches":["http://127.0.0.1/*"],"js":["content.js"],"run_at":"document_end"}]}"#).map_err(|error| error.to_string())?;
    std::fs::write(
        extension.join("content.js"),
        "document.documentElement.dataset.extensionScope = 'active';",
    )
    .map_err(|error| error.to_string())?;
    std::fs::write(
        extension.join("background.js"),
        format!("fetch('http://127.0.0.1:{port}/background').catch(() => {{}});"),
    )
    .map_err(|error| error.to_string())?;
    let url = format!("http://127.0.0.1:{port}/page");
    let allowed_dir = root.join("allowed");
    let denied_dir = root.join("denied");
    let allowed = hidden(&app, "probe-allowed", allowed_dir.clone())?;
    extension_runtime::synchronize(
        allowed.as_ref(),
        &allowed_dir,
        vec![("fixture".into(), extension.clone(), true)],
    )
    .await?;
    allowed
        .navigate(url.parse().unwrap())
        .map_err(|error| error.to_string())?;
    expect_marker(allowed.as_ref(), "active").await?;
    let denied = hidden(&app, "probe-denied", denied_dir.clone())?;
    extension_runtime::synchronize(
        denied.as_ref(),
        &denied_dir,
        vec![("fixture".into(), extension.clone(), false)],
    )
    .await?;
    denied
        .navigate(url.parse().unwrap())
        .map_err(|error| error.to_string())?;
    expect_marker(denied.as_ref(), "absent").await?;

    // 在活跃 Profile 撤销授权，然后恢复该磁盘 Profile，后台脚本不能重新启动。
    extension_runtime::synchronize(
        allowed.as_ref(),
        &allowed_dir,
        vec![("fixture".into(), extension.clone(), false)],
    )
    .await?;
    allowed.close().map_err(|error| error.to_string())?;
    tokio::time::sleep(Duration::from_secs(1)).await;
    let before = starts.load(Ordering::SeqCst);
    if before == 0 {
        return Err("测试扩展的后台脚本未成功启动，无法验证撤销场景".into());
    }
    let restored = hidden(&app, "probe-restored", allowed_dir.clone())?;
    extension_runtime::synchronize(
        restored.as_ref(),
        &allowed_dir,
        vec![("fixture".into(), extension.clone(), false)],
    )
    .await?;
    restored
        .navigate(url.parse().unwrap())
        .map_err(|error| error.to_string())?;
    expect_marker(restored.as_ref(), "absent").await?;
    tokio::time::sleep(Duration::from_secs(1)).await;
    if starts.load(Ordering::SeqCst) != before {
        return Err("撤销授权后恢复 Profile 仍启动了后台脚本".into());
    }
    extension_runtime::synchronize(
        restored.as_ref(),
        &allowed_dir,
        vec![("fixture".into(), extension, true)],
    )
    .await?;
    restored
        .navigate(format!("{url}?reenabled").parse().unwrap())
        .map_err(|error| error.to_string())?;
    expect_marker(restored.as_ref(), "active").await?;
    println!(
        "PASS: 允许/拒绝分组、撤销、恢复后后台禁用、再次启用；临时数据：{}",
        root.display()
    );
    Ok(())
}

fn main() {
    let mut context = tauri::generate_context!();
    // 测试程序不创建配置中的主窗口，所有测试窗口始终隐藏。
    context.config_mut().app.windows.clear();
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let result =
                    tokio::time::timeout(Duration::from_secs(90), probe(handle.clone())).await;
                let code = match result {
                    Ok(Ok(())) => 0,
                    other => {
                        eprintln!("FAIL: {other:?}");
                        1
                    }
                };
                handle.exit(code);
            });
            Ok(())
        })
        .build(context)
        .expect("创建隐藏测试运行时失败")
        .run(|_, _| {});
}
