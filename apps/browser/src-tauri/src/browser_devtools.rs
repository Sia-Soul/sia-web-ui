//! Windows 开发者工具停靠；不开放调试端口，也不接管其他进程或无法确定归属的窗口。
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    sync::Mutex,
};
use tauri::{AppHandle, Manager};

/// 前端布局使用 CSS 像素，原生窗口定位时再按主窗口 DPI 转换。
#[derive(Clone, Copy, Deserialize)]
pub struct DockBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

/// 仅报告已确认归属的开发者工具窗口；独立模式不占据网页布局。
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockStatus {
    tab_id: String,
    docked: bool,
}

/// 操作队列不阻塞 UI 线程；普通状态锁绝不跨越 COM 或 Win32 调用持有。
#[derive(Default)]
pub struct DevtoolsStore {
    // 只串行化打开请求；窗口布局和关闭不等待 COM 创建流程。
    operations: tokio::sync::Mutex<()>,
    mutations: tokio::sync::Mutex<()>,
    entries: Mutex<HashMap<String, NativeWindow>>,
    pending: Mutex<HashSet<String>>,
}

/// 打开期间关闭标签会撤销此令牌；任何返回路径都清理标记，不留下过期请求。
struct PendingOpen<'a> {
    pending: &'a Mutex<HashSet<String>>,
    tab_id: String,
}
impl Drop for PendingOpen<'_> {
    fn drop(&mut self) {
        if let Ok(mut pending) = self.pending.lock() {
            pending.remove(&self.tab_id);
        }
    }
}

#[derive(Clone)]
struct NativeWindow {
    handle: isize,
    process_id: u32,
    title: String,
    style: i32,
    ex_style: i32,
    original_rect: [i32; 4],
    // 保存原窗口裁剪区，独立显示时还原；u32 缓冲区满足 RGNDATA 的对齐要求。
    original_region: Option<Vec<u32>>,
    docked: bool,
    // 缓存上一次物理区域，轮询关闭状态时不反复重画跨进程窗口。
    last_layout: Option<[i32; 4]>,
    // 内容暂未就绪时允许短暂重试，持续无法裁剪则退回独立窗口。
    layout_failures: u8,
}

#[cfg(windows)]
mod native {
    use super::*;
    use windows::{
        core::BOOL,
        Win32::{
            Foundation::{HWND, LPARAM, RECT, WPARAM},
            Graphics::Gdi::*,
            UI::{
                HiDpi::{AreDpiAwarenessContextsEqual, GetWindowDpiAwarenessContext},
                WindowsAndMessaging::*,
            },
        },
    };

    fn hwnd(value: isize) -> HWND {
        HWND(value as *mut std::ffi::c_void)
    }

    /// 窗口句柄可能被系统复用，每次操作前同时验证进程和 Chromium 窗口类。
    pub fn belongs(window: &NativeWindow) -> bool {
        unsafe {
            let mut pid = 0;
            GetWindowThreadProcessId(hwnd(window.handle), Some(&mut pid));
            let mut class = [0u16; 128];
            let count = GetClassNameW(hwnd(window.handle), &mut class);
            pid == window.process_id
                && count > 0
                && String::from_utf16_lossy(&class[..count as usize]) == "Chrome_WidgetWin_1"
        }
    }

    /// 只枚举顶层 DevTools；标题只是附加筛选，归属还须匹配 WebView2 的进程及打开前快照。
    pub fn candidates(pid: u32) -> Vec<NativeWindow> {
        struct Search {
            pid: u32,
            windows: Vec<NativeWindow>,
        }
        unsafe extern "system" fn visit(handle: HWND, data: LPARAM) -> BOOL {
            let search = &mut *(data.0 as *mut Search);
            let mut window = NativeWindow {
                handle: handle.0 as isize,
                process_id: search.pid,
                title: String::new(),
                style: 0,
                ex_style: 0,
                original_rect: [0; 4],
                original_region: None,
                docked: false,
                last_layout: None,
                layout_failures: 0,
            };
            if !belongs(&window) {
                return BOOL(1);
            }
            let mut title = [0u16; 2048];
            let length = GetWindowTextW(handle, &mut title);
            if length <= 0
                || !String::from_utf16_lossy(&title[..length as usize]).starts_with("DevTools")
            {
                return BOOL(1);
            }
            let mut rect = RECT::default();
            window.title = String::from_utf16_lossy(&title[..length as usize]);
            if GetWindowRect(handle, &mut rect).is_ok() {
                window.style = GetWindowLongW(handle, GWL_STYLE);
                window.ex_style = GetWindowLongW(handle, GWL_EXSTYLE);
                window.original_rect = [
                    rect.left,
                    rect.top,
                    rect.right - rect.left,
                    rect.bottom - rect.top,
                ];
                search.windows.push(window);
            }
            BOOL(1)
        }
        let mut search = Search {
            pid,
            windows: Vec::new(),
        };
        unsafe {
            let _ = EnumWindows(Some(visit), LPARAM(&mut search as *mut _ as isize));
        }
        search.windows
    }

    /// 从 DevTools 网页渲染子窗口测量内容边界，兼容 Chromium 自绘标题栏和不同 DPI。
    fn content_insets(child: HWND) -> Option<[i32; 4]> {
        unsafe extern "system" fn visit(handle: HWND, data: LPARAM) -> BOOL {
            let matches = &mut *(data.0 as *mut Vec<RECT>);
            let mut class = [0u16; 128];
            let length = GetClassNameW(handle, &mut class);
            if length > 0
                && String::from_utf16_lossy(&class[..length as usize])
                    == "Chrome_RenderWidgetHostHWND"
                && GetWindowLongW(handle, GWL_STYLE) as u32 & WS_VISIBLE.0 != 0
            {
                let mut rect = RECT::default();
                if GetWindowRect(handle, &mut rect).is_ok()
                    && rect.right > rect.left
                    && rect.bottom > rect.top
                {
                    matches.push(rect);
                }
            }
            BOOL(1)
        }
        unsafe {
            let mut outer = RECT::default();
            GetWindowRect(child, &mut outer).ok()?;
            let mut matches = Vec::<RECT>::new();
            let _ = EnumChildWindows(
                Some(child),
                Some(visit),
                LPARAM(&mut matches as *mut _ as isize),
            );
            // 多个渲染子窗口无法确定内容归属时不猜测裁剪范围。
            if matches.len() != 1 {
                return None;
            }
            let content = matches[0];
            let insets = [
                content.left - outer.left,
                content.top - outer.top,
                outer.right - content.right,
                outer.bottom - content.bottom,
            ];
            insets.iter().all(|value| *value >= 0).then_some(insets)
        }
    }

    /// 复制裁剪数据而非共享 GDI 句柄，防止状态克隆后重复释放系统资源。
    unsafe fn save_region(child: HWND) -> Result<Option<Vec<u32>>, String> {
        let region = CreateRectRgn(0, 0, 0, 0);
        if region.is_invalid() {
            return Err("无法保存开发者工具窗口区域".into());
        }
        let result = if GetWindowRgn(child, region) == GDI_REGION_TYPE(0) {
            Ok(None)
        } else {
            let bytes = GetRegionData(region, 0, None);
            let mut data = vec![0u32; (bytes as usize).div_ceil(4)];
            if bytes == 0 || GetRegionData(region, bytes, Some(data.as_mut_ptr().cast())) != bytes {
                Err("无法读取开发者工具窗口区域".into())
            } else {
                Ok(Some(data))
            }
        };
        let _ = DeleteObject(region.into());
        result
    }

    /// SetWindowRgn 成功后句柄归系统所有；失败路径由调用方释放。
    unsafe fn apply_region(child: HWND, region: Option<HRGN>) -> Result<(), String> {
        if region.is_some_and(|region| region.is_invalid())
            || SetWindowRgn(child, region, true) == 0
        {
            if let Some(region) = region {
                let _ = DeleteObject(region.into());
            }
            return Err("无法更新开发者工具窗口区域".into());
        }
        Ok(())
    }

    /// DPI 模式不一致时保持独立窗口，避免 SetParent 重置整个网页进程的 DPI 状态。
    pub fn dock(window: &mut NativeWindow, parent: isize) -> Result<(), String> {
        if !belongs(window) {
            return Err("开发者工具窗口已经关闭".into());
        }
        unsafe {
            let child = hwnd(window.handle);
            let parent = hwnd(parent);
            if !AreDpiAwarenessContextsEqual(
                GetWindowDpiAwarenessContext(child),
                GetWindowDpiAwarenessContext(parent),
            )
            .as_bool()
            {
                return Err("开发者工具与主窗口的 DPI 模式不一致，已保留独立窗口".into());
            }
            // 无响应的内核不执行跨进程重设父窗口，防止布局任务长期等待。
            if IsHungAppWindow(child).as_bool() {
                return Err("开发者工具尚未响应，已保留独立窗口".into());
            }
            window.original_region = save_region(child)?;
            let _ = ShowWindowAsync(child, SW_HIDE);
            let style = (window.style as u32
                & !(WS_POPUP.0
                    | WS_CAPTION.0
                    | WS_THICKFRAME.0
                    | WS_SYSMENU.0
                    | WS_MINIMIZEBOX.0
                    | WS_MAXIMIZEBOX.0))
                | WS_CHILD.0;
            SetWindowLongW(child, GWL_STYLE, style as i32);
            SetWindowLongW(
                child,
                GWL_EXSTYLE,
                (window.ex_style as u32
                    & !(WS_EX_APPWINDOW.0 | WS_EX_WINDOWEDGE.0 | WS_EX_CLIENTEDGE.0))
                    as i32,
            );
            if let Err(error) = SetParent(child, Some(parent)) {
                // 原窗口没有父级时，Win32 成功也返回 NULL；用实际父级区分失败。
                if GetParent(child).ok() == Some(parent) {
                    window.docked = true;
                    return Ok(());
                }
                SetWindowLongW(child, GWL_STYLE, window.style);
                SetWindowLongW(child, GWL_EXSTYLE, window.ex_style);
                let _ = ShowWindowAsync(child, SW_SHOWNORMAL);
                return Err(format!("无法停靠开发者工具，已保留独立窗口：{error}"));
            }
            window.docked = true;
        }
        Ok(())
    }

    /// 恢复系统窗口样式和原始屏幕位置，保留同一个调试会话。
    pub fn detach(window: &mut NativeWindow) -> Result<(), String> {
        if !belongs(window) {
            return Ok(());
        }
        unsafe {
            let child = hwnd(window.handle);
            SetParent(child, None).map_err(|error| error.to_string())?;
            SetWindowLongW(child, GWL_STYLE, window.style);
            SetWindowLongW(child, GWL_EXSTYLE, window.ex_style);
            // 独立窗口恢复完整标题栏及原裁剪区，不保留停靠时的内容裁剪。
            let region = window
                .original_region
                .as_ref()
                .map(|data| ExtCreateRegion(None, (data.len() * 4) as u32, data.as_ptr().cast()));
            apply_region(child, region)?;
            let [x, y, width, height] = window.original_rect;
            SetWindowPos(
                child,
                None,
                x,
                y,
                width,
                height,
                SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_ASYNCWINDOWPOS,
            )
            .map_err(|error| error.to_string())?;
            let _ = ShowWindowAsync(child, SW_SHOWNORMAL);
            window.docked = false;
            window.last_layout = None;
            window.layout_failures = 0;
        }
        Ok(())
    }

    /// 异步渲染就绪前不露出窗框；连续五次无法确定内容时恢复可操作的独立窗口。
    fn retry_layout_or_detach(window: &mut NativeWindow) {
        window.last_layout = None;
        window.layout_failures = window.layout_failures.saturating_add(1);
        if window.layout_failures >= 5 {
            let _ = detach(window);
        } else {
            unsafe {
                let _ = ShowWindowAsync(hwnd(window.handle), SW_HIDE);
            }
        }
    }

    /// 隐藏后台标签的工具；异步窗口消息不等待网页进程处理绘制和焦点。
    pub fn layout(window: &mut NativeWindow, bounds: Option<DockBounds>, scale: f64) {
        if !belongs(window) || !window.docked {
            return;
        }
        let next = bounds.map(|bounds| physical_bounds(bounds, scale));
        unsafe {
            let child = hwnd(window.handle);
            // Chromium 的自绘窗框不受 WS_CAPTION 控制；只显示实际网页内容，并补偿外框尺寸。
            // 每次同步重新测量，可处理异步创建内容、缩放和内核重置裁剪区的情况。
            if let Some([x, y, width, height]) = next {
                let Some([left, top, right, bottom]) = content_insets(child) else {
                    retry_layout_or_detach(window);
                    return;
                };
                let outer = [
                    x - left,
                    y - top,
                    width + left + right,
                    height + top + bottom,
                ];
                let expected_region = RECT {
                    left,
                    top,
                    right: left + width,
                    bottom: top + height,
                };
                let mut current_region = RECT::default();
                let region_matches = GetWindowRgnBox(child, &mut current_region) == SIMPLEREGION
                    && current_region == expected_region;
                let visible = GetWindowLongW(child, GWL_STYLE) as u32 & WS_VISIBLE.0 != 0;
                if window.last_layout == Some(outer) && visible && region_matches {
                    return;
                }
                // 先约束绘制与命中区域，裁掉的标题栏不会覆盖或拦截西娅自己的工具栏。
                if !region_matches
                    && apply_region(
                        child,
                        Some(CreateRectRgn(left, top, left + width, top + height)),
                    )
                    .is_err()
                {
                    retry_layout_or_detach(window);
                    return;
                }
                if SetWindowPos(
                    child,
                    Some(HWND_TOP),
                    outer[0],
                    outer[1],
                    outer[2],
                    outer[3],
                    SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_ASYNCWINDOWPOS,
                )
                .is_err()
                {
                    retry_layout_or_detach(window);
                    return;
                }
                let _ = ShowWindowAsync(child, SW_SHOWNOACTIVATE);
                window.last_layout = Some(outer);
                window.layout_failures = 0;
            } else {
                // 上一次显示消息可能仍在队列中；即使当前不可见也排入隐藏，保证切页顺序。
                let _ = ShowWindowAsync(child, SW_HIDE);
                window.last_layout = None;
                window.layout_failures = 0;
            }
        }
    }

    /// 只向已验证的工具窗口投递关闭消息，不结束浏览器或网页进程。
    pub fn close(window: &NativeWindow) {
        if belongs(window) {
            unsafe {
                let _ = PostMessageW(Some(hwnd(window.handle)), WM_CLOSE, WPARAM(0), LPARAM(0));
            }
        }
    }
}

/// 将已校验的逻辑区域转换为物理像素，低于一个像素的尺寸按一个像素处理。
fn physical_bounds(bounds: DockBounds, scale: f64) -> [i32; 4] {
    [
        (bounds.x * scale).round() as i32,
        (bounds.y * scale).round() as i32,
        (bounds.width * scale).round().max(1.) as i32,
        (bounds.height * scale).round().max(1.) as i32,
    ]
}

/// DevTools 会省略 HTTP(S) 协议；其余主机、端口和文档路径仍须完整匹配。
fn title_matches_document(title: &str, source: &str) -> bool {
    let Some(document) = title.strip_prefix("DevTools - ") else {
        return false;
    };
    document == source
        || source
            .strip_prefix("http://")
            .or_else(|| source.strip_prefix("https://"))
            == Some(document)
}

/// 页面切换立即撤销旧标签的窗口发现，避免将后来通过其他标签“检查”打开的工具认领过来。
pub fn cancel_pending_except(app: &AppHandle, label: Option<&str>) {
    if let Ok(mut pending) = app.state::<DevtoolsStore>().pending.lock() {
        pending.retain(|id| Some(crate::browser_label(id).as_str()) == label);
    }
}

/// 已有未知窗口直接独立回退；仅在目标标签仍活动、且本次唯一新窗口出现时认领。
#[tauri::command]
pub async fn open_browser_devtools(app: AppHandle, tab_id: String) -> Result<bool, String> {
    let store = app.state::<DevtoolsStore>();
    let _operation = store.operations.lock().await;
    let view = app
        .get_webview(&crate::browser_label(&tab_id))
        .ok_or("当前标签页还没有打开网页")?;
    store
        .pending
        .lock()
        .map_err(|_| "无法登记工具请求")?
        .insert(tab_id.clone());
    let _pending = PendingOpen {
        pending: &store.pending,
        tab_id: tab_id.clone(),
    };
    #[cfg(windows)]
    {
        let parent = app
            .get_window("main")
            .ok_or("找不到浏览器主窗口")?
            .hwnd()
            .map_err(|e| e.to_string())?
            .0 as isize;
        let mutation = store.mutations.lock().await;
        let existing = store
            .entries
            .lock()
            .map_err(|_| "无法读取工具窗口")?
            .get(&tab_id)
            .cloned();
        if let Some(mut existing) = existing.filter(native::belongs) {
            if !existing.docked {
                existing = tauri::async_runtime::spawn_blocking(move || {
                    native::dock(&mut existing, parent)?;
                    Ok::<_, String>(existing)
                })
                .await
                .map_err(|e| e.to_string())??;
                store
                    .entries
                    .lock()
                    .map_err(|_| "无法记录工具窗口")?
                    .insert(tab_id, existing);
            }
            return Ok(true);
        }
        // 已知独立窗口可按原标签复用；未知窗口宁可独立显示，也不能依靠共享 PID 猜测标签。
        let known = store
            .entries
            .lock()
            .map_err(|_| "无法读取工具窗口")?
            .values()
            .map(|window| window.handle)
            .collect::<Vec<_>>();
        drop(mutation);
        // 打开前快照与 COM 调用在同一回调内；发现阶段不阻塞布局及关闭操作。
        let (send, receive) = tokio::sync::oneshot::channel();
        view.with_webview(move |platform| {
            let result = (|| unsafe {
                let core = platform.controller().CoreWebView2()?;
                let mut pid = 0;
                core.BrowserProcessId(&mut pid)?;
                let mut source = windows::core::PWSTR::null();
                core.Source(&mut source)?;
                let source = webview2_com::CoTaskMemPWSTR::from(source).to_string();
                let before = native::candidates(pid);
                core.OpenDevToolsWindow()?;
                let safe = !before.iter().any(|window| !known.contains(&window.handle));
                Ok::<_, windows::core::Error>((pid, before, safe, source))
            })()
            .map_err(|e| e.to_string());
            let _ = send.send(result);
        })
        .map_err(|e| e.to_string())?;
        let (pid, before, safe, source) =
            tokio::time::timeout(std::time::Duration::from_secs(5), receive)
                .await
                .map_err(|_| "打开开发者工具超时")?
                .map_err(|_| "网页视图已经关闭")??;
        if !safe {
            return Ok(false);
        }
        let mut found = None;
        for _ in 0..50 {
            if !store
                .pending
                .lock()
                .map_err(|_| "无法读取工具请求")?
                .contains(&tab_id)
            {
                return Ok(false);
            }
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            let candidates = tauri::async_runtime::spawn_blocking(move || native::candidates(pid))
                .await
                .map_err(|e| e.to_string())?;
            let mut new = candidates
                .into_iter()
                .filter(|candidate| !before.iter().any(|old| old.handle == candidate.handle))
                .collect::<Vec<_>>();
            if new.len() > 1 {
                return Ok(false);
            }
            if let Some(window) = new.pop() {
                // 共享进程中仍须匹配被调试文档地址；标题未就绪或导航已变化时继续保持独立。
                if title_matches_document(&window.title, &source) {
                    found = Some(window);
                    break;
                }
            }
        }
        let Some(mut found) = found else {
            return Ok(false);
        };
        let _mutation = store.mutations.lock().await;
        // 标签关闭会使 WebView 退出注册表，不得将失效会话重新加入布局。
        if !store
            .pending
            .lock()
            .map_err(|_| "无法读取工具请求")?
            .contains(&tab_id)
            || app.get_webview(&crate::browser_label(&tab_id)).is_none()
        {
            // 取消后不再认领或关闭候选窗口，它可能来自后来活动的另一个标签。
            return Ok(false);
        }
        found = tauri::async_runtime::spawn_blocking(move || {
            native::dock(&mut found, parent)?;
            Ok::<_, String>(found)
        })
        .await
        .map_err(|e| e.to_string())??;
        store
            .entries
            .lock()
            .map_err(|_| "无法记录工具窗口")?
            .insert(tab_id, found);
        Ok(true)
    }
    #[cfg(not(windows))]
    {
        view.open_devtools();
        Ok(false)
    }
}

/// 同步当前页的停靠区域，并回收用户从 DevTools 内部关闭的窗口记录。
#[tauri::command]
pub async fn layout_browser_devtools(
    app: AppHandle,
    tab_id: String,
    bounds: Option<DockBounds>,
) -> Result<Vec<DockStatus>, String> {
    if bounds.is_some_and(|b| {
        ![b.x, b.y, b.width, b.height].iter().all(|n| n.is_finite())
            || b.width < 0.
            || b.height < 0.
    }) {
        return Err("开发者工具区域无效".into());
    }
    let store = app.state::<DevtoolsStore>();
    let _mutation = store.mutations.lock().await;
    #[cfg(windows)]
    {
        let scale = app
            .get_window("main")
            .ok_or("找不到主窗口")?
            .scale_factor()
            .map_err(|e| e.to_string())?;
        let entries = store
            .entries
            .lock()
            .map_err(|_| "无法读取工具窗口")?
            .clone();
        let live = tauri::async_runtime::spawn_blocking(move || {
            entries
                .into_iter()
                .filter_map(|(id, mut window)| {
                    if !native::belongs(&window) {
                        return None;
                    }
                    native::layout(&mut window, if id == tab_id { bounds } else { None }, scale);
                    Some((id, window))
                })
                .collect::<HashMap<_, _>>()
        })
        .await
        .map_err(|e| e.to_string())?;
        let statuses = live
            .iter()
            .map(|(id, window)| DockStatus {
                tab_id: id.clone(),
                docked: window.docked,
            })
            .collect();
        *store.entries.lock().map_err(|_| "无法更新工具窗口")? = live;
        Ok(statuses)
    }
    #[cfg(not(windows))]
    {
        Ok(Vec::new())
    }
}

/// 关闭或解除停靠；关闭标签时也使用此入口，清理过程不持有布局状态锁。
#[tauri::command]
pub async fn control_browser_devtools(
    app: AppHandle,
    tab_id: String,
    action: String,
) -> Result<(), String> {
    if action != "close" && action != "detach" {
        return Err("未知开发者工具操作".into());
    }
    let store = app.state::<DevtoolsStore>();
    if action == "close" {
        store
            .pending
            .lock()
            .map_err(|_| "无法取消工具请求")?
            .remove(&tab_id);
    }
    let _mutation = store.mutations.lock().await;
    let entry = store
        .entries
        .lock()
        .map_err(|_| "无法读取工具窗口")?
        .get(&tab_id)
        .cloned();
    #[cfg(windows)]
    if let Some(mut entry) = entry {
        let close = action == "close";
        let entry = tauri::async_runtime::spawn_blocking(move || {
            if close {
                native::close(&entry);
            } else {
                native::detach(&mut entry)?;
            }
            Ok::<_, String>(entry)
        })
        .await
        .map_err(|e| e.to_string())??;
        let mut entries = store.entries.lock().map_err(|_| "无法更新工具窗口")?;
        if close {
            entries.remove(&tab_id);
        } else {
            entries.insert(tab_id, entry);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn dock_coordinates_follow_window_scale() {
        let bounds = DockBounds {
            x: 200.,
            y: 500.,
            width: 900.,
            height: 240.,
        };
        assert_eq!(physical_bounds(bounds, 1.5), [300, 750, 1350, 360]);
    }

    #[test]
    fn titles_match_displayed_urls_without_loosening_document_identity() {
        assert!(title_matches_document(
            "DevTools - 127.0.0.1:8000/one",
            "http://127.0.0.1:8000/one"
        ));
        assert!(title_matches_document(
            "DevTools - example.test/one",
            "https://example.test/one"
        ));
        assert!(title_matches_document(
            "DevTools - about:blank",
            "about:blank"
        ));
        assert!(!title_matches_document(
            "DevTools - 127.0.0.1:8000/two",
            "http://127.0.0.1:8000/one"
        ));
        assert!(!title_matches_document(
            "DevTools - 127.0.0.1:9000/one",
            "http://127.0.0.1:8000/one"
        ));
    }
}
