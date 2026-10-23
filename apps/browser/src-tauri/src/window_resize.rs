//! 保持多 WebView 窗口的原生缩放边缘可点击；边缘形状、DPI 和最大化状态由 Tauri 管理。
#[cfg(windows)]
mod native {
    use std::cell::Cell;
    use tauri::Emitter;
    use windows::{
        core::w,
        Win32::{
            Foundation::{HWND, LPARAM, LRESULT, POINT, WPARAM},
            UI::{
                Input::KeyboardAndMouse::{
                    TrackMouseEvent, TME_LEAVE, TME_NONCLIENT, TRACKMOUSEEVENT,
                },
                Shell::{
                    DefSubclassProc, GetWindowSubclass, RemoveWindowSubclass, SetWindowSubclass,
                },
                WindowsAndMessaging::*,
            },
        },
    };

    // 独立编号避免覆盖 Tauri/Wry 在相同 HWND 上注册的子类回调。
    const RESIZE_SUBCLASS: usize = 0x53494152;
    const HOVER_SUBCLASS: usize = 0x53494148;

    /// 状态只由 UI 线程访问；原生命中区域与外壳 CSS 共用方向，避免 DOM 被子 WebView 遮挡后收不到悬停。
    struct HoverState {
        app: tauri::AppHandle,
        edges: Cell<&'static str>,
        dragging: Cell<bool>,
    }

    impl HoverState {
        /// 仅方向变化时通知外壳，避免鼠标移动造成重复 IPC。
        fn update(&self, edges: &'static str) {
            if self.edges.replace(edges) != edges {
                let _ = self.app.emit("sia://window-resize-edges", edges);
            }
        }
    }

    /// 角落对应两条相邻边，普通客户区没有缩放强调线。
    fn edges_for_hit(hit: u32) -> &'static str {
        match hit {
            HTLEFT => "left",
            HTRIGHT => "right",
            HTTOP => "top",
            HTBOTTOM => "bottom",
            HTTOPLEFT => "left top",
            HTTOPRIGHT => "right top",
            HTBOTTOMLEFT => "left bottom",
            HTBOTTOMRIGHT => "right bottom",
            _ => "",
        }
    }

    /// 接收原生非客户区的悬停/离开，不替换 Tauri 的鼠标指针和系统拖动实现。
    unsafe extern "system" fn border_proc(
        hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        id: usize,
        data: usize,
    ) -> LRESULT {
        let state = &*(data as *const HoverState);
        if message == WM_NCDESTROY {
            state.update("");
            let _ = RemoveWindowSubclass(hwnd, Some(border_proc), id);
            drop(Box::from_raw(data as *mut HoverState));
            return DefSubclassProc(hwnd, message, wparam, lparam);
        }
        if message == WM_NCMOUSEMOVE || message == WM_SETCURSOR {
            let hit = if message == WM_NCMOUSEMOVE {
                wparam.0 as u32
            } else {
                (lparam.0 & 0xffff) as u32
            };
            if !state.dragging.get() {
                state.update(edges_for_hit(hit));
            }
            let mut tracking = TRACKMOUSEEVENT {
                cbSize: std::mem::size_of::<TRACKMOUSEEVENT>() as u32,
                dwFlags: TME_LEAVE | TME_NONCLIENT,
                hwndTrack: hwnd,
                dwHoverTime: 0,
            };
            let _ = TrackMouseEvent(&mut tracking);
        } else if message == WM_NCMOUSELEAVE && !state.dragging.get() {
            state.update("");
        }
        DefSubclassProc(hwnd, message, wparam, lparam)
    }

    /// 系统拖动期间保持强调线；释放后按当前指针重新命中，失活或最大化时清除。
    unsafe fn sync_hover_state(parent: HWND, message: u32, wparam: WPARAM) {
        let Ok(border) = FindWindowExW(Some(parent), None, w!("TAURI_DRAG_RESIZE_BORDERS"), None)
        else {
            return;
        };
        let mut data = 0;
        if !GetWindowSubclass(border, Some(border_proc), HOVER_SUBCLASS, Some(&mut data)).as_bool()
        {
            return;
        }
        let state = &*(data as *const HoverState);
        if message == WM_ENTERSIZEMOVE {
            state.dragging.set(true);
        } else if message == WM_EXITSIZEMOVE {
            state.dragging.set(false);
            let mut point = POINT::default();
            // 系统缩放循环结束时指针可能仍停在边缘，不能等待下一次移动才恢复颜色。
            if GetForegroundWindow() == parent
                && !IsZoomed(parent).as_bool()
                && GetCursorPos(&mut point).is_ok()
            {
                let position = (point.x as u16 as u32) | ((point.y as u16 as u32) << 16);
                let hit = SendMessageW(border, WM_NCHITTEST, None, Some(LPARAM(position as isize)));
                state.update(edges_for_hit(hit.0 as u32));
                let mut tracking = TRACKMOUSEEVENT {
                    cbSize: std::mem::size_of::<TRACKMOUSEEVENT>() as u32,
                    dwFlags: TME_LEAVE | TME_NONCLIENT,
                    hwndTrack: border,
                    dwHoverTime: 0,
                };
                let _ = TrackMouseEvent(&mut tracking);
            } else {
                state.update("");
            }
        } else if (message == WM_ACTIVATE && wparam.0 & 0xffff == WA_INACTIVE as usize)
            || (message == WM_SIZE && wparam.0 == SIZE_MAXIMIZED as usize)
        {
            state.dragging.set(false);
            state.update("");
        }
    }

    /// 仅提升属于主窗口的镂空边缘，不改变窗口焦点、位置或其他网页的相对顺序。
    unsafe fn raise_border(parent: HWND) {
        let Ok(border) = FindWindowExW(Some(parent), None, w!("TAURI_DRAG_RESIZE_BORDERS"), None)
        else {
            return;
        };
        if GetWindow(parent, GW_CHILD).ok() != Some(border) {
            if let Err(error) = SetWindowPos(
                border,
                Some(HWND_TOP),
                0,
                0,
                0,
                0,
                SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE | SWP_NOOWNERZORDER,
            ) {
                eprintln!("无法恢复窗口缩放边缘层级：{error}");
            }
        }
    }

    /// 网页或面板调整原生层级后恢复缩放边缘；只处理直属子窗口，不挂钩网页内部控件。
    unsafe extern "system" fn child_proc(
        hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        id: usize,
        parent: usize,
    ) -> LRESULT {
        if message == WM_NCDESTROY {
            let _ = RemoveWindowSubclass(hwnd, Some(child_proc), id);
        }
        let result = DefSubclassProc(hwnd, message, wparam, lparam);
        if message == WM_WINDOWPOSCHANGED {
            raise_border(HWND(parent as _));
        }
        result
    }

    /// 新建标签、恢复休眠网页和创建覆盖层均在 HWND 创建时安装层级保护。
    unsafe fn watch_child(parent: HWND, child: HWND) -> Result<(), String> {
        // 缩放边缘本身不能监听，否则提升边缘会再次触发自身回调。
        let border = FindWindowExW(Some(parent), None, w!("TAURI_DRAG_RESIZE_BORDERS"), None).ok();
        if border != Some(child) && GetParent(child).ok() == Some(parent) {
            SetWindowSubclass(child, Some(child_proc), RESIZE_SUBCLASS, parent.0 as usize)
                .ok()
                .map_err(|error| format!("无法监听网页窗口层级：{error}"))?;
        }
        Ok(())
    }

    /// 监听后续直属子窗口的创建，关闭主窗口时卸载回调。
    unsafe extern "system" fn parent_proc(
        hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        id: usize,
        _: usize,
    ) -> LRESULT {
        if matches!(
            message,
            WM_ENTERSIZEMOVE | WM_EXITSIZEMOVE | WM_ACTIVATE | WM_SIZE
        ) {
            sync_hover_state(hwnd, message, wparam);
        }
        if message == WM_NCDESTROY {
            let _ = RemoveWindowSubclass(hwnd, Some(parent_proc), id);
        }
        let result = DefSubclassProc(hwnd, message, wparam, lparam);
        if message == WM_PARENTNOTIFY && (wparam.0 & 0xffff) == WM_CREATE as usize {
            if let Err(error) = watch_child(hwnd, HWND(lparam.0 as _)) {
                eprintln!("{error}");
            }
            raise_border(hwnd);
        }
        result
    }

    /// 必须在主线程调用；同时覆盖已经创建的外壳 WebView 和之后创建的标签网页。
    pub(super) unsafe fn install(parent: HWND, app: tauri::AppHandle) -> Result<(), String> {
        let border = FindWindowExW(Some(parent), None, w!("TAURI_DRAG_RESIZE_BORDERS"), None)
            .map_err(|_| "未创建原生窗口缩放边缘".to_string())?;
        let mut existing = 0;
        if !GetWindowSubclass(
            border,
            Some(border_proc),
            HOVER_SUBCLASS,
            Some(&mut existing),
        )
        .as_bool()
        {
            let state = Box::into_raw(Box::new(HoverState {
                app,
                edges: Cell::new(""),
                dragging: Cell::new(false),
            }));
            if !SetWindowSubclass(border, Some(border_proc), HOVER_SUBCLASS, state as usize)
                .as_bool()
            {
                drop(Box::from_raw(state));
                return Err("无法监听窗口边缘悬停".into());
            }
        }
        SetWindowSubclass(parent, Some(parent_proc), RESIZE_SUBCLASS, 0)
            .ok()
            .map_err(|error| format!("无法监听窗口子视图：{error}"))?;
        let mut child = GetWindow(parent, GW_CHILD).ok();
        while let Some(current) = child {
            watch_child(parent, current)?;
            child = GetWindow(current, GW_HWNDNEXT).ok();
        }
        raise_border(parent);
        Ok(())
    }
}

/// 在主窗口 setup 阶段启用八向缩放；多 WebView 模式需显式触发 Tauri 创建缩放边缘。
/// 必须从 UI 线程调用，失败时返回错误，避免以不可缩放的半初始化状态继续启动。
pub fn initialize(window: &tauri::Window) -> Result<(), String> {
    #[cfg(windows)]
    {
        window
            .set_resizable(true)
            .map_err(|error| error.to_string())?;
        let hwnd = window.hwnd().map_err(|error| error.to_string())?;
        unsafe {
            use tauri::Manager;
            native::install(hwnd, window.app_handle().clone())?;
        }
    }
    #[cfg(not(windows))]
    let _ = window;
    Ok(())
}
