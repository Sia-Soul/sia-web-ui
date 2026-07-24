use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Position, Size, State, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder, WindowEvent,
};

const TAB_PANEL_LABEL: &str = "browser-tab-panel";
const MENU_LABEL: &str = "browser-menu";

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
    source_window: String,
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
    query: &str,
    title: &str,
    transparent: bool,
    hide_on_blur: bool,
) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(label) {
        return Ok(window);
    }

    let main = app
        .get_window("main")
        .ok_or_else(|| "找不到浏览器主窗口".to_string())?;
    let builder = WebviewWindowBuilder::new(
        app,
        label,
        WebviewUrl::App(format!("index.html?{query}=1").into()),
    )
    .title(title)
    .inner_size(320.0, 480.0)
    .decorations(false)
    .transparent(transparent)
    .shadow(false)
    .skip_taskbar(true)
    .resizable(false)
    .minimizable(false)
    .maximizable(false)
    .closable(false)
    .focused(false)
    .visible(false);

    #[cfg(windows)]
    let builder = builder.owner_raw(main.hwnd().map_err(|error| error.to_string())?);

    #[cfg(not(windows))]
    let builder = {
        let main_webview = app
            .get_webview_window("main")
            .ok_or_else(|| "找不到浏览器主窗口 WebView".to_string())?;
        builder
            .parent(&main_webview)
            .map_err(|error| error.to_string())?
    };

    let window = builder.build().map_err(|error| error.to_string())?;
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

fn tab_panel_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    owned_window(
        app,
        TAB_PANEL_LABEL,
        "browser-tab-panel",
        "Sia Browser Tab Panel",
        false,
        false,
    )
}

fn menu_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    owned_window(
        app,
        MENU_LABEL,
        "browser-menu",
        "Sia Browser Menu",
        true,
        true,
    )
}

fn sync_window_bounds(
    app: &AppHandle,
    window: &WebviewWindow,
    source_window: &str,
    bounds: FloatingWindowBounds,
) -> Result<(), String> {
    let source = app
        .get_window(source_window)
        .ok_or_else(|| format!("找不到浮层来源窗口：{source_window}"))?;
    let source_position = source.outer_position().map_err(|error| error.to_string())?;
    let scale_factor = source.scale_factor().map_err(|error| error.to_string())?;
    let main = app
        .get_window("main")
        .ok_or_else(|| "找不到浏览器主窗口".to_string())?;
    let main_position = main.outer_position().map_err(|error| error.to_string())?;
    let main_size = main.outer_size().map_err(|error| error.to_string())?;

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

    window
        .set_size(Size::Physical(PhysicalSize::new(width, height)))
        .map_err(|error| error.to_string())?;
    window
        .set_position(Position::Physical(PhysicalPosition::new(x, y)))
        .map_err(|error| error.to_string())
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

pub fn initialize(app: &AppHandle) -> Result<(), String> {
    tab_panel_window(app)?;
    menu_window(app)?;

    let sync_app = app.clone();
    let main = app
        .get_window("main")
        .ok_or_else(|| "找不到浏览器主窗口".to_string())?;
    main.on_window_event(move |_event| {
        let tab_store = sync_app.state::<TabPanelStore>();
        if let Ok(Some(state)) = read_tab_panel_state(&tab_store) {
            if let Some(panel) = sync_app.get_webview_window(TAB_PANEL_LABEL) {
                if panel.is_visible().unwrap_or(false) {
                    let mut bounds = state.bounds;
                    if state.source_window == "main" {
                        if let Some(main) = sync_app.get_window("main") {
                            if let (Ok(size), Ok(scale_factor)) =
                                (main.outer_size(), main.scale_factor())
                            {
                                bounds.height =
                                    (size.height as f64 / scale_factor - bounds.y).max(1.0);
                            }
                        }
                    }
                    let _ = sync_window_bounds(&sync_app, &panel, &state.source_window, bounds);
                }
            }
        }
    });
    Ok(())
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
            source_window: "main".to_string(),
        });
    }
    let panel = tab_panel_window(&app)?;
    sync_window_bounds(&app, &panel, "main", bounds)?;
    panel
        .emit("sia://floating-tab-panel-state", payload)
        .map_err(|error| error.to_string())?;
    panel.show().map_err(|error| error.to_string())
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
    if let Some(panel) = app.get_webview_window(TAB_PANEL_LABEL) {
        panel
            .emit("sia://floating-tab-panel-state", payload)
            .map_err(|error| error.to_string())?;
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
    if let Some(panel) = app.get_webview_window(TAB_PANEL_LABEL) {
        panel.hide().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn floating_tab_panel_action(
    app: AppHandle,
    action: FloatingWindowAction,
) -> Result<(), String> {
    if action.action == "pin" {
        close_floating_tab_panel(app.clone())?;
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
    {
        let mut state = store
            .0
            .lock()
            .map_err(|_| "无法锁定浏览器菜单状态".to_string())?;
        *state = Some(FloatingWindowState {
            payload: payload.clone(),
            bounds,
            source_window: source_window.clone(),
        });
    }
    let menu = menu_window(app)?;
    sync_window_bounds(app, &menu, &source_window, bounds)?;
    menu.emit("sia://browser-menu-state", payload)
        .map_err(|error| error.to_string())?;
    menu.show().map_err(|error| error.to_string())?;
    menu.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_browser_menu_state(store: State<'_, BrowserMenuStore>) -> Result<Option<Value>, String> {
    read_menu_state(&store).map(|state| state.map(|entry| entry.payload))
}

#[tauri::command]
pub fn close_browser_menu(app: AppHandle) -> Result<(), String> {
    if let Some(menu) = app.get_webview_window(MENU_LABEL) {
        menu.hide().map_err(|error| error.to_string())?;
    }
    Ok(())
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
