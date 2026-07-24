use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{
    AppHandle, Emitter, Manager, Position, Size, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

const BROWSER_OVERLAY_LABEL: &str = "browser-overlay";

#[derive(Default)]
pub struct BrowserOverlayStore(Mutex<Option<Value>>);

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserOverlayAction {
    pub action: String,
    pub value: Option<String>,
}

fn overlay_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(BROWSER_OVERLAY_LABEL) {
        return Ok(window);
    }

    let main = app
        .get_window("main")
        .ok_or_else(|| "找不到浏览器主窗口".to_string())?;
    let builder = WebviewWindowBuilder::new(
        app,
        BROWSER_OVERLAY_LABEL,
        WebviewUrl::App("index.html?browser-overlay=1".into()),
    )
    .title("Sia Browser Overlay")
    .inner_size(640.0, 480.0)
    .decorations(false)
    .transparent(true)
    .shadow(false)
    .skip_taskbar(true)
    .resizable(false)
    .minimizable(false)
    .maximizable(false)
    .closable(false)
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

    builder.build().map_err(|error| error.to_string())
}

pub fn initialize(app: &AppHandle) -> Result<(), String> {
    overlay_window(app).map(|_| ())
}

fn sync_overlay_bounds(app: &AppHandle, overlay: &WebviewWindow) -> Result<(), String> {
    let main = app
        .get_window("main")
        .ok_or_else(|| "找不到浏览器主窗口".to_string())?;
    let position = main.outer_position().map_err(|error| error.to_string())?;
    let size = main.outer_size().map_err(|error| error.to_string())?;
    overlay
        .set_position(Position::Physical(position))
        .map_err(|error| error.to_string())?;
    overlay
        .set_size(Size::Physical(size))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn open_browser_overlay(
    app: AppHandle,
    store: State<'_, BrowserOverlayStore>,
    payload: Value,
) -> Result<(), String> {
    {
        let mut state = store
            .0
            .lock()
            .map_err(|_| "无法锁定浏览器覆盖层状态".to_string())?;
        *state = Some(payload.clone());
    }

    let overlay = overlay_window(&app)?;
    sync_overlay_bounds(&app, &overlay)?;
    overlay
        .emit("sia://browser-overlay-state", payload)
        .map_err(|error| error.to_string())?;
    overlay.show().map_err(|error| error.to_string())?;
    overlay.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_browser_overlay_state(
    store: State<'_, BrowserOverlayStore>,
) -> Result<Option<Value>, String> {
    store
        .0
        .lock()
        .map(|state| state.clone())
        .map_err(|_| "无法读取浏览器覆盖层状态".to_string())
}

#[tauri::command]
pub fn close_browser_overlay(
    app: AppHandle,
    store: State<'_, BrowserOverlayStore>,
) -> Result<(), String> {
    {
        let mut state = store
            .0
            .lock()
            .map_err(|_| "无法锁定浏览器覆盖层状态".to_string())?;
        *state = None;
    }
    if let Some(overlay) = app.get_webview_window(BROWSER_OVERLAY_LABEL) {
        overlay.hide().map_err(|error| error.to_string())?;
    }
    if let Some(main) = app.get_window("main") {
        main.set_focus().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn browser_overlay_action(
    app: AppHandle,
    store: State<'_, BrowserOverlayStore>,
    action: BrowserOverlayAction,
) -> Result<(), String> {
    close_browser_overlay(app.clone(), store)?;
    app.emit("sia://browser-overlay-action", action)
        .map_err(|error| error.to_string())
}
