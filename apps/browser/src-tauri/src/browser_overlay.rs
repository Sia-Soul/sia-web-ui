use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, PhysicalPosition, Position, Rect,
    Size, State, Webview, WebviewBuilder, WebviewUrl,
};
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{SetWindowPos, HWND_TOP, SWP_NOMOVE, SWP_NOSIZE};

const BROWSER_OVERLAY_LABEL: &str = "browser-overlay";

#[derive(Default)]
pub struct BrowserOverlayStore(Mutex<Option<Value>>);

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserOverlayAction {
    pub action: String,
    pub value: Option<String>,
}

fn overlay_webview(app: &AppHandle) -> Result<Webview, String> {
    if let Some(webview) = app.get_webview(BROWSER_OVERLAY_LABEL) {
        return Ok(webview);
    }

    let main = app
        .get_window("main")
        .ok_or_else(|| "找不到浏览器主窗口".to_string())?;
    let builder = WebviewBuilder::new(
        BROWSER_OVERLAY_LABEL,
        WebviewUrl::App("overlay.html".into()),
    )
    .transparent(true)
    .focused(false)
    .initialization_script("window.__SIA_WINDOW_MODE__ = 'browser-overlay';");
    let overlay = main
        .add_child(
            builder,
            LogicalPosition::new(0.0, 0.0),
            LogicalSize::new(1.0, 1.0),
        )
        .map_err(|error| format!("无法创建浏览器模态覆盖层：{error}"))?;
    overlay.hide().map_err(|error| error.to_string())?;
    Ok(overlay)
}

pub fn initialize(app: &AppHandle) -> Result<(), String> {
    overlay_webview(app).map(|_| ())
}

fn sync_overlay_bounds(app: &AppHandle, overlay: &Webview) -> Result<(), String> {
    let main = app
        .get_window("main")
        .ok_or_else(|| "找不到浏览器主窗口".to_string())?;
    let size = main.inner_size().map_err(|error| error.to_string())?;
    overlay
        .set_bounds(Rect {
            position: Position::Physical(PhysicalPosition::new(0, 0)),
            size: Size::Physical(size),
        })
        .map_err(|error| error.to_string())
}

#[cfg(windows)]
fn raise_overlay(overlay: &Webview) -> Result<(), String> {
    overlay
        .with_webview(|platform_webview| {
            let mut hwnd = windows::Win32::Foundation::HWND::default();
            let result = unsafe {
                platform_webview
                    .controller()
                    .ParentWindow(&mut hwnd)
                    .and_then(|_| {
                        SetWindowPos(hwnd, Some(HWND_TOP), 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE)
                    })
            };
            if let Err(error) = result {
                eprintln!("无法提升浏览器模态覆盖层：{error}");
            }
        })
        .map_err(|error| error.to_string())
}

#[cfg(not(windows))]
fn raise_overlay(_overlay: &Webview) -> Result<(), String> {
    Ok(())
}

fn present_overlay(app: &AppHandle, payload: Value) -> Result<(), String> {
    let overlay = overlay_webview(app)?;
    sync_overlay_bounds(app, &overlay)?;
    overlay
        .emit("sia://browser-overlay-state", payload)
        .map_err(|error| error.to_string())?;
    overlay.show().map_err(|error| error.to_string())?;
    raise_overlay(&overlay)?;
    overlay.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn open_browser_overlay(
    app: AppHandle,
    store: State<'_, BrowserOverlayStore>,
    payload: Value,
) -> Result<(), String> {
    crate::floating_windows::close_browser_menu(app.clone())?;
    {
        let mut state = store
            .0
            .lock()
            .map_err(|_| "无法锁定浏览器覆盖层状态".to_string())?;
        *state = Some(payload.clone());
    }

    if app.get_webview(BROWSER_OVERLAY_LABEL).is_some() {
        return present_overlay(&app, payload);
    }

    let create_app = app.clone();
    app.run_on_main_thread(move || {
        if let Err(error) = present_overlay(&create_app, payload) {
            eprintln!("无法显示浏览器覆盖层：{error}");
            let _ = create_app.emit("sia://browser-overlay-error", error);
        }
    })
    .map_err(|error| error.to_string())
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
    if let Some(overlay) = app.get_webview(BROWSER_OVERLAY_LABEL) {
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
