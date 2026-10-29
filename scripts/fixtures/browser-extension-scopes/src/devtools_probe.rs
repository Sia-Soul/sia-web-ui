//! 真实 WebView2 回归：验证停靠父级、标签隐藏、解除停靠与关闭重开。
#[path = "../../../../apps/browser/src-tauri/src/browser_devtools.rs"]
mod browser_devtools;
// 使用与产品相同的窗口状态容器，验证停靠会话的归属。
#[path = "../../../../apps/browser/src-tauri/src/window_context.rs"]
mod window_context;
use tauri::{LogicalPosition, LogicalSize, WebviewBuilder, WebviewUrl, WebviewWindowBuilder};
use windows::{
    core::BOOL,
    Win32::{
        Foundation::{HWND, LPARAM},
        UI::WindowsAndMessaging::*,
    },
};

/// 高频采样本测试内核的顶层工具，透明准备窗口不计为可见闪现。
fn visible_standalone(pid: u32) -> bool {
    unsafe extern "system" fn visit(handle: HWND, data: LPARAM) -> BOOL {
        let state = &mut *(data.0 as *mut (u32, bool));
        let mut owner = 0;
        GetWindowThreadProcessId(handle, Some(&mut owner));
        let mut title = [0u16; 2048];
        let count = GetWindowTextW(handle, &mut title).max(0) as usize;
        if owner == state.0
            && String::from_utf16_lossy(&title[..count]).starts_with("DevTools")
            && GetWindowLongW(handle, GWL_STYLE) as u32 & WS_VISIBLE.0 != 0
        {
            let mut alpha = 255u8;
            let mut flags = LAYERED_WINDOW_ATTRIBUTES_FLAGS(0);
            let masked = GetWindowLongW(handle, GWL_EXSTYLE) as u32 & WS_EX_LAYERED.0 != 0
                && GetLayeredWindowAttributes(handle, None, Some(&mut alpha), Some(&mut flags))
                    .is_ok()
                && flags.0 & LWA_ALPHA.0 != 0
                && alpha == 0;
            state.1 |= !masked;
        }
        BOOL(1)
    }
    let mut state = (pid, false);
    unsafe {
        let _ = EnumWindows(Some(visit), LPARAM(&mut state as *mut _ as isize));
    }
    state.1
}

/// 测试标签与真实标签使用同样的命名查找约定。
fn browser_label(id: &str) -> String {
    format!("page-{id}")
}

/// 只检查本测试窗口的直接子级，不枚举用户浏览器。
fn tools(parent: isize) -> Vec<isize> {
    unsafe extern "system" fn visit(hwnd: HWND, data: LPARAM) -> BOOL {
        let state = &mut *(data.0 as *mut (isize, Vec<isize>));
        let mut title = [0u16; 1024];
        let length = GetWindowTextW(hwnd, &mut title);
        if GetParent(hwnd).ok() == Some(HWND(state.0 as _))
            && length > 0
            && String::from_utf16_lossy(&title[..length as usize]).starts_with("DevTools")
        {
            state.1.push(hwnd.0 as isize);
        }
        BOOL(1)
    }
    let mut state = (parent, Vec::new());
    unsafe {
        let _ = EnumChildWindows(
            Some(HWND(parent as _)),
            Some(visit),
            LPARAM(&mut state as *mut _ as isize),
        );
    }
    state.1
}

/// 停靠后的可见裁剪区必须与网页渲染子窗口重合，不能露出自绘标题栏或遮住工具内容。
fn assert_content_region(handle: isize, parent: isize, expected: [i32; 4]) -> Result<(), String> {
    unsafe {
        use windows::Win32::{
            Foundation::{POINT, RECT},
            Graphics::Gdi::*,
        };
        unsafe extern "system" fn find_content(child: HWND, data: LPARAM) -> BOOL {
            let mut name = [0u16; 128];
            let length = GetClassNameW(child, &mut name);
            if String::from_utf16_lossy(&name[..length as usize]) == "Chrome_RenderWidgetHostHWND" {
                let output = &mut *(data.0 as *mut Option<RECT>);
                let mut rect = RECT::default();
                if GetWindowRect(child, &mut rect).is_ok() {
                    *output = Some(rect);
                }
            }
            BOOL(1)
        }
        let child = HWND(handle as _);
        let mut outer = RECT::default();
        let mut region = RECT::default();
        let mut origin = POINT::default();
        GetWindowRect(child, &mut outer).map_err(|e| e.to_string())?;
        let _ = ClientToScreen(HWND(parent as _), &mut origin);
        if GetWindowRgnBox(child, &mut region) != SIMPLEREGION {
            return Err("开发者工具没有内容裁剪区".into());
        }
        let visible = [
            outer.left + region.left - origin.x,
            outer.top + region.top - origin.y,
            region.right - region.left,
            region.bottom - region.top,
        ];
        if visible != expected {
            return Err(format!("工具可见区域错位：{visible:?} != {expected:?}"));
        }
        let mut content: Option<RECT> = None;
        let _ = EnumChildWindows(
            Some(child),
            Some(find_content),
            LPARAM(&mut content as *mut _ as isize),
        );
        let content = content.ok_or("没有找到工具网页内容")?;
        let actual = [
            content.left - outer.left,
            content.top - outer.top,
            content.right - outer.left,
            content.bottom - outer.top,
        ];
        let clipped = [region.left, region.top, region.right, region.bottom];
        // Chromium 在非整数 DPI 下对内容边界取整，允许一物理像素舍入误差。
        if actual.iter().zip(clipped).any(|(a, b)| (*a - b).abs() > 1) {
            return Err(format!(
                "标题栏仍可见或工具内容被裁掉：content={actual:?}, clip={clipped:?}"
            ));
        }
        Ok(())
    }
}
async fn probe(raw_app: tauri::AppHandle) -> Result<(), String> {
    let app = window_context::BrowserContext::new(&raw_app, "main");
    // 使用真实 HTTP 文档校验 DevTools 的地址标题，不能只依赖 about:blank。
    let listener = std::net::TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    std::thread::spawn(move || {
        use std::io::{Read, Write};
        for mut stream in listener.incoming().flatten() {
            let _ = stream.set_read_timeout(Some(std::time::Duration::from_secs(2)));
            let mut request = [0u8; 4096];
            let _ = stream.read(&mut request);
            let body = "<!doctype html><html><body>DevTools HTTP test</body></html>";
            let _ = write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
        }
    });
    let directory = std::env::temp_dir().join(format!("sia-devtools-probe-{}", std::process::id()));
    let host = WebviewWindowBuilder::new(
        app.raw(),
        "main",
        WebviewUrl::External("about:blank".parse().unwrap()),
    )
    .visible(false)
    .focused(false)
    .skip_taskbar(true)
    .inner_size(1200., 800.)
    .data_directory(directory.join("shell"))
    .build()
    .map_err(|e| e.to_string())?;
    for id in ["one", "two"] {
        host.as_ref()
            .window()
            .add_child(
                WebviewBuilder::new(
                    browser_label(id),
                    WebviewUrl::External(format!("http://127.0.0.1:{port}/{id}").parse().unwrap()),
                )
                .data_directory(directory.join("pages"))
                .devtools(true),
                LogicalPosition::new(0., 0.),
                LogicalSize::new(800., 400.),
            )
            .map_err(|e| e.to_string())?;
    }
    let parent = host.hwnd().map_err(|e| e.to_string())?.0 as isize;
    tokio::time::sleep(std::time::Duration::from_millis(600)).await;
    // 在调用打开前启动采样，防止只检查最终停靠状态而漏掉中间独立窗口。
    let (send, receive) = tokio::sync::oneshot::channel();
    tauri::Manager::get_webview(app.raw(), &browser_label("one"))
        .unwrap()
        .with_webview(move |view| unsafe {
            let mut pid = 0;
            view.controller()
                .CoreWebView2()
                .unwrap()
                .BrowserProcessId(&mut pid)
                .unwrap();
            let _ = send.send(pid);
        })
        .map_err(|e| e.to_string())?;
    let pid = receive.await.map_err(|e| e.to_string())?;
    let sampling = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true));
    let running = sampling.clone();
    let sampler = std::thread::spawn(move || {
        let mut flashed = false;
        while running.load(std::sync::atomic::Ordering::Relaxed) {
            flashed |= visible_standalone(pid);
            std::thread::sleep(std::time::Duration::from_millis(1));
        }
        flashed
    });
    // 同 Profile 的两个标签共享内核进程，不能将第一份工具分配给第二个标签。
    for id in ["one", "two"] {
        if !browser_devtools::open_browser_devtools(app.clone(), id.into()).await? {
            return Err(format!("{id} 没有成功停靠"));
        }
    }
    sampling.store(false, std::sync::atomic::Ordering::Relaxed);
    if sampler.join().map_err(|_| "采样线程失败")? {
        return Err("准备停靠期间出现可见独立开发者工具窗口".into());
    }
    let handles = tools(parent);
    if handles.len() != 2 {
        return Err(format!("工具父级不正确：发现 {} 个", handles.len()));
    }
    let bounds = || {
        serde_json::from_value(
            serde_json::json!({ "x": 20, "y": 430, "width": 1100, "height": 300 }),
        )
        .unwrap()
    };
    let status =
        browser_devtools::layout_browser_devtools(app.clone(), "one".into(), Some(bounds()))
            .await?;
    if status.len() != 2 {
        return Err("标签会话丢失".into());
    }
    // 窗口消息异步执行，等待真实客户区坐标和显示位落地后再断言。
    for _ in 0..4 {
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        browser_devtools::layout_browser_devtools(app.clone(), "one".into(), Some(bounds()))
            .await?;
    }
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    let shown = handles
        .iter()
        .copied()
        .filter(|handle| unsafe {
            GetWindowLongW(HWND(*handle as _), GWL_STYLE) as u32 & WS_VISIBLE.0 != 0
        })
        .collect::<Vec<_>>();
    if shown.len() != 1 {
        return Err(format!(
            "当前标签应该只显示一份开发者工具，实际 {} 份",
            shown.len()
        ));
    }
    // 就绪既要报告给占位界面，也必须真正解除原生透明，不能以“仍不可见”伪造无闪现。
    let status =
        browser_devtools::layout_browser_devtools(app.clone(), "one".into(), Some(bounds()))
            .await?;
    let status = serde_json::to_value(status).map_err(|e| e.to_string())?;
    if !status
        .as_array()
        .unwrap()
        .iter()
        .any(|item| item["tabId"] == "one" && item["ready"] == true)
    {
        return Err("工具内容完成布局后未报告就绪".into());
    }
    unsafe {
        let child = HWND(shown[0] as _);
        let mut alpha = 255;
        let mut flags = LAYERED_WINDOW_ATTRIBUTES_FLAGS(0);
        if GetWindowLongW(child, GWL_EXSTYLE) as u32 & WS_EX_LAYERED.0 != 0
            && GetLayeredWindowAttributes(child, None, Some(&mut alpha), Some(&mut flags)).is_ok()
            && flags.0 & LWA_ALPHA.0 != 0
            && alpha == 0
        {
            return Err("停靠就绪后仍然完全透明".into());
        }
    }
    let scale = host.scale_factor().map_err(|e| e.to_string())?;
    let expected = [20., 430., 1100., 300.].map(|value| (value * scale).round() as i32);
    assert_content_region(shown[0], parent, expected)?;
    // 内核可能在窗口消息中重设裁剪区；即使布局未改变，也必须重新隐藏窗框。
    unsafe {
        windows::Win32::Graphics::Gdi::SetWindowRgn(HWND(shown[0] as _), None, true);
    }
    for _ in 0..3 {
        browser_devtools::layout_browser_devtools(app.clone(), "one".into(), Some(bounds()))
            .await?;
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    }
    assert_content_region(shown[0], parent, expected)?;
    // 后台标签只隐藏，切回时复用同一 HWND。
    browser_devtools::layout_browser_devtools(app.clone(), "two".into(), Some(bounds())).await?;
    browser_devtools::layout_browser_devtools(app.clone(), "none".into(), None).await?;
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    if handles.iter().any(|handle| unsafe {
        GetWindowLongW(HWND(*handle as _), GWL_STYLE) as u32 & WS_VISIBLE.0 != 0
    }) {
        return Err("切到没有工具的标签后仍残留工具窗口".into());
    }
    browser_devtools::control_browser_devtools(app.clone(), "one".into(), "detach".into()).await?;
    if tools(parent).len() != 1 {
        return Err("解除停靠未恢复独立窗口".into());
    }
    // 独立模式必须重新具备系统标题栏，且不能沿用内容区域的裁剪。
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    unsafe {
        use windows::Win32::{Foundation::RECT, Graphics::Gdi::*};
        let detached = HWND(shown[0] as _);
        let mut region = RECT::default();
        if GetWindowLongW(detached, GWL_STYLE) as u32 & WS_CAPTION.0 != WS_CAPTION.0
            || (GetWindowRgnBox(detached, &mut region) == SIMPLEREGION && region.top > 0)
        {
            return Err("独立窗口没有恢复完整标题栏".into());
        }
    }
    if !browser_devtools::open_browser_devtools(app.clone(), "one".into()).await? {
        return Err("无法重新停靠".into());
    }
    if tools(parent).len() != 2 {
        return Err("重新停靠后 HWND 丢失".into());
    }
    // 重新停靠与切换右侧尺寸后仍只显示网页内容，不出现蓝色窗框。
    let right_bounds = || {
        serde_json::from_value(serde_json::json!({"x": 700, "y": 30, "width": 450, "height": 700}))
            .unwrap()
    };
    for _ in 0..5 {
        browser_devtools::layout_browser_devtools(app.clone(), "one".into(), Some(right_bounds()))
            .await?;
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    }
    assert_content_region(
        shown[0],
        parent,
        [700., 30., 450., 700.].map(|value| (value * scale).round() as i32),
    )?;
    for id in ["one", "two"] {
        browser_devtools::control_browser_devtools(app.clone(), id.into(), "close".into()).await?;
    }
    tokio::time::sleep(std::time::Duration::from_millis(800)).await;
    if !tools(parent).is_empty() {
        return Err("关闭后仍有工具窗口".into());
    }
    if !browser_devtools::open_browser_devtools(app.clone(), "one".into()).await? {
        return Err("关闭后无法重新打开".into());
    }
    browser_devtools::control_browser_devtools(app.clone(), "one".into(), "close".into()).await?;
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    // 切换页面取消准备；取消窗口须被关闭，随后打开同一标签能重新正常停靠。
    let opening_app = app.clone();
    let opening = tauri::async_runtime::spawn(async move {
        browser_devtools::open_browser_devtools(opening_app, "one".into()).await
    });
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    browser_devtools::cancel_pending_except(&app, None);
    if opening.await.map_err(|e| e.to_string())?? {
        return Err("切换页面后仍认领旧工具".into());
    }
    tokio::time::sleep(std::time::Duration::from_millis(700)).await;
    if visible_standalone(pid) {
        return Err("取消准备后遗留独立窗口".into());
    }
    let started = std::time::Instant::now();
    if !browser_devtools::open_browser_devtools(app.clone(), "one".into()).await? {
        return Err("取消后遗留窗口阻止重新停靠".into());
    }
    if started.elapsed() > std::time::Duration::from_secs(2) {
        return Err("取消后重新打开仍在等待发现超时".into());
    }
    browser_devtools::control_browser_devtools(app.clone(), "one".into(), "close".into()).await?;
    for id in ["one", "two"] {
        // 显式销毁临时网页，让 Chromium 完成子窗口清理后再退出测试进程。
        if let Some(view) = tauri::Manager::get_webview(app.raw(), &browser_label(id)) {
            view.close().map_err(|e| e.to_string())?;
        }
    }
    println!("PASS 真实 WebView2 准备期间无可见独立窗口、就绪解除透明、无标题栏停靠、内容完整性、裁剪恢复、底部/右侧 DPI 坐标、后台隐藏、独立标题栏恢复、关闭重开及切页取消清理");
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(window_context::WindowStates::default())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let result =
                    tokio::time::timeout(std::time::Duration::from_secs(60), probe(handle.clone()))
                        .await;
                match result {
                    Ok(Ok(())) => handle.exit(0),
                    other => {
                        eprintln!("FAIL {other:?}");
                        handle.exit(1);
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("启动停靠回归");
}
