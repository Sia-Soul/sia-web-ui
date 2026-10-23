//! 隐藏原生网页验证自定义图标路径、Profile Cookie 和动态图标更新，不访问用户站点。
#[path = "../../../../apps/browser/src-tauri/src/browser_favicon.rs"]
mod browser_favicon;
use std::sync::{Arc, Mutex};
use tauri::{Listener, WebviewUrl, WebviewWindowBuilder};

/// 图标必须带有测试站点 Cookie 才能读取；根目录图标返回 404。
fn server() -> String {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    std::thread::spawn(move || {
        for mut stream in listener.incoming().flatten() {
            let _ = stream.set_read_timeout(Some(std::time::Duration::from_secs(2)));
            let mut buffer = [0u8; 8192];
            let count = stream.read(&mut buffer).unwrap_or(0);
            let request = String::from_utf8_lossy(&buffer[..count]);
            let path = request.split_whitespace().nth(1).unwrap_or("");
            let authenticated = request
                .to_ascii_lowercase()
                .contains("cookie: icon-test=yes");
            let (status, mime, body, extra): (&str, &str, &[u8], &str) = match path {
                "/login" => ("302 Found", "text/html", b"", "Location: /app\r\nSet-Cookie: icon-test=yes; Path=/\r\n"),
                "/app" => ("200 OK", "text/html", b"<!doctype html><link id='icon' rel='icon' type='image/png' href='/assets/custom.png'><title>Favicon fixture</title>", ""),
                "/assets/custom.png" if authenticated => ("200 OK", "image/png", include_bytes!("../../../../apps/browser/src-tauri/icons/32x32.png"), ""),
                "/assets/second.png" if authenticated => ("200 OK", "image/png", include_bytes!("../../../../apps/browser/src-tauri/icons/64x64.png"), ""),
                _ => ("404 Not Found", "text/plain", b"", ""),
            };
            let header = format!("HTTP/1.1 {status}\r\nContent-Type: {mime}\r\nContent-Length: {}\r\n{extra}Connection: close\r\n\r\n", body.len());
            let _ = stream.write_all(header.as_bytes());
            let _ = stream.write_all(body);
        }
    });
    format!("http://{address}")
}

/// 等待至少一次有效 PNG 更新，排除导航时内核可能先发出的空图标。
async fn next_icon(
    events: &Mutex<Vec<serde_json::Value>>,
    previous: Option<&str>,
) -> Result<String, String> {
    for _ in 0..300 {
        if let Some(icon) = events
            .lock()
            .unwrap()
            .iter()
            .filter_map(|event| event["faviconUrl"].as_str())
            .find(|value| value.starts_with("data:image/png;base64,") && Some(*value) != previous)
            .map(str::to_owned)
        {
            return Ok(icon);
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    Err("未收到实际内核图标更新".into())
}

async fn probe(app: tauri::AppHandle) -> Result<(), String> {
    let base = server();
    let events = Arc::new(Mutex::new(Vec::<serde_json::Value>::new()));
    let captured = events.clone();
    let expected_url = format!("{base}/app");
    app.listen("sia://browser-event", move |event| {
        let value: serde_json::Value = serde_json::from_str(event.payload()).unwrap();
        if value["kind"] == "favicon" && value["url"] == expected_url {
            captured.lock().unwrap().push(value);
        }
    });
    let view = WebviewWindowBuilder::new(
        &app,
        "favicon-probe",
        WebviewUrl::External("about:blank".parse().unwrap()),
    )
    .visible(false)
    .focused(false)
    .skip_taskbar(true)
    .data_directory(std::env::temp_dir().join(format!("sia-favicon-probe-{}", std::process::id())))
    .build()
    .map_err(|error| error.to_string())?;
    browser_favicon::attach(&app, view.as_ref(), "test-tab".into()).await?;
    view.navigate(format!("{base}/login").parse().unwrap())
        .map_err(|error| error.to_string())?;
    let first = next_icon(&events, None).await?;
    events.lock().unwrap().clear();
    view.eval("document.getElementById('icon').href = '/assets/second.png'")
        .map_err(|error| error.to_string())?;
    next_icon(&events, Some(&first)).await?;
    println!("PASS: 登录跳转、需要 Cookie 的自定义 PNG 图标、加载完成后动态换图标");
    Ok(())
}

fn main() {
    tauri::Builder::default()
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
        .build(tauri::generate_context!())
        .expect("创建隐藏图标测试失败")
        .run(|_, _| {});
}
