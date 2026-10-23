//! 隐藏窗口回归：多个原生网页不能遮挡无边框窗口的八向缩放区域。
use tauri::Listener;
use tauri::{LogicalPosition, LogicalSize, WebviewBuilder, WebviewUrl, WebviewWindowBuilder};
use windows::{
    core::w,
    Win32::{Foundation::*, UI::WindowsAndMessaging::*},
};
#[path = "../../../../apps/browser/src-tauri/src/window_resize.rs"]
mod window_resize;

/// 读取直接子窗口层级；不移动鼠标、不显示窗口或读取用户浏览器。
async fn check_border(window: &tauri::Window, stage: &str) -> Result<(), String> {
    let hwnd = window.hwnd().map_err(|error| error.to_string())?.0 as usize;
    let (send, receive) = tokio::sync::oneshot::channel();
    window
        .run_on_main_thread(move || unsafe {
            let parent = HWND(hwnd as _);
            let result = (|| {
                let border =
                    FindWindowExW(Some(parent), None, w!("TAURI_DRAG_RESIZE_BORDERS"), None)
                        .map_err(|error| error.to_string())?;
                let first = GetWindow(parent, GW_CHILD).map_err(|error| error.to_string())?;
                if first != border {
                    return Err("原生网页覆盖了窗口缩放边缘".into());
                }
                let mut rect = RECT::default();
                GetWindowRect(border, &mut rect).map_err(|error| error.to_string())?;
                let mid_x = (rect.left + rect.right) / 2;
                let mid_y = (rect.top + rect.bottom) / 2;
                // 原生区域必须镂空，窗口中央继续接收网页点击和侧栏交互。
                use windows::Win32::Graphics::Gdi::{
                    CreateRectRgn, DeleteObject, GetWindowRgn, PtInRegion,
                };
                let region = CreateRectRgn(0, 0, 0, 0);
                let kind = GetWindowRgn(border, region);
                let center_blocked = PtInRegion(
                    region,
                    (rect.right - rect.left) / 2,
                    (rect.bottom - rect.top) / 2,
                )
                .as_bool();
                let _ = DeleteObject(region.into());
                if kind.0 == 0 || center_blocked {
                    return Err("缩放边缘未镂空，会拦截网页点击".into());
                }
                // 八向命中必须仍交给 Tauri 的原生边框处理，不能退化成网页客户区。
                for (x, y, expected) in [
                    (rect.left + 1, mid_y, HTLEFT),
                    (rect.right - 1, mid_y, HTRIGHT),
                    (mid_x, rect.top + 1, HTTOP),
                    (mid_x, rect.bottom - 1, HTBOTTOM),
                    (rect.left + 1, rect.top + 1, HTTOPLEFT),
                    (rect.right - 1, rect.top + 1, HTTOPRIGHT),
                    (rect.left + 1, rect.bottom - 1, HTBOTTOMLEFT),
                    (rect.right - 1, rect.bottom - 1, HTBOTTOMRIGHT),
                ] {
                    let point =
                        LPARAM((((y as u32 & 0xffff) << 16) | (x as u32 & 0xffff)) as isize);
                    let actual = SendMessageW(border, WM_NCHITTEST, None, Some(point));
                    if actual.0 != expected as isize {
                        return Err(format!("缩放方向错误：{actual:?} != {expected}"));
                    }
                }
                Ok(())
            })();
            let _ = send.send(result);
        })
        .map_err(|error| error.to_string())?;
    receive
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error: String| format!("{stage}: {error}"))
}

async fn probe(app: tauri::AppHandle) -> Result<(), String> {
    let edges = std::sync::Arc::new(std::sync::Mutex::new(Vec::<String>::new()));
    let captured = edges.clone();
    app.listen("sia://window-resize-edges", move |event| {
        captured
            .lock()
            .unwrap()
            .push(serde_json::from_str(event.payload()).unwrap());
    });
    let directory = std::env::temp_dir().join(format!("sia-resize-probe-{}", std::process::id()));
    let host = WebviewWindowBuilder::new(
        &app,
        "resize-probe",
        WebviewUrl::External("about:blank".parse().unwrap()),
    )
    .visible(false)
    .focused(false)
    .skip_taskbar(true)
    .decorations(false)
    .shadow(false)
    .resizable(true)
    .inner_size(1380.0, 860.0)
    .min_inner_size(960.0, 640.0)
    .data_directory(directory.clone())
    .build()
    .map_err(|error| error.to_string())?;
    let window = host.as_ref().window();
    let (send, receive) = tokio::sync::oneshot::channel();
    host.run_on_main_thread(move || {
        let _ = send.send(window_resize::initialize(&window));
    })
    .map_err(|error| error.to_string())?;
    receive.await.map_err(|error| error.to_string())??;
    check_border(&host.as_ref().window(), "初始窗口").await?;
    // 只给隐藏测试窗口发送悬停消息；不移动用户鼠标或进入系统拖动循环。
    let hwnd = host.hwnd().map_err(|error| error.to_string())?.0 as usize;
    let (send_hover, receive_hover) = tokio::sync::oneshot::channel();
    host.run_on_main_thread(move || unsafe {
        let border = FindWindowExW(
            Some(HWND(hwnd as _)),
            None,
            w!("TAURI_DRAG_RESIZE_BORDERS"),
            None,
        )
        .unwrap();
        for hit in [
            HTLEFT,
            HTRIGHT,
            HTTOP,
            HTBOTTOM,
            HTTOPLEFT,
            HTTOPRIGHT,
            HTBOTTOMLEFT,
            HTBOTTOMRIGHT,
        ] {
            SendMessageW(
                border,
                WM_NCMOUSEMOVE,
                Some(WPARAM(hit as usize)),
                Some(LPARAM(0)),
            );
        }
        SendMessageW(border, WM_NCMOUSELEAVE, None, None);
        let _ = send_hover.send(());
    })
    .map_err(|error| error.to_string())?;
    receive_hover.await.map_err(|error| error.to_string())?;
    for expected in [
        "left",
        "right",
        "top",
        "bottom",
        "left top",
        "right top",
        "left bottom",
        "right bottom",
        "",
    ] {
        if !edges.lock().unwrap().iter().any(|edge| edge == expected) {
            return Err(format!("缩放边缘悬停没有通知界面：{expected:?}"));
        }
    }
    let page = host
        .as_ref()
        .window()
        .add_child(
            WebviewBuilder::new(
                "resize-page",
                WebviewUrl::External("about:blank".parse().unwrap()),
            )
            .data_directory(directory.join("page")),
            LogicalPosition::new(240.0, 48.0),
            LogicalSize::new(1140.0, 812.0),
        )
        .map_err(|error| error.to_string())?;
    check_border(&host.as_ref().window(), "创建标签网页后").await?;
    // 模拟侧栏和模态覆盖层显式提升原生 WebView 的操作。
    page.with_webview(|view| unsafe {
        let mut hwnd = HWND::default();
        view.controller().ParentWindow(&mut hwnd).unwrap();
        SetWindowPos(
            hwnd,
            Some(HWND_TOP),
            0,
            0,
            0,
            0,
            SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE,
        )
        .unwrap();
    })
    .map_err(|error| error.to_string())?;
    check_border(&host.as_ref().window(), "提升原生面板后").await?;
    host.set_size(LogicalSize::new(1100.0, 700.0))
        .map_err(|error| error.to_string())?;
    check_border(&host.as_ref().window(), "调整宽高后").await?;
    // 反复创建、隐藏、显示和销毁页面，覆盖切换标签和休眠恢复时的原生生命周期。
    for index in 0..3 {
        let restored = host
            .as_ref()
            .window()
            .add_child(
                WebviewBuilder::new(
                    format!("resize-restored-{index}"),
                    WebviewUrl::External("about:blank".parse().unwrap()),
                )
                .data_directory(directory.join("restored")),
                LogicalPosition::new(0.0, 0.0),
                LogicalSize::new(1100.0, 700.0),
            )
            .map_err(|error| error.to_string())?;
        restored.hide().map_err(|error| error.to_string())?;
        restored.show().map_err(|error| error.to_string())?;
        check_border(&host.as_ref().window(), "网页重建和显示后").await?;
        restored.close().map_err(|error| error.to_string())?;
        check_border(&host.as_ref().window(), "关闭网页后").await?;
    }
    println!("PASS: 标签创建/关闭/重建、面板提升、宽高变化后八向缩放有效，中央区域保持点击穿透");
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
        .expect("创建隐藏缩放测试失败")
        .run(|_, _| {});
}
