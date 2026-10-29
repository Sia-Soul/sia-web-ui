//! 同进程拆窗：只迁移现有 WebView 的父窗口，不导航、不重建网页。
use crate::window_context::BrowserContext;
use std::{
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

#[derive(Default)]
pub struct DetachedWindowRuntime {
    transfer: tokio::sync::Mutex<()>,
    drag_generation: AtomicU64,
    drag_cancelled: AtomicBool,
}
#[derive(Default)]
pub struct TransferState {
    ready: AtomicBool,
    moving: AtomicBool,
    live: AtomicBool,
    failure: Mutex<Option<String>>,
}
/// 窗口迁移期间阻止关闭；提前返回同样释放保护。
struct MovingGuard(Arc<TransferState>);
impl MovingGuard {
    fn new(app: &BrowserContext) -> Self {
        let state = app.window_state::<TransferState>();
        state.moving.store(true, Ordering::SeqCst);
        Self(state)
    }
}
impl Drop for MovingGuard {
    fn drop(&mut self) {
        self.0.moving.store(false, Ordering::SeqCst);
    }
}
pub fn awaiting_receiver(app: &BrowserContext) -> bool {
    let state = app.window_state::<TransferState>();
    state.live.load(Ordering::SeqCst)
        && state.moving.load(Ordering::SeqCst)
        && !state.ready.load(Ordering::SeqCst)
}
fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 80 && id.bytes().all(|b| b.is_ascii_hexdigit() || b == b'-')
}
fn directory(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("detached-windows")
        .join(id))
}
pub fn state_path(app: &BrowserContext) -> Result<Option<PathBuf>, String> {
    app.owner()
        .strip_prefix("sia-window-")
        .map(|id| directory(app.raw(), id).map(|dir| dir.join("state.json")))
        .transpose()
}

/// 每个浏览器窗口分别持有辅助视图和初始化屏障。
fn create_window(app: &AppHandle, id: &str, live: bool) -> Result<BrowserContext, String> {
    let label = format!("sia-window-{id}");
    let context = BrowserContext::new(app, &label);
    context
        .window_state::<TransferState>()
        .live
        .store(live, Ordering::SeqCst);
    context
        .window_state::<TransferState>()
        .moving
        .store(live, Ordering::SeqCst);
    let mut config = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "main")
        .ok_or("缺少主窗口配置")?
        .clone();
    config.label = label;
    config.visible = false;
    config.create = true;
    tauri::WebviewWindowBuilder::from_config(app, &config)
        .map_err(|e| e.to_string())?
        .initialization_script(format!(
            "window.__SIA_DETACHED_WINDOW__ = true; window.__SIA_LIVE_TRANSFER__ = {live};"
        ))
        .build()
        .map_err(|e| e.to_string())?;
    if let Err(error) = initialize_window(&context) {
        context
            .window_state::<crate::browser_startup::BrowserStartup>()
            .finish(Err(error.clone()));
        if let Some(window) = context.get_window("main") {
            let _ = window.destroy();
        }
        return Err(error);
    }
    Ok(context)
}

pub fn initialize_window(context: &BrowserContext) -> Result<(), String> {
    let main = context.get_window("main").ok_or("找不到浏览器窗口")?;
    crate::window_resize::initialize(&main)?;
    if let Some(shell) = context.get_webview("main") {
        crate::browser_drop::attach(context.raw(), &shell)?;
    }
    let owner = context.clone();
    main.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            if owner
                .window_state::<TransferState>()
                .moving
                .load(Ordering::SeqCst)
            {
                api.prevent_close();
            }
        }
        if matches!(event, tauri::WindowEvent::Destroyed) {
            // 只销毁本窗口的辅助窗口，其他浏览器窗口及其网页继续运行。
            for name in ["browser-menu", "sia-tab-tooltip-window"] {
                if let Some(window) = owner.get_window(name) {
                    let _ = window.destroy();
                }
            }
            if let Ok(Some(path)) = state_path(&owner) {
                let _ = fs::remove_file(path);
            }
        }
    });
    crate::browser_overlay::initialize(context)?;
    crate::floating_windows::initialize(context)?;
    Ok(())
}

/// 恢复上次留存的窗口；启动恢复允许重载，运行中的拆窗不经过恢复导航。
pub fn initialize(app: &AppHandle) -> Result<(), String> {
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("detached-windows");
    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.flatten() {
            let id = entry.file_name().to_string_lossy().into_owned();
            if !valid_id(&id) || !entry.path().join("state.json").is_file() {
                continue;
            }
            if let Ok(context) = create_window(app, &id, false) {
                context
                    .window_state::<crate::browser_startup::BrowserStartup>()
                    .finish(Ok(()));
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn present_detached_window(app: BrowserContext) -> Result<(), String> {
    let Some(id) = app.owner().strip_prefix("sia-window-") else {
        return Ok(());
    };
    let window = app.get_window("main").ok_or("找不到独立窗口")?;
    if let Ok(content) = fs::read_to_string(directory(app.raw(), id)?.join("position.json")) {
        if let Ok([mut x, mut y]) = serde_json::from_str::<[i32; 2]>(&content) {
            if let Ok(monitors) = window.available_monitors() {
                if let Some(monitor) = monitors
                    .iter()
                    .find(|m| {
                        let a = m.work_area();
                        x >= a.position.x
                            && x < a.position.x + a.size.width as i32
                            && y >= a.position.y
                            && y < a.position.y + a.size.height as i32
                    })
                    .or_else(|| monitors.first())
                {
                    let a = monitor.work_area();
                    let size = window.outer_size().map_err(|e| e.to_string())?;
                    x = x.clamp(
                        a.position.x,
                        a.position.x + a.size.width.saturating_sub(size.width) as i32,
                    );
                    y = y.clamp(
                        a.position.y,
                        a.position.y + a.size.height.saturating_sub(size.height) as i32,
                    );
                }
            }
            window
                .set_position(tauri::PhysicalPosition::new(x, y))
                .map_err(|e| e.to_string())?;
        }
    }
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn acknowledge_detached_window(app: BrowserContext) {
    app.window_state::<TransferState>()
        .ready
        .store(true, Ordering::SeqCst);
    crate::replay_transferred_events(&app);
}

/// 开始记录拖动的取消状态，后续拖动会使旧记录任务自动退出。
/// OLE 拖动循环可能吞掉 DOM 键盘事件，因此原生记录整个拖动期间的 Escape。
#[tauri::command]
pub fn begin_browser_tree_drag(app: BrowserContext) {
    let runtime = app.state::<DetachedWindowRuntime>();
    let generation = runtime.drag_generation.fetch_add(1, Ordering::SeqCst) + 1;
    runtime.drag_cancelled.store(false, Ordering::SeqCst);
    #[cfg(windows)]
    tauri::async_runtime::spawn(async move {
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            GetAsyncKeyState, VK_ESCAPE, VK_LBUTTON,
        };
        for _ in 0..60000 {
            let state = app.state::<DetachedWindowRuntime>();
            if state.drag_generation.load(Ordering::SeqCst) != generation {
                break;
            }
            if unsafe { GetAsyncKeyState(VK_ESCAPE.0 as i32) } < 0 {
                state.drag_cancelled.store(true, Ordering::SeqCst);
                break;
            }
            if unsafe { GetAsyncKeyState(VK_LBUTTON.0 as i32) } >= 0 {
                break;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    });
    #[cfg(not(windows))]
    let _ = generation;
}

/// 拖动期间已取消，或释放点仍在主窗口内时，返回空落点。
#[tauri::command]
pub fn browser_drag_outside(app: BrowserContext) -> Result<Option<[i32; 2]>, String> {
    if app
        .state::<DetachedWindowRuntime>()
        .drag_cancelled
        .load(Ordering::SeqCst)
    {
        return Ok(None);
    }
    #[cfg(windows)]
    {
        use windows::Win32::{
            Foundation::{POINT, RECT},
            UI::{
                Input::KeyboardAndMouse::{GetAsyncKeyState, VK_ESCAPE, VK_LBUTTON},
                WindowsAndMessaging::{GetCursorPos, GetWindowRect},
            },
        };
        unsafe {
            if GetAsyncKeyState(VK_ESCAPE.0 as i32) < 0 || GetAsyncKeyState(VK_LBUTTON.0 as i32) < 0
            {
                return Ok(None);
            }
            let mut point = POINT::default();
            GetCursorPos(&mut point).map_err(|error| error.to_string())?;
            let window = app.get_window("main").ok_or("找不到浏览器窗口")?;
            let mut rect = RECT::default();
            GetWindowRect(window.hwnd().map_err(|error| error.to_string())?, &mut rect)
                .map_err(|error| error.to_string())?;
            if point.x >= rect.left
                && point.x < rect.right
                && point.y >= rect.top
                && point.y < rect.bottom
            {
                return Ok(None);
            }
            return Ok(Some([point.x, point.y]));
        }
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Ok(None)
    }
}

/// 目标壳层完成布局和接收确认后才交接；任何准备失败都将网页退回源窗口。
#[tauri::command]
pub async fn detach_browser_window(
    app: BrowserContext,
    state: serde_json::Value,
    source_active_id: String,
    position: Option<[i32; 2]>,
) -> Result<(), String> {
    let runtime = app.state::<DetachedWindowRuntime>();
    let _guard = runtime.transfer.lock().await;
    let tabs = state["tabs"]
        .as_array()
        .filter(|tabs| !tabs.is_empty())
        .ok_or("独立窗口会话缺少页签")?;
    let mut ids = Vec::new();
    for tab in tabs {
        ids.push(tab["id"].as_str().ok_or("页签标识无效")?.to_string());
    }
    let id = format!(
        "{:x}-{:x}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos(),
        std::process::id()
    );
    let dir = directory(app.raw(), &id)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::write(
        dir.join("state.json"),
        serde_json::to_vec_pretty(&state).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    if let Some([x, y]) = position {
        fs::write(
            dir.join("position.json"),
            serde_json::to_vec(&[x.saturating_sub(120), y.saturating_sub(20)]).unwrap(),
        )
        .map_err(|e| e.to_string())?;
    }
    let source = app.get_window("main").ok_or("原窗口已经关闭")?;
    let _source_guard = MovingGuard::new(&app);
    let task = app.clone();
    let create_id = id.clone();
    let (send, receive) = tokio::sync::oneshot::channel();
    app.run_on_main_thread(move || {
        let _ = send.send(create_window(task.raw(), &create_id, true));
    })
    .map_err(|e| e.to_string())?;
    let target = match receive.await.map_err(|e| e.to_string())? {
        Ok(target) => target,
        Err(error) => {
            app.window_state::<TransferState>()
                .moving
                .store(false, Ordering::SeqCst);
            let _ = fs::remove_file(dir.join("state.json"));
            return Err(error);
        }
    };
    let _target_guard = MovingGuard::new(&target);
    let destination = target.get_window("main").ok_or("新窗口创建失败")?;
    let mut moved = Vec::new();
    let result: Result<(), String> = async {
        for id in &ids {
            if let Some(view) = app.get_webview(&crate::browser_label(id)) {
                let bounds = view.bounds().map_err(|e| e.to_string())?;
                view.hide().map_err(|e| e.to_string())?;
                moved.push((view.clone(), bounds));
                view.reparent(&destination).map_err(|e| e.to_string())?;
            }
        }
        // 壳层挂载前已完成原生迁移，恢复代码仅显示既有 WebView。
        target
            .window_state::<crate::browser_startup::BrowserStartup>()
            .finish(Ok(()));
        for _ in 0..300 {
            if target
                .window_state::<TransferState>()
                .ready
                .load(Ordering::SeqCst)
            {
                return Ok(());
            }
            if let Some(error) = target
                .window_state::<TransferState>()
                .failure
                .lock()
                .map_err(|e| e.to_string())?
                .clone()
            {
                return Err(error);
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
        Err("新窗口接收超时，网页已退回原窗口".into())
    }
    .await;
    if result.is_err() {
        for (view, bounds) in moved.iter().rev() {
            view.reparent(&source)
                .map_err(|e| format!("网页退回失败：{e}"))?;
            view.hide().map_err(|e| e.to_string())?;
            let _ = view.set_bounds(*bounds);
            if view.label() == crate::browser_label(&source_active_id) {
                let _ = view.show();
            }
        }
        crate::replay_transferred_events(&target);
        crate::replay_transferred_events(&app);
        let _ = destination.destroy();
        let _ = fs::remove_file(dir.join("state.json"));
    }

    result
}

#[tauri::command]
pub fn reject_detached_window(app: BrowserContext, error: String) {
    *app.window_state::<TransferState>()
        .failure
        .lock()
        .unwrap_or_else(|e| e.into_inner()) = Some(error);
}

#[tauri::command]
pub fn transferred_browser_tabs(app: BrowserContext) -> Vec<String> {
    app.webviews()
        .keys()
        .filter_map(|label| {
            label
                .strip_prefix(crate::BROWSER_WEBVIEW_PREFIX)
                .map(str::to_string)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn session_ids_cannot_escape_the_session_directory() {
        for id in ["", "../main", "C:\\data", "abc/def", "中文"] {
            assert!(!valid_id(id));
        }
        assert!(valid_id("1ab-42"));
    }
}
