use crate::window_context::{BrowserContext as AppHandle, WindowState};
use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Mutex,
};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{
    Emitter, LogicalPosition, LogicalSize, Manager, PhysicalPosition, PhysicalSize,
    Position, Rect, Size, Webview, WebviewBuilder, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};
#[cfg(windows)]
use windows::Win32::Foundation::{POINT, RECT};
#[cfg(windows)]
use windows::Win32::Graphics::Gdi::{
    CombineRgn, CreateRectRgn, CreateRoundRectRgn, DeleteObject, GetWindowRgn, PtInRegion,
    SetWindowRgn, HRGN, RGN_OR,
};
#[cfg(windows)]
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, VK_LBUTTON, VK_MBUTTON, VK_RBUTTON,
};
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{
    GetCursorPos, GetForegroundWindow, GetWindowThreadProcessId, GetWindowRect, SetWindowPos, HWND_TOP,
    SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
};

#[derive(Default)]
pub struct FloatingRuntime {
    tab_tooltip_generation: AtomicU64,
    tab_panel_visible: AtomicBool,
    tab_panel_visibility_generation: AtomicU64,
    tab_panel_menu_hold: AtomicBool,
    menu_visibility_generation: AtomicU64,
    menu_region_revision: AtomicU64,
}

const TAB_PANEL_LABEL: &str = "sia-tab-panel-window";
const MENU_LABEL: &str = "browser-menu";
// 提示不是网页页签，不能匹配 browser-tab- 前缀的批量隐藏与布局操作。
const TAB_TOOLTIP_LABEL: &str = "sia-tab-tooltip-window";
const TAB_PANEL_SHADOW_SPACE: f64 = 8.0;
// 菜单布局留白（逻辑像素）与 CSS 外边距一致，保留阴影绘制区域。
const MENU_SHADOW_SPACE: f64 = 20.0;
const TAB_PANEL_TRANSITION_DURATION: Duration = Duration::from_millis(190);
// 显示批次和外部点击监视代次独立，避免旧 DOM 测量覆盖刚切换的面板。

/// 菜单实际可见表面的客户区范围，单位为 CSS 像素；不包含透明外边距。
#[derive(Clone, Debug, Deserialize)]
pub struct MenuSurfaceRegion {
    /// 表面左边缘相对窗口客户区的位置。
    x: f64,
    /// 表面上边缘相对窗口客户区的位置。
    y: f64,
    /// 表面的可见宽度。
    width: f64,
    /// 表面的可见高度。
    height: f64,
    /// 圆角半径；零表示矩形。
    radius: f64,
}

/// 将可见表面合并为原生窗口形状，区域之外不绘制也不拦截底层窗口的鼠标。
#[cfg(windows)]
fn create_menu_region(regions: &[MenuSurfaceRegion], scale: f64) -> Result<HRGN, String> {
    let combined = unsafe { CreateRectRgn(0, 0, 0, 0) };
    if combined.is_invalid() { return Err("无法创建菜单命中区域".into()); }
    for rect in regions {
        if ![rect.x, rect.y, rect.width, rect.height, rect.radius].iter().all(|v| v.is_finite())
            || rect.width <= 0.0 || rect.height <= 0.0 { continue; }
        let diameter = (rect.radius.max(0.0).min(rect.width / 2.0).min(rect.height / 2.0) * 2.0 * scale).round() as i32;
        let part = unsafe { CreateRoundRectRgn(
            (rect.x * scale).floor() as i32, (rect.y * scale).floor() as i32,
            ((rect.x + rect.width) * scale).ceil() as i32,
            ((rect.y + rect.height) * scale).ceil() as i32, diameter, diameter,
        ) };
        if part.is_invalid() {
            unsafe { let _ = DeleteObject(combined.into()); }
            return Err("无法创建菜单表面区域".into());
        }
        let result = unsafe { CombineRgn(Some(combined), Some(combined), Some(part), RGN_OR) };
        unsafe { let _ = DeleteObject(part.into()); }
        if result.0 == 0 {
            unsafe { let _ = DeleteObject(combined.into()); }
            return Err("无法合并菜单表面区域".into());
        }
    }
    Ok(combined)
}

/// 绘制区域包含阴影；远离菜单的级联预留画布仍保持穿透。
#[cfg(windows)]
fn create_menu_paint_region(regions: &[MenuSurfaceRegion], scale: f64) -> Result<HRGN, String> {
    let painted: Vec<_> = regions.iter().map(|r| MenuSurfaceRegion {
        x: r.x - MENU_SHADOW_SPACE, y: r.y - MENU_SHADOW_SPACE,
        width: r.width + MENU_SHADOW_SPACE * 2.0, height: r.height + MENU_SHADOW_SPACE * 2.0,
        radius: r.radius + MENU_SHADOW_SPACE,
    }).collect();
    create_menu_region(&painted, scale)
}

/// 必须在窗口线程设置形状；成功后区域句柄归 Windows 所有，失败时自行释放。
fn apply_menu_regions(window: &WebviewWindow, regions: &[MenuSurfaceRegion]) -> Result<(), String> {
    #[cfg(windows)]
    {
        let hwnd = window.hwnd().map_err(|error| error.to_string())?;
        let region = create_menu_paint_region(regions, window.scale_factor().map_err(|error| error.to_string())?)?;
        if unsafe { SetWindowRgn(hwnd, Some(region), true) } == 0 {
            unsafe { let _ = DeleteObject(region.into()); }
            return Err("无法应用菜单命中区域".into());
        }
    }
    Ok(())
}

/// 由菜单 WebView 回传表面；只接受当前批次，并在主线程再次校验以避免切换竞态。
#[tauri::command]
pub async fn update_browser_menu_regions(window: WebviewWindow, revision: u64, regions: Vec<MenuSurfaceRegion>) -> Result<(), String> {
    let app = AppHandle::new(window.app_handle(), window.label());
    let runtime = app.window_state::<FloatingRuntime>();
    if window.label() != app.label(MENU_LABEL) || regions.len() > 32 { return Err("无效的菜单区域请求".into()); }

    window.clone().run_on_main_thread(move || {
        if runtime.menu_region_revision.load(Ordering::SeqCst) != revision { return; }
        if let Err(error) = apply_menu_regions(&window, &regions) {
            let _ = app.emit("sia://browser-menu-error", error);
        }
    }).map_err(|error| error.to_string())
}

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

/// 提示状态独立于菜单，悬停不会覆盖收藏、历史或右键菜单的内容。
#[derive(Default)]
pub struct TabTooltipStore(Mutex<Option<FloatingWindowState>>);

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

    let builder = WebviewWindowBuilder::new(app.raw(), app.label(label), WebviewUrl::App(page.into()))
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
        // 只读提示窗口永不获取焦点，显示时保持当前网页和输入框的焦点。
        .focusable(label != TAB_TOOLTIP_LABEL)
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
    #[cfg(windows)]
    crate::popup_window::install_frameless(window.hwnd().map_err(|error| error.to_string())?)
        .map_err(|error| error.to_string())?;
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
    let builder = WebviewBuilder::new(app.label(TAB_PANEL_LABEL), WebviewUrl::App("tab-panel.html".into()))
        // 标签树使用 HTML 拖放，关闭原生文件拖放拦截以允许 WebView2 派发 drop 事件。
        .disable_drag_drop_handler()
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
    // 独立标签侧栏与主壳层使用相同的外部网页拖入入口。
    crate::browser_drop::attach(app, &webview)?;
    webview.hide().map_err(|error| error.to_string())?;
    Ok(webview)
}

fn menu_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    owned_window(
        app,
        MENU_LABEL,
        "menu.html",
        "西娅浏览器 Menu",
        true,
        false,
        false,
    )
}

/// 预热只读提示窗口，使气泡可以覆盖网页子 WebView，并让鼠标事件穿透。
fn tab_tooltip_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    let window = owned_window(app, TAB_TOOLTIP_LABEL, "menu.html?tab-tooltip", "标签页提示", true, false, false)?;
    window.set_ignore_cursor_events(true).map_err(|error| error.to_string())?;
    Ok(window)
}

/// 菜单和提示统一以不激活、不移动 owner 层级的方式开关，避免外部点击被窗口重新排序抵消。
fn set_owned_window_visible(window: &WebviewWindow, visible: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        let hwnd = window.hwnd().map_err(|error| error.to_string())?;
        crate::popup_window::set_visible(hwnd, visible).map_err(|error| error.to_string())
    }
    #[cfg(not(windows))]
    {
        if visible { window.show() } else { window.hide() }.map_err(|error| error.to_string())
    }
}

/// 立即收起提示并取消旧监视任务；不会改变菜单或标签面板状态。
#[tauri::command]
pub fn close_browser_tab_tooltip(app: AppHandle) -> Result<(), String> {
    let runtime = app.window_state::<FloatingRuntime>();
    runtime.tab_tooltip_generation.fetch_add(1, Ordering::SeqCst);
    *app.window_state::<TabTooltipStore>().0.lock().map_err(|_| "无法锁定标签提示状态")? = None;
    if let Some(window) = app.get_webview_window(TAB_TOOLTIP_LABEL) {
        set_owned_window_visible(&window, false)?;
    }
    Ok(())
}

/// 初始加载时读取最近的提示，避免 WebView 尚未订阅事件而漏掉首次悬停。
#[tauri::command]
pub fn get_browser_tab_tooltip_state(app: AppHandle) -> Result<Option<Value>, String> {
    app.window_state::<TabTooltipStore>().0.lock().map(|state| state.as_ref().map(|state| state.payload.clone()))
        .map_err(|_| "无法读取标签提示状态".to_string())
}

/// 气泡排版完成后才按实际高度显示，避免长标题裁切或快速切换时闪出旧内容。
#[tauri::command]
pub fn present_browser_tab_tooltip(app: AppHandle, revision: u64, height: f64) -> Result<(), String> {
    if !height.is_finite() || height <= 0.0 { return Ok(()); }
    let store = app.window_state::<TabTooltipStore>();
    let mut state = store.0.lock().map_err(|_| "无法锁定标签提示状态")?;
    let Some(state) = state.as_mut().filter(|state| state.payload["revision"].as_u64() == Some(revision)) else { return Ok(()); };
    state.bounds.height = height.ceil() + 24.0;
    if let Some(window) = app.get_webview_window(TAB_TOOLTIP_LABEL) {
        sync_window_bounds(&app, &window, "main", state.bounds)?;
        set_owned_window_visible(&window, true)?;
    }
    Ok(())
}

/// 坐标使用主窗口客户区逻辑像素；气泡留在窗口内，底部项目向上避让。
#[tauri::command]
pub fn show_browser_tab_tooltip(app: AppHandle, mut payload: Value, anchor: FloatingWindowBounds) -> Result<(), String> {
    let runtime = app.window_state::<FloatingRuntime>();
    let generation = runtime.tab_tooltip_generation.fetch_add(1, Ordering::SeqCst) + 1;
    payload["revision"] = Value::from(generation);
    let bounds = FloatingWindowBounds {
        x: anchor.x + anchor.width - 8.0, y: (anchor.y - 12.0).max(0.0), width: 320.0, height: 160.0,
    };
    *app.window_state::<TabTooltipStore>().0.lock().map_err(|_| "无法锁定标签提示状态")? = Some(FloatingWindowState { payload: payload.clone(), bounds });
    let window = tab_tooltip_window(&app)?;
    set_owned_window_visible(&window, false)?;
    sync_window_bounds(&app, &window, "main", bounds)?;
    window.emit_to(tauri::EventTarget::webview(window.label()), "sia://browser-tab-tooltip", payload).map_err(|error| error.to_string())?;
    #[cfg(windows)]
    {
        let watcher = app.clone();
        // 原生网页会截走主页面的移出事件，独立检查指针确保提示不会残留。
        let (x, y, width, height) = resolve_window_geometry(&app, "main", anchor)?;
        // 悬停不要求先激活浏览器；只在悬停期间前台窗口发生变化时关闭提示。
        // 保存句柄值而非进程号，同一进程的不同窗口切换也能正确结束悬停。
        let initial_foreground = unsafe { GetForegroundWindow().0 as isize };
        std::thread::spawn(move || loop {
            std::thread::sleep(Duration::from_millis(16));
            if runtime.tab_tooltip_generation.load(Ordering::SeqCst) != generation { return; }
            let mut cursor = POINT::default();
            let dismiss = unsafe {
                let foreground = GetForegroundWindow().0 as isize;
                GetCursorPos(&mut cursor).is_err() || cursor.x < x || cursor.y < y
                    || cursor.x >= x + width as i32 || cursor.y >= y + height as i32
                    || (foreground != 0 && foreground != initial_foreground)
                    || [VK_LBUTTON, VK_RBUTTON, VK_MBUTTON].into_iter()
                        .any(|key| (GetAsyncKeyState(key.0 as i32) as u16 & 0x8000) != 0)
            };
            if dismiss {
                let close_app = watcher.clone();
                let _ = watcher.run_on_main_thread(move || {
                    if runtime.tab_tooltip_generation.load(Ordering::SeqCst) == generation {
                        let _ = close_browser_tab_tooltip(close_app);
                    }
                });
                return;
            }
        });
    }
    Ok(())
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

fn show_and_sync_window(
    app: &AppHandle,
    window: &WebviewWindow,
    source_window: &str,
    bounds: FloatingWindowBounds,
) -> Result<(), String> {
    sync_window_bounds(app, window, source_window, bounds)?;
    if window.label() == MENU_LABEL {
        // 新面板尚未完成 DOM 布局时先保持空形状，避免旧范围或整块透明画布短暂拦截点击。
        apply_menu_regions(window, &[])?;
    }
    set_owned_window_visible(window, true)
}

fn read_tab_panel_state(store: &TabPanelStore) -> Result<Option<FloatingWindowState>, String> {
    store
        .0
        .lock()
        .map(|state| state.clone())
        .map_err(|_| "无法读取浮动标签面板状态".to_string())
}

/// 菜单关闭或鼠标移出时，固定面板始终保留，浮动面板仅在指针仍位于内部时保留。
/// 每次读取最新固定状态，避免排队的移出请求收起刚固定的面板；读取失败返回错误。
/// 显式收起、切换布局及窗口隐藏不经过此判断。
fn keep_tab_panel_on_pointer_leave(
    store: &TabPanelStore,
    cursor_inside: bool,
) -> Result<bool, String> {
    let state = store.0.lock().map_err(|_| "无法读取浮动标签面板状态".to_string())?;
    let pinned = state
        .as_ref()
        .and_then(|current| current.payload.get("panelPinned"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    Ok(pinned || cursor_inside)
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

/// 为级联菜单预留横向空间，优先向右；靠右时向左扩展，主菜单屏幕坐标保持不变。
fn cascade_canvas(root: (i32, i32, u32, u32), main: (i32, i32, u32, u32), scale: f64, depth: usize) -> (i32, i32, u32, u32) {
    let width = main.2.min(root.2.saturating_add((284.0 * scale * depth as f64).round() as u32));
    let height = main.3.min(root.3.max((480.0 * scale).round() as u32));
    let right_limit = main.0.saturating_add(main.2.saturating_sub(width) as i32);
    // 预留空间必须完整落在同一侧，不能把空间分散到左右后两侧都放不下子菜单。
    let x = if root.0 <= right_limit { root.0 }
        else { root.0.saturating_sub(width.saturating_sub(root.2) as i32).max(main.0) };
    let bottom_limit = main.1.saturating_add(main.3.saturating_sub(height) as i32);
    (x, root.1.clamp(main.1, bottom_limit), width, height)
}

/// 只为含 children 的普通菜单扩大透明画布，工具面板与没有子项的菜单仍使用原尺寸。
fn prepare_cascade_menu(app: &AppHandle, payload: &mut Value, source: String, bounds: FloatingWindowBounds) -> Result<(String, FloatingWindowBounds), String> {
    fn depth(items: &Value) -> usize {
        items.as_array().map(|items| items.iter().map(|item| {
            item.get("children").filter(|children| children.as_array().is_some_and(|items| !items.is_empty()))
                .map(|children| 1 + depth(children)).unwrap_or(0)
        }).max().unwrap_or(0)).unwrap_or(0)
    }
    let levels = depth(&payload["items"]);
    if levels == 0 { return Ok((source, bounds)); }
    let main = app.get_window("main").ok_or("找不到浏览器主窗口")?;
    let origin = main.inner_position().map_err(|error| error.to_string())?;
    let size = main.inner_size().map_err(|error| error.to_string())?;
    let scale = main.scale_factor().map_err(|error| error.to_string())?;
    let root = resolve_window_geometry(app, &source, menu_outer_bounds(bounds))?;
    let (x, y, width, height) = cascade_canvas(root, (origin.x, origin.y, size.width, size.height), scale, levels);
    payload["menuLayout"] = serde_json::json!({
        "left": (root.0 - x) as f64 / scale + MENU_SHADOW_SPACE,
        "top": (root.1 - y) as f64 / scale + MENU_SHADOW_SPACE,
        "width": bounds.width,
        "height": bounds.height,
    });
    // 转回主窗口逻辑坐标；随后 menu_outer_bounds 只补一次阴影边距。
    Ok(("main".to_string(), FloatingWindowBounds {
        x: (x - origin.x) as f64 / scale + MENU_SHADOW_SPACE,
        y: (y - origin.y) as f64 / scale + MENU_SHADOW_SPACE,
        width: width as f64 / scale - MENU_SHADOW_SPACE * 2.0,
        height: height as f64 / scale - MENU_SHADOW_SPACE * 2.0,
    }))
}

fn hide_tab_panel(app: &AppHandle) -> Result<(), String> {
    let runtime = app.window_state::<FloatingRuntime>();
    if runtime.tab_panel_menu_hold.load(Ordering::SeqCst) {
        return Ok(());
    }
    if !runtime.tab_panel_visible.load(Ordering::SeqCst) {
        return app
            .emit("sia://floating-tab-panel-visibility", false)
            .map_err(|error| error.to_string());
    }

    let generation = runtime.tab_panel_visibility_generation.fetch_add(1, Ordering::SeqCst) + 1;
    app.emit("sia://floating-tab-panel-visibility", false)
        .map_err(|error| error.to_string())?;

    let hide_app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(TAB_PANEL_TRANSITION_DURATION);
        if runtime.tab_panel_visibility_generation.load(Ordering::SeqCst) != generation {
            return;
        }
        let main_thread_app = hide_app.clone();
        let _ = hide_app.run_on_main_thread(move || {
            if runtime.tab_panel_visibility_generation.load(Ordering::SeqCst) != generation {
                return;
            }
            if let Some(panel) = main_thread_app.get_webview(TAB_PANEL_LABEL) {
                eprintln!("[tab-panel] hide");
                if let Err(error) = panel.hide() {
                    eprintln!("无法隐藏标签面板子 WebView：{error}");
                    return;
                }
            }
            runtime.tab_panel_visible.store(false, Ordering::SeqCst);
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
    let runtime = app.window_state::<FloatingRuntime>();
    runtime.menu_visibility_generation.fetch_add(1, Ordering::SeqCst);
    if let Some(menu) = app.get_webview_window(MENU_LABEL) {
        eprintln!("[browser-menu] hide");
        // 外部窗口已获焦时，只隐藏菜单，不重新提升浏览器主窗口。
        set_owned_window_visible(&menu, false)?;
    }
    if runtime.tab_panel_menu_hold.swap(false, Ordering::SeqCst) {
        // 标签右键菜单可能超出面板边界；固定模式不能因点击菜单后指针在外而收起。
        if keep_tab_panel_on_pointer_leave(
            &app.window_state::<TabPanelStore>(),
            cursor_inside_tab_panel(app),
        )? {
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

/// 仅同一工具栏入口的显式点击会收起面板；自动更新和其他入口仍显示新内容。
fn should_toggle_menu(visible: bool, current: &Value, next: &Value) -> bool {
    visible && next.get("toggleKey").and_then(Value::as_str)
        .is_some_and(|key| current.get("panelKey").and_then(Value::as_str) == Some(key))
}

/// 前台窗口属于其他进程时立即关闭；空句柄代表系统正在切换焦点，留待下次检查。
fn lost_browser_focus(foreground_process: u32, browser_process: u32) -> bool {
    foreground_process != 0 && foreground_process != browser_process
}

/// 触发按钮自身的点击交给切换命令处理，防止鼠标监视器先关后开。
#[cfg(windows)]
fn cursor_on_menu_trigger(app: &AppHandle, cursor: POINT) -> bool {
    let state = app.window_state::<BrowserMenuStore>();
    let Ok(Some(state)) = read_menu_state(&state) else { return false; };
    let Some(bounds) = state.payload.get("triggerBounds") else { return false; };
    // 主窗口托管多个子 WebView，必须读取 Window，不能按单 WebView 窗口查询。
    let Some(main) = app.get_window("main") else { return false; };
    let (Ok(origin), Ok(scale)) = (main.inner_position(), main.scale_factor()) else { return false; };
    let x = (cursor.x - origin.x) as f64 / scale;
    let y = (cursor.y - origin.y) as f64 / scale;
    let left = bounds["x"].as_f64().unwrap_or(-1.0);
    let top = bounds["y"].as_f64().unwrap_or(-1.0);
    x >= left && x < left + bounds["width"].as_f64().unwrap_or(0.0)
        && y >= top && y < top + bounds["height"].as_f64().unwrap_or(0.0)
}

#[cfg(windows)]
fn start_menu_pointer_watcher(app: &AppHandle) {
    let runtime = app.window_state::<FloatingRuntime>();
    let generation = runtime.menu_visibility_generation.fetch_add(1, Ordering::SeqCst) + 1;
    let watcher_app = app.clone();
    std::thread::spawn(move || {
        let mut pointer_released_after_open = false;
        loop {
            std::thread::sleep(Duration::from_millis(16));
            if runtime.menu_visibility_generation.load(Ordering::SeqCst) != generation {
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
            let mut cursor_inside = unsafe {
                GetCursorPos(&mut cursor).is_ok()
                    && GetWindowRect(hwnd, &mut rect).is_ok()
                    && cursor.x >= rect.left
                    && cursor.x < rect.right
                    && cursor.y >= rect.top
                    && cursor.y < rect.bottom
            };
            if cursor_inside {
                // 用实际窗口形状判断外部点击，级联菜单预留的透明画布也属于外部。
                let region = unsafe { CreateRectRgn(0, 0, 0, 0) };
                if !region.is_invalid() {
                    if unsafe { GetWindowRgn(hwnd, region) }.0 != 0 {
                        cursor_inside = unsafe { PtInRegion(region, cursor.x - rect.left, cursor.y - rect.top) }.as_bool();
                    }
                    unsafe { let _ = DeleteObject(region.into()); }
                }
            }
            let pointer_down = unsafe {
                [VK_LBUTTON, VK_RBUTTON, VK_MBUTTON]
                    .into_iter()
                    .any(|key| (GetAsyncKeyState(key.0 as i32) as u16 & 0x8000) != 0)
            };
            let mut foreground_process = 0;
            unsafe { GetWindowThreadProcessId(GetForegroundWindow(), Some(&mut foreground_process)); }
            let foreground = unsafe { GetForegroundWindow() };
            let main_hwnd = watcher_app.get_window("main").and_then(|window| window.hwnd().ok());
            let focus_lost = lost_browser_focus(foreground_process, std::process::id())
                || (!foreground.is_invalid() && foreground != hwnd && Some(foreground) != main_hwnd);
            if !pointer_down {
                pointer_released_after_open = true;
            }
            let outside_press = pointer_released_after_open && pointer_down && !cursor_inside
                && !cursor_on_menu_trigger(&watcher_app, cursor);
            if focus_lost || outside_press {
                let close_app = watcher_app.clone();
                let _ = watcher_app.run_on_main_thread(move || {
                    // 关闭任务真正执行时再次核对代次，不能误关刚切换到的面板。
                    if runtime.menu_visibility_generation.load(Ordering::SeqCst) == generation {
                        let _ = hide_menu(&close_app);
                    }
                });
                return;
            }
        }
    });
}

#[cfg(not(windows))]
fn start_menu_pointer_watcher(_app: &AppHandle) {}

pub fn initialize(app: &AppHandle) -> Result<(), String> {
    let runtime = app.window_state::<FloatingRuntime>();
    // 标签面板使用主窗口内部的子 WebView，网页和面板由同一个窗口托管。
    // 这样面板不会出现在任务栏或 Alt+Tab，也不再需要同步屏幕坐标和窗口焦点。
    tab_panel_webview(app)?;
    menu_window(app)?;
    tab_tooltip_window(app)?;

    let sync_app = app.clone();
    let main = app
        .get_window("main")
        .ok_or_else(|| "找不到浏览器主窗口".to_string())?;
    main.on_window_event(move |event| {
        // 窗口几何或焦点改变时，旧锚点不再有效，立即关闭只读提示。
        if matches!(event, WindowEvent::Focused(false) | WindowEvent::Moved(_) | WindowEvent::Resized(_) | WindowEvent::ScaleFactorChanged { .. }) {
            let _ = close_browser_tab_tooltip(sync_app.clone());
        }
        let should_hide = matches!(
            event,
            WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed
        ) || matches!(
            event,
            WindowEvent::Resized(size) if size.width == 0 || size.height == 0
        );
        if should_hide {
            let _ = close_browser_tab_tooltip(sync_app.clone());
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
        if !runtime.tab_panel_visible.load(Ordering::SeqCst) {
            return;
        }
        let tab_store = sync_app.window_state::<TabPanelStore>();
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
    let runtime = app.window_state::<FloatingRuntime>();
    runtime.tab_panel_visibility_generation.fetch_add(1, Ordering::SeqCst);
    let panel = tab_panel_webview(app)?;
    eprintln!(
        "[tab-panel] show x={} y={} width={} height={}",
        bounds.x, bounds.y, bounds.width, bounds.height
    );
    sync_tab_panel_bounds(&panel, bounds)?;
    panel.emit_to(tauri::EventTarget::webview(panel.label()), "sia://floating-tab-panel-state", payload)
        .map_err(|error| error.to_string())?;
    app.emit("sia://floating-tab-panel-visibility", true)
        .map_err(|error| error.to_string())?;
    panel.show().map_err(|error| error.to_string())?;
    runtime.tab_panel_visible.store(true, Ordering::SeqCst);
    raise_tab_panel_webview(&panel)?;
    Ok(())
}

pub fn raise_tab_panel_if_visible(app: &AppHandle) {
    let runtime = app.window_state::<FloatingRuntime>();
    if !runtime.tab_panel_visible.load(Ordering::SeqCst) {
        return;
    }
    if let Some(panel) = app.get_webview(TAB_PANEL_LABEL) {
        let _ = raise_tab_panel_webview(&panel);
    }
}

#[tauri::command]
pub async fn open_floating_tab_panel(
    app: AppHandle,
    store: WindowState<TabPanelStore>,
    payload: Value,
    bounds: FloatingWindowBounds,
) -> Result<(), String> {
    // IPC 可早于 setup 完成到达，异步等待可防止同线程重入 WebView 创建锁。
    app.window_state::<crate::browser_startup::BrowserStartup>().wait().await?;
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
    store: WindowState<TabPanelStore>,
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
        panel.emit_to(tauri::EventTarget::webview(panel.label()), "sia://floating-tab-panel-state", payload)
            .map_err(|error| error.to_string())?;
        raise_tab_panel_if_visible(&app);
    }
    Ok(())
}

#[tauri::command]
pub fn get_floating_tab_panel_state(
    store: WindowState<TabPanelStore>,
) -> Result<Option<Value>, String> {
    read_tab_panel_state(&store).map(|state| state.map(|entry| entry.payload))
}

#[tauri::command]
pub fn close_floating_tab_panel(app: AppHandle) -> Result<(), String> {
    hide_tab_panel(&app)
}

#[tauri::command]
/// 指针移到未固定面板外时收起；固定面板保持显示，读取状态失败时返回错误。
pub fn close_floating_tab_panel_if_pointer_outside(app: AppHandle) -> Result<(), String> {
    if keep_tab_panel_on_pointer_leave(
        &app.window_state::<TabPanelStore>(),
        cursor_inside_tab_panel(&app),
    )? {
        return Ok(());
    }
    hide_tab_panel(&app)
}

#[tauri::command]
pub fn floating_tab_panel_action(
    app: AppHandle,
    store: WindowState<TabPanelStore>,
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
                panel.emit_to(tauri::EventTarget::webview(panel.label()), "sia://floating-tab-panel-state", payload)
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
    mut payload: Value,
    source_window: String,
    bounds: FloatingWindowBounds,
) -> Result<(), String> {
    let runtime = app.window_state::<FloatingRuntime>();
    close_browser_tab_tooltip(app.clone())?;
    let current = read_menu_state(store)?.map(|state| state.payload).unwrap_or(Value::Null);
    if should_toggle_menu(menu_is_visible(app), &current, &payload) {
        return hide_menu(app);
    }
    if source_window == app.label(TAB_PANEL_LABEL) || source_window == TAB_PANEL_LABEL {
        runtime.tab_panel_menu_hold.store(true, Ordering::SeqCst);
        runtime.tab_panel_visibility_generation.fetch_add(1, Ordering::SeqCst);
        if runtime.tab_panel_visible.load(Ordering::SeqCst) {
            app.emit("sia://floating-tab-panel-visibility", true)
                .map_err(|error| error.to_string())?;
            raise_tab_panel_if_visible(app);
        }
    }
    let (source_window, bounds) = prepare_cascade_menu(app, &mut payload, source_window, bounds)?;
    payload["hitRegionRevision"] = Value::from(runtime.menu_region_revision.fetch_add(1, Ordering::SeqCst) + 1);
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
        menu.emit_to(tauri::EventTarget::webview(menu.label()), "sia://browser-menu-state", payload)
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
            menu.emit_to(tauri::EventTarget::webview(menu.label()), "sia://browser-menu-state", payload)
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
pub fn get_browser_menu_state(store: WindowState<BrowserMenuStore>) -> Result<Option<Value>, String> {
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[cfg(windows)]
    #[test]
    fn menu_region_excludes_transparent_padding_and_unused_cascade_canvas() {
        // 直接使用 Windows 区域 API 验证缩放后的命中，不以 CSS 透明度代替原生结果。
        for scale in [1.0, 1.25, 1.5, 2.0] {
            let root = MenuSurfaceRegion { x: 20.0, y: 20.0, width: 304.0, height: 494.0, radius: 12.0 };
            let child = MenuSurfaceRegion { x: 330.0, y: 60.0, width: 260.0, height: 160.0, radius: 8.0 };
            let contains = |region: HRGN, x: f64, y: f64| unsafe {
                PtInRegion(region, (x * scale) as i32, (y * scale) as i32).as_bool()
            };
            let region = create_menu_region(&[root.clone()], scale).unwrap();
            assert!(contains(region, 100.0, 100.0));
            assert!(!contains(region, 100.0, 10.0), "面板上方透明边距必须穿透");
            assert!(!contains(region, 10.0, 100.0));
            assert!(!contains(region, 400.0, 100.0), "预留画布不能挡住底层网页");
            assert!(!contains(region, 20.0, 20.0), "圆角外的透明角落必须穿透");
            unsafe { let _ = DeleteObject(region.into()); }
            let region = create_menu_region(&[root, child], scale).unwrap();
            assert!(contains(region, 400.0, 100.0), "已展开的子菜单必须能够点击");
            assert!(!contains(region, 400.0, 300.0));
            assert!(!contains(region, 327.0, 100.0), "两个面板之间不应连成大矩形");
            unsafe { let _ = DeleteObject(region.into()); }
            let region = create_menu_region(&[], scale).unwrap();
            assert!(!contains(region, 100.0, 100.0), "等待新布局时不可沿用上次的命中范围");
            unsafe { let _ = DeleteObject(region.into()); }
        }
    }

    #[cfg(windows)]
    #[test]
    fn menu_paint_region_preserves_shadow_without_filling_unused_canvas() {
        for scale in [1.0, 1.25, 1.5, 2.0] {
            let surface = MenuSurfaceRegion { x: 20.0, y: 20.0, width: 360.0, height: 200.0, radius: 12.0 };
            let region = create_menu_paint_region(&[surface], scale).unwrap();
            unsafe {
                assert!(PtInRegion(region, (12.0 * scale) as i32, (100.0 * scale) as i32).as_bool(), "左侧阴影不能被窗口形状裁掉");
                assert!(PtInRegion(region, (100.0 * scale) as i32, (228.0 * scale) as i32).as_bool(), "底部阴影不能被裁掉");
                assert!(!PtInRegion(region, (500.0 * scale) as i32, (300.0 * scale) as i32).as_bool());
                let _ = DeleteObject(region.into());
            }
        }
    }

    #[test]
    fn cascade_canvas_keeps_root_and_fits_both_edges_at_high_dpi() {
        // 左侧菜单向右展开，右侧菜单向左腾出空间；坐标支持负屏幕原点及缩放。
        for scale in [1.0, 1.5, 2.0] {
            let main = (-1000, 80, (1000.0 * scale) as u32, (800.0 * scale) as u32);
            let root_width = (344.0 * scale) as u32;
            for x in [main.0, main.0 + (main.2 - root_width) as i32] {
                let root = (x, 100, root_width, (534.0 * scale) as u32);
                let canvas = cascade_canvas(root, main, scale, 1);
                assert!(canvas.0 <= root.0);
                assert!(canvas.0 + canvas.2 as i32 >= root.0 + root.2 as i32);
                assert!(canvas.0 >= main.0 && canvas.0 + canvas.2 as i32 <= main.0 + main.2 as i32);
                assert!(canvas.1 >= main.1 && canvas.1 + canvas.3 as i32 <= main.1 + main.3 as i32);
            }
        }
    }

    #[test]
    fn toolbar_toggle_uses_identity_and_explicit_user_intent() {
        let current = json!({"panelKey": "downloads"});
        let click = json!({"panelKey": "downloads", "toggleKey": "downloads"});
        // 自动打开后点击同一按钮应关闭；隐藏后点击则打开。
        assert!(should_toggle_menu(true, &current, &click));
        assert!(!should_toggle_menu(false, &current, &click));
        // 下载进度刷新和切换到其他面板不能被识别成关闭。
        assert!(!should_toggle_menu(true, &current, &current));
        assert!(!should_toggle_menu(true, &current, &json!({"toggleKey": "more"})));
        assert!(!should_toggle_menu(true, &Value::Null, &click));
    }

    #[test]
    fn focus_within_browser_keeps_panel_and_other_apps_close_it() {
        assert!(!lost_browser_focus(42, 42));
        assert!(!lost_browser_focus(0, 42));
        assert!(lost_browser_focus(84, 42));
    }

    /// 使用内存状态验证面板决策，不创建窗口、不读取浏览器会话。
    fn panel_store(payload: Value) -> TabPanelStore {
        TabPanelStore(Mutex::new(Some(FloatingWindowState {
            payload,
            bounds: FloatingWindowBounds {
                x: 0.0,
                y: 40.0,
                width: 292.0,
                height: 800.0,
            },
        })))
    }

    #[test]
    fn duplicate_menu_outside_pinned_panel_keeps_tabs_visible() {
        // 复制菜单可以超出左侧面板；点击后指针在外部也不能收起固定面板。
        let store = panel_store(json!({ "panelPinned": true }));
        assert!(keep_tab_panel_on_pointer_leave(&store, false).unwrap());
        assert!(keep_tab_panel_on_pointer_leave(&store, true).unwrap());
    }

    #[test]
    fn floating_panel_closes_only_after_pointer_leaves() {
        let store = panel_store(json!({ "panelPinned": false }));
        assert!(keep_tab_panel_on_pointer_leave(&store, true).unwrap());
        assert!(!keep_tab_panel_on_pointer_leave(&store, false).unwrap());
    }

    #[test]
    fn latest_pin_state_controls_pending_pointer_events() {
        let store = panel_store(json!({ "panelPinned": false }));
        // 面板刚固定时，之前排队的鼠标移出请求必须读取最新状态。
        store.0.lock().unwrap().as_mut().unwrap().payload["panelPinned"] = json!(true);
        assert!(keep_tab_panel_on_pointer_leave(&store, false).unwrap());
        store.0.lock().unwrap().as_mut().unwrap().payload["panelPinned"] = json!(false);
        assert!(!keep_tab_panel_on_pointer_leave(&store, false).unwrap());
    }

    #[test]
    fn missing_pin_state_preserves_floating_panel_behavior() {
        for store in [TabPanelStore::default(), panel_store(json!({}))] {
            assert!(keep_tab_panel_on_pointer_leave(&store, true).unwrap());
            assert!(!keep_tab_panel_on_pointer_leave(&store, false).unwrap());
        }
    }
}
