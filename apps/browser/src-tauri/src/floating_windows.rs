use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Mutex,
};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, PhysicalPosition, PhysicalSize,
    Position, Rect, Size, State, Webview, WebviewBuilder, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};
#[cfg(windows)]
use windows::Win32::Foundation::{POINT, RECT};
#[cfg(windows)]
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, VK_LBUTTON, VK_MBUTTON, VK_RBUTTON,
};
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{
    GetCursorPos, GetWindowRect, SetWindowPos, HWND_NOTOPMOST, HWND_TOP, HWND_TOPMOST,
    SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
};

const TAB_PANEL_LABEL: &str = "sia-tab-panel-window";
const MENU_LABEL: &str = "browser-menu";
const TAB_PANEL_SHADOW_SPACE: f64 = 8.0;
const MENU_SHADOW_SPACE: f64 = 8.0;
const TAB_PANEL_TRANSITION_DURATION: Duration = Duration::from_millis(190);
static TAB_PANEL_VISIBLE: AtomicBool = AtomicBool::new(false);
static TAB_PANEL_VISIBILITY_GENERATION: AtomicU64 = AtomicU64::new(0);
static TAB_PANEL_MENU_HOLD: AtomicBool = AtomicBool::new(false);
static MENU_VISIBILITY_GENERATION: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FloatingWindowBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Clone, Debug)]
struct FloatingWindowState {
    payload: Value,
    bounds: FloatingWindowBounds,
}

#[derive(Default)]
pub struct TabPanelStore(Mutex<Option<FloatingWindowState>>);

#[derive(Default)]
pub struct BrowserMenuStore(Mutex<Option<FloatingWindowState>>);

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FloatingWindowAction {
    pub action: String,
    pub value: Option<String>,
}

fn owned_window(
    app: &AppHandle,
    label: &str,
    page: &str,
    title: &str,
    transparent: bool,
    shadow: bool,
    hide_on_blur: bool,
) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(label) {
        return Ok(window);
    }

    let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App(page.into()))
        .title(title)
        .inner_size(320.0, 480.0)
        .decorations(false)
        .transparent(transparent)
        .shadow(shadow)
        .skip_taskbar(true)
        .resizable(false)
        .minimizable(false)
        .maximizable(false)
        .closable(false)
        .focused(false)
        .visible(false);

    #[cfg(windows)]
    let builder = {
        let main = app
            .get_window("main")
            .ok_or_else(|| "找不到浏览器主窗口".to_string())?;
        builder.owner_raw(main.hwnd().map_err(|error| error.to_string())?)
    };

    #[cfg(not(windows))]
    let builder = {
        let main = app
            .get_webview_window("main")
            .ok_or_else(|| "找不到浏览器主窗口 WebView".to_string())?;
        builder.parent(&main).map_err(|error| error.to_string())?
    };

    let window = builder.build().map_err(|error| {
        eprintln!("无法创建浮动窗口 {label}（{page}）：{error}");
        error.to_string()
    })?;
    if hide_on_blur {
        let blur_window = window.clone();
        window.on_window_event(move |event| {
            if matches!(event, WindowEvent::Focused(false)) {
                let _ = blur_window.hide();
            }
        });
    }
    Ok(window)
}

fn tab_panel_webview(app: &AppHandle) -> Result<Webview, String> {
    if let Some(webview) = app.get_webview(TAB_PANEL_LABEL) {
        return Ok(webview);
    }

    let main = app
        .get_window("main")
        .ok_or_else(|| "找不到浏览器主窗口".to_string())?;
    let builder = WebviewBuilder::new(TAB_PANEL_LABEL, WebviewUrl::App("tab-panel.html".into()))
        .transparent(true)
        .focused(false)
        .initialization_script("window.__SIA_WINDOW_MODE__ = 'browser-tab-panel';");
    let webview = main
        .add_child(
            builder,
            LogicalPosition::new(0.0, 0.0),
            LogicalSize::new(1.0, 1.0),
        )
        .map_err(|error| format!("无法创建标签面板子 WebView：{error}"))?;
    webview.hide().map_err(|error| error.to_string())?;
    Ok(webview)
}

fn menu_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    owned_window(
        app,
        MENU_LABEL,
        "menu.html",
        "Sia Browser Menu",
        true,
        false,
        false,
    )
}

fn resolve_window_geometry(
    app: &AppHandle,
    source_window: &str,
    bounds: FloatingWindowBounds,
) -> Result<(i32, i32, u32, u32), String> {
    let main = app
        .get_window("main")
        .ok_or_else(|| "找不到浏览器主窗口".to_string())?;
    let main_position = main.inner_position().map_err(|error| error.to_string())?;
    let main_size = main.inner_size().map_err(|error| error.to_string())?;
    let scale_factor = main.scale_factor().map_err(|error| error.to_string())?;
    let source_position = if let Some(source) = app.get_window(source_window) {
        source.inner_position().map_err(|error| error.to_string())?
    } else if let Some(source) = app.get_webview(source_window) {
        let child_position = source.position().map_err(|error| error.to_string())?;
        PhysicalPosition::new(
            main_position.x.saturating_add(child_position.x),
            main_position.y.saturating_add(child_position.y),
        )
    } else {
        return Err(format!("找不到浮层来源窗口或子 WebView：{source_window}"));
    };

    let width = (bounds.width.max(1.0) * scale_factor).round() as u32;
    let height = (bounds.height.max(1.0) * scale_factor).round() as u32;
    let desired_x = source_position.x + (bounds.x * scale_factor).round() as i32;
    let desired_y = source_position.y + (bounds.y * scale_factor).round() as i32;
    let max_x = main_position
        .x
        .saturating_add(main_size.width.saturating_sub(width) as i32);
    let max_y = main_position
        .y
        .saturating_add(main_size.height.saturating_sub(height) as i32);
    let x = desired_x.clamp(main_position.x, max_x.max(main_position.x));
    let y = desired_y.clamp(main_position.y, max_y.max(main_position.y));

    Ok((x, y, width, height))
}

fn sync_window_bounds(
    app: &AppHandle,
    window: &WebviewWindow,
    source_window: &str,
    bounds: FloatingWindowBounds,
) -> Result<(), String> {
    let (x, y, width, height) = resolve_window_geometry(app, source_window, bounds)?;
    window
        .set_size(Size::Physical(PhysicalSize::new(width, height)))
        .map_err(|error| error.to_string())?;
    window
        .set_position(Position::Physical(PhysicalPosition::new(x, y)))
        .map_err(|error| error.to_string())
}

fn sync_tab_panel_bounds(webview: &Webview, bounds: FloatingWindowBounds) -> Result<(), String> {
    let outer_bounds = tab_panel_outer_bounds(bounds);
    webview
        .set_bounds(Rect {
            position: Position::Logical(LogicalPosition::new(outer_bounds.x, outer_bounds.y)),
            size: Size::Logical(LogicalSize::new(
                outer_bounds.width.max(1.0),
                outer_bounds.height.max(1.0),
            )),
        })
        .map_err(|error| error.to_string())
}

#[cfg(windows)]
fn raise_tab_panel_webview(webview: &Webview) -> Result<(), String> {
    webview
        .with_webview(|platform_webview| {
            let mut hwnd = windows::Win32::Foundation::HWND::default();
            let controller = platform_webview.controller();
            let result = unsafe {
                controller.ParentWindow(&mut hwnd).and_then(|_| {
                    SetWindowPos(
                        hwnd,
                        Some(HWND_TOP),
                        0,
                        0,
                        0,
                        0,
                        SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE,
                    )
                })
            };
            if let Err(error) = result {
                eprintln!("无法提升标签面板子 WebView 层级：{error}");
            }
        })
        .map_err(|error| error.to_string())
}

#[cfg(not(windows))]
fn raise_tab_panel_webview(_webview: &Webview) -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
fn raise_owned_window(window: &WebviewWindow) -> Result<(), String> {
    let hwnd = window.hwnd().map_err(|error| error.to_string())?;
    unsafe {
        SetWindowPos(
            hwnd,
            Some(HWND_TOPMOST),
            0,
            0,
            0,
            0,
            SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE,
        )
    }
    .map_err(|error| error.to_string())
}

#[cfg(windows)]
fn clear_owned_window_topmost(window: &WebviewWindow) {
    let Ok(hwnd) = window.hwnd() else {
        return;
    };
    let _ = unsafe {
        SetWindowPos(
            hwnd,
            Some(HWND_NOTOPMOST),
            0,
            0,
            0,
            0,
            SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE,
        )
    };
}

fn show_and_sync_window(
    app: &AppHandle,
    window: &WebviewWindow,
    source_window: &str,
    bounds: FloatingWindowBounds,
) -> Result<(), String> {
    sync_window_bounds(app, window, source_window, bounds)?;
    window.show().map_err(|error| error.to_string())?;
    #[cfg(windows)]
    if let Err(error) = raise_owned_window(window) {
        eprintln!("无法提升浮动窗口 {} 的层级：{error}", window.label());
    }
    Ok(())
}

fn read_tab_panel_state(store: &TabPanelStore) -> Result<Option<FloatingWindowState>, String> {
    store
        .0
        .lock()
        .map(|state| state.clone())
        .map_err(|_| "无法读取浮动标签面板状态".to_string())
}

fn read_menu_state(store: &BrowserMenuStore) -> Result<Option<FloatingWindowState>, String> {
    store
        .0
        .lock()
        .map(|state| state.clone())
        .map_err(|_| "无法读取浏览器菜单状态".to_string())
}

fn tab_panel_outer_bounds(bounds: FloatingWindowBounds) -> FloatingWindowBounds {
    FloatingWindowBounds {
        width: bounds.width + TAB_PANEL_SHADOW_SPACE,
        ..bounds
    }
}

fn menu_outer_bounds(bounds: FloatingWindowBounds) -> FloatingWindowBounds {
    FloatingWindowBounds {
        x: bounds.x - MENU_SHADOW_SPACE,
        y: bounds.y - MENU_SHADOW_SPACE,
        width: bounds.width + MENU_SHADOW_SPACE * 2.0,
        height: bounds.height + MENU_SHADOW_SPACE * 2.0,
    }
}

fn hide_tab_panel(app: &AppHandle) -> Result<(), String> {
    if TAB_PANEL_MENU_HOLD.load(Ordering::SeqCst) {
        return Ok(());
    }
    if !TAB_PANEL_VISIBLE.load(Ordering::SeqCst) {
        return app
            .emit("sia://floating-tab-panel-visibility", false)
            .map_err(|error| error.to_string());
    }

    let generation = TAB_PANEL_VISIBILITY_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    app.emit("sia://floating-tab-panel-visibility", false)
        .map_err(|error| error.to_string())?;

    let hide_app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(TAB_PANEL_TRANSITION_DURATION);
        if TAB_PANEL_VISIBILITY_GENERATION.load(Ordering::SeqCst) != generation {
            return;
        }
        let main_thread_app = hide_app.clone();
        let _ = hide_app.run_on_main_thread(move || {
            if TAB_PANEL_VISIBILITY_GENERATION.load(Ordering::SeqCst) != generation {
                return;
            }
            if let Some(panel) = main_thread_app.get_webview(TAB_PANEL_LABEL) {
                eprintln!("[tab-panel] hide");
                if let Err(error) = panel.hide() {
                    eprintln!("无法隐藏标签面板子 WebView：{error}");
                    return;
                }
            }
            TAB_PANEL_VISIBLE.store(false, Ordering::SeqCst);
        });
    });
    Ok(())
}

#[cfg(windows)]
fn cursor_inside_tab_panel(app: &AppHandle) -> bool {
    let Some(main) = app.get_window("main") else {
        return false;
    };
    let Some(panel) = app.get_webview(TAB_PANEL_LABEL) else {
        return false;
    };
    let (Ok(main_position), Ok(panel_position), Ok(panel_size)) =
        (main.inner_position(), panel.position(), panel.size())
    else {
        return false;
    };
    let mut cursor = POINT::default();
    if unsafe { GetCursorPos(&mut cursor) }.is_err() {
        return false;
    }
    let left = main_position.x.saturating_add(panel_position.x);
    let top = main_position.y.saturating_add(panel_position.y);
    let right = left.saturating_add(panel_size.width as i32);
    let bottom = top.saturating_add(panel_size.height as i32);
    cursor.x >= left && cursor.x < right && cursor.y >= top && cursor.y < bottom
}

#[cfg(not(windows))]
fn cursor_inside_tab_panel(_app: &AppHandle) -> bool {
    false
}

fn hide_menu(app: &AppHandle) -> Result<(), String> {
    MENU_VISIBILITY_GENERATION.fetch_add(1, Ordering::SeqCst);
    if let Some(menu) = app.get_webview_window(MENU_LABEL) {
        eprintln!("[browser-menu] hide");
        #[cfg(windows)]
        clear_owned_window_topmost(&menu);
        menu.hide().map_err(|error| error.to_string())?;
    }
    if TAB_PANEL_MENU_HOLD.swap(false, Ordering::SeqCst) {
        if cursor_inside_tab_panel(app) {
            app.emit("sia://floating-tab-panel-visibility", true)
                .map_err(|error| error.to_string())?;
        } else {
            hide_tab_panel(app)?;
        }
    }
    Ok(())
}

pub fn menu_is_visible(app: &AppHandle) -> bool {
    app.get_webview_window(MENU_LABEL)
        .and_then(|menu| menu.is_visible().ok())
        .unwrap_or(false)
}

#[cfg(windows)]
fn start_menu_pointer_watcher(app: &AppHandle) {
    let generation = MENU_VISIBILITY_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let watcher_app = app.clone();
    std::thread::spawn(move || {
        let mut pointer_released_after_open = false;
        let mut outside_pointer_pressed = false;
        loop {
            std::thread::sleep(Duration::from_millis(16));
            if MENU_VISIBILITY_GENERATION.load(Ordering::SeqCst) != generation {
                return;
            }

            let Some(menu) = watcher_app.get_webview_window(MENU_LABEL) else {
                return;
            };
            if !menu.is_visible().unwrap_or(false) {
                return;
            }
            let Ok(hwnd) = menu.hwnd() else {
                return;
            };
            let mut cursor = POINT::default();
            let mut rect = RECT::default();
            let cursor_inside = unsafe {
                GetCursorPos(&mut cursor).is_ok()
                    && GetWindowRect(hwnd, &mut rect).is_ok()
                    && cursor.x >= rect.left
                    && cursor.x < rect.right
                    && cursor.y >= rect.top
                    && cursor.y < rect.bottom
            };
            let pointer_down = unsafe {
                [VK_LBUTTON, VK_RBUTTON, VK_MBUTTON]
                    .into_iter()
                    .any(|key| (GetAsyncKeyState(key.0 as i32) as u16 & 0x8000) != 0)
            };

            if !pointer_down {
                pointer_released_after_open = true;
                if !outside_pointer_pressed {
                    continue;
                }

                // 等待当前点击的前端 onClick / invoke 完成。若用户再次点击“更多”，
                // show_browser_more_menu 会先看到菜单仍可见并主动关闭它；如果这里在
                // pointer-down 阶段抢先隐藏，随后按钮命令就会把菜单重新打开。
                std::thread::sleep(Duration::from_millis(80));
                if MENU_VISIBILITY_GENERATION.load(Ordering::SeqCst) != generation {
                    return;
                }
                let close_app = watcher_app.clone();
                let _ = watcher_app.run_on_main_thread(move || {
                    let _ = hide_menu(&close_app);
                });
                return;
            }
            if !pointer_released_after_open || cursor_inside {
                continue;
            }
            outside_pointer_pressed = true;
        }
    });
}

#[cfg(not(windows))]
fn start_menu_pointer_watcher(_app: &AppHandle) {}

pub fn initialize(app: &AppHandle) -> Result<(), String> {
    // 标签面板使用主窗口内部的子 WebView，网页和面板由同一个窗口托管。
    // 这样面板不会出现在任务栏或 Alt+Tab，也不再需要同步屏幕坐标和窗口焦点。
    tab_panel_webview(app)?;
    menu_window(app)?;

    let sync_app = app.clone();
    let main = app
        .get_window("main")
        .ok_or_else(|| "找不到浏览器主窗口".to_string())?;
    main.on_window_event(move |event| {
        let should_hide = matches!(
            event,
            WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed
        ) || matches!(
            event,
            WindowEvent::Resized(size) if size.width == 0 || size.height == 0
        );
        if should_hide {
            let _ = hide_tab_panel(&sync_app);
            let _ = hide_menu(&sync_app);
            return;
        }
        if !matches!(
            event,
            WindowEvent::Resized(_) | WindowEvent::ScaleFactorChanged { .. }
        ) {
            return;
        }
        if !TAB_PANEL_VISIBLE.load(Ordering::SeqCst) {
            return;
        }
        let tab_store = sync_app.state::<TabPanelStore>();
        if let Ok(Some(state)) = read_tab_panel_state(&tab_store) {
            if let Some(panel) = sync_app.get_webview(TAB_PANEL_LABEL) {
                let _ = sync_tab_panel_bounds(&panel, state.bounds);
                let _ = raise_tab_panel_webview(&panel);
            }
        }
    });
    Ok(())
}

fn present_tab_panel(
    app: &AppHandle,
    payload: Value,
    bounds: FloatingWindowBounds,
) -> Result<(), String> {
    TAB_PANEL_VISIBILITY_GENERATION.fetch_add(1, Ordering::SeqCst);
    let panel = tab_panel_webview(app)?;
    eprintln!(
        "[tab-panel] show x={} y={} width={} height={}",
        bounds.x, bounds.y, bounds.width, bounds.height
    );
    sync_tab_panel_bounds(&panel, bounds)?;
    panel
        .emit("sia://floating-tab-panel-state", payload)
        .map_err(|error| error.to_string())?;
    app.emit("sia://floating-tab-panel-visibility", true)
        .map_err(|error| error.to_string())?;
    panel.show().map_err(|error| error.to_string())?;
    TAB_PANEL_VISIBLE.store(true, Ordering::SeqCst);
    raise_tab_panel_webview(&panel)?;
    Ok(())
}

pub fn raise_tab_panel_if_visible(app: &AppHandle) {
    if !TAB_PANEL_VISIBLE.load(Ordering::SeqCst) {
        return;
    }
    if let Some(panel) = app.get_webview(TAB_PANEL_LABEL) {
        let _ = raise_tab_panel_webview(&panel);
    }
}

#[tauri::command]
pub fn open_floating_tab_panel(
    app: AppHandle,
    store: State<'_, TabPanelStore>,
    payload: Value,
    bounds: FloatingWindowBounds,
) -> Result<(), String> {
    {
        let mut state = store
            .0
            .lock()
            .map_err(|_| "无法锁定浮动标签面板状态".to_string())?;
        *state = Some(FloatingWindowState {
            payload: payload.clone(),
            bounds,
        });
    }
    if app.get_webview(TAB_PANEL_LABEL).is_some() {
        return present_tab_panel(&app, payload, bounds);
    }

    let create_app = app.clone();
    app.run_on_main_thread(move || {
        if let Err(error) = present_tab_panel(&create_app, payload, bounds) {
            eprintln!("无法显示标签面板子 WebView：{error}");
            let _ = create_app.emit("sia://floating-tab-panel-error", error);
        }
    })
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_floating_tab_panel(
    app: AppHandle,
    store: State<'_, TabPanelStore>,
    payload: Value,
) -> Result<(), String> {
    {
        let mut state = store
            .0
            .lock()
            .map_err(|_| "无法锁定浮动标签面板状态".to_string())?;
        if let Some(current) = state.as_mut() {
            current.payload = payload.clone();
        }
    }
    if let Some(panel) = app.get_webview(TAB_PANEL_LABEL) {
        panel
            .emit("sia://floating-tab-panel-state", payload)
            .map_err(|error| error.to_string())?;
        raise_tab_panel_if_visible(&app);
    }
    Ok(())
}

#[tauri::command]
pub fn get_floating_tab_panel_state(
    store: State<'_, TabPanelStore>,
) -> Result<Option<Value>, String> {
    read_tab_panel_state(&store).map(|state| state.map(|entry| entry.payload))
}

#[tauri::command]
pub fn close_floating_tab_panel(app: AppHandle) -> Result<(), String> {
    hide_tab_panel(&app)
}

#[tauri::command]
pub fn close_floating_tab_panel_if_pointer_outside(app: AppHandle) -> Result<(), String> {
    if cursor_inside_tab_panel(&app) {
        return Ok(());
    }
    hide_tab_panel(&app)
}

#[tauri::command]
pub fn floating_tab_panel_action(
    app: AppHandle,
    store: State<'_, TabPanelStore>,
    action: FloatingWindowAction,
) -> Result<(), String> {
    eprintln!(
        "[tab-panel] action={} value={:?}",
        action.action, action.value
    );
    if action.action == "collapse-panel" {
        return hide_tab_panel(&app);
    }
    if action.action == "select" {
        if let Some(tab_id) = action.value.as_ref() {
            let next_payload = {
                let mut state = store
                    .0
                    .lock()
                    .map_err(|_| "无法锁定浮动标签面板状态".to_string())?;
                state.as_mut().map(|current| {
                    if let Some(payload) = current.payload.as_object_mut() {
                        payload.insert("activeId".to_string(), Value::String(tab_id.clone()));
                    }
                    current.payload.clone()
                })
            };
            if let (Some(panel), Some(payload)) = (app.get_webview(TAB_PANEL_LABEL), next_payload) {
                panel
                    .emit("sia://floating-tab-panel-state", payload)
                    .map_err(|error| error.to_string())?;
            }
        }
    }
    app.emit("sia://floating-tab-panel-action", action)
        .map_err(|error| error.to_string())
}

pub fn show_menu(
    app: &AppHandle,
    store: &BrowserMenuStore,
    payload: Value,
    source_window: String,
    bounds: FloatingWindowBounds,
) -> Result<(), String> {
    if source_window == TAB_PANEL_LABEL {
        TAB_PANEL_MENU_HOLD.store(true, Ordering::SeqCst);
        TAB_PANEL_VISIBILITY_GENERATION.fetch_add(1, Ordering::SeqCst);
        if TAB_PANEL_VISIBLE.load(Ordering::SeqCst) {
            app.emit("sia://floating-tab-panel-visibility", true)
                .map_err(|error| error.to_string())?;
            raise_tab_panel_if_visible(app);
        }
    }
    {
        let mut state = store
            .0
            .lock()
            .map_err(|_| "无法锁定浏览器菜单状态".to_string())?;
        *state = Some(FloatingWindowState {
            payload: payload.clone(),
            bounds,
        });
    }
    if let Some(menu) = app.get_webview_window(MENU_LABEL) {
        show_and_sync_window(app, &menu, &source_window, menu_outer_bounds(bounds))?;
        menu.emit("sia://browser-menu-state", payload)
            .map_err(|error| error.to_string())?;
        start_menu_pointer_watcher(app);
        return Ok(());
    }

    let create_app = app.clone();
    app.run_on_main_thread(move || {
        let result: Result<(), String> = (|| {
            let menu = menu_window(&create_app)?;
            show_and_sync_window(
                &create_app,
                &menu,
                &source_window,
                menu_outer_bounds(bounds),
            )?;
            menu.emit("sia://browser-menu-state", payload)
                .map_err(|error| error.to_string())?;
            start_menu_pointer_watcher(&create_app);
            Ok(())
        })();
        if let Err(error) = result {
            eprintln!("无法显示浏览器菜单窗口：{error}");
            let _ = create_app.emit("sia://browser-menu-error", error);
        }
    })
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_browser_menu_state(store: State<'_, BrowserMenuStore>) -> Result<Option<Value>, String> {
    read_menu_state(&store).map(|state| state.map(|entry| entry.payload))
}

#[tauri::command]
pub fn close_browser_menu(app: AppHandle) -> Result<(), String> {
    hide_menu(&app)
}

#[tauri::command]
pub fn browser_menu_action(app: AppHandle, action: FloatingWindowAction) -> Result<(), String> {
    close_browser_menu(app.clone())?;
    if crate::passwords::handle_password_menu_action(&app, &action.action)? {
        return Ok(());
    }
    app.emit("sia://native-menu-action", action.action)
        .map_err(|error| error.to_string())
}
