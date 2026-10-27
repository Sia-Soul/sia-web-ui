//! 在调用 WebView2 打开工具前监听窗口事件；准备期间透明，认领后由停靠布局负责显示。
use std::{
    cell::RefCell,
    collections::{HashMap, HashSet},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use windows::{
    core::BOOL,
    Win32::{
        Foundation::{COLORREF, HWND, LPARAM},
        Graphics::Gdi::{RedrawWindow, RDW_ALLCHILDREN, RDW_INVALIDATE},
        UI::{Accessibility::*, WindowsAndMessaging::*},
    },
};

/// 保存叠层属性，解除遮蔽时不能覆盖窗口原本的透明设置。
#[derive(Clone, Copy)]
pub(super) struct Mask {
    pub ex_style: i32,
    key: u32,
    alpha: u8,
    flags: u32,
}
impl Mask {
    /// 透明窗口仍可布局和渲染；穿透与不激活样式避免后台准备抢走用户焦点。
    unsafe fn apply(handle: HWND) -> Option<Self> {
        let ex_style = GetWindowLongW(handle, GWL_EXSTYLE);
        let mut key = COLORREF(0);
        let mut alpha = 255;
        let mut flags = LWA_ALPHA;
        if ex_style as u32 & WS_EX_LAYERED.0 != 0 {
            GetLayeredWindowAttributes(handle, Some(&mut key), Some(&mut alpha), Some(&mut flags))
                .ok()?;
        }
        SetWindowLongW(
            handle,
            GWL_EXSTYLE,
            ((ex_style as u32
                | WS_EX_LAYERED.0
                | WS_EX_TRANSPARENT.0
                | WS_EX_NOACTIVATE.0
                | WS_EX_TOOLWINDOW.0)
                & !WS_EX_APPWINDOW.0) as i32,
        );
        if SetLayeredWindowAttributes(handle, COLORREF(0), 0, LWA_ALPHA).is_err() {
            SetWindowLongW(handle, GWL_EXSTYLE, ex_style);
            return None;
        }
        Some(Self {
            ex_style,
            key: key.0,
            alpha,
            flags: flags.0,
        })
    }

    /// 调用方传入最终独立/停靠样式；移除临时透明及穿透效果。
    pub unsafe fn restore(self, handle: HWND, style: i32) {
        if self.ex_style as u32 & WS_EX_LAYERED.0 != 0 {
            let _ = SetLayeredWindowAttributes(
                handle,
                COLORREF(self.key),
                self.alpha,
                LAYERED_WINDOW_ATTRIBUTES_FLAGS(self.flags),
            );
        }
        SetWindowLongW(handle, GWL_EXSTYLE, style);
        let _ = RedrawWindow(Some(handle), None, None, RDW_INVALIDATE | RDW_ALLCHILDREN);
    }
}

struct State {
    pid: u32,
    before: HashSet<isize>,
    claimed: HashSet<isize>,
    processing: HashSet<isize>,
    masks: HashMap<isize, Mask>,
}
thread_local! { static ACTIVE: RefCell<Option<Arc<Mutex<State>>>> = const { RefCell::new(None) }; }

/// 对专用消息线程收到的创建和显示事件即时遮蔽，不在浏览器 UI 线程等待跨进程消息。
unsafe extern "system" fn on_event(
    _: HWINEVENTHOOK,
    event: u32,
    handle: HWND,
    object: i32,
    child: i32,
    _: u32,
    _: u32,
) {
    if object != OBJID_WINDOW.0
        || child != 0
        || ![
            EVENT_OBJECT_CREATE,
            EVENT_OBJECT_SHOW,
            EVENT_OBJECT_NAMECHANGE,
        ]
        .contains(&event)
    {
        return;
    }
    let state = ACTIVE.with(|active| active.borrow().clone());
    if let Some(state) = state {
        capture(&state, handle);
    }
}

/// 只处理本次调用后出现的 Chromium 顶层窗口，已有窗口保持不变。
unsafe fn capture(state: &Arc<Mutex<State>>, handle: HWND) {
    let mut pid = 0;
    GetWindowThreadProcessId(handle, Some(&mut pid));
    let mut class = [0u16; 128];
    let count = GetClassNameW(handle, &mut class).max(0) as usize;
    if String::from_utf16_lossy(&class[..count]) != "Chrome_WidgetWin_1"
        || GetWindowLongW(handle, GWL_STYLE) as u32 & WS_CHILD.0 != 0
    {
        return;
    }
    let mut title = [0u16; 2048];
    let count = GetWindowTextW(handle, &mut title).max(0) as usize;
    let title = String::from_utf16_lossy(&title[..count]);
    if !title.is_empty() && !title.starts_with("DevTools") {
        return;
    }
    let Ok(mut guard) = state.lock() else {
        return;
    };
    let id = handle.0 as isize;
    if pid != guard.pid
        || guard.before.contains(&id)
        || guard.claimed.contains(&id)
        || guard.masks.contains_key(&id)
        || !guard.processing.insert(id)
    {
        return;
    }
    drop(guard);
    // Win32 可重入事件回调，调用期间不能持有共享锁。
    let mask = Mask::apply(handle);
    if let Ok(mut state) = state.lock() {
        state.processing.remove(&id);
        if let Some(mask) = mask {
            state.masks.insert(id, mask);
        }
    }
}

/// 枚举本内核窗口，补偿某些 Runtime 未发出创建事件的情况。
unsafe fn scan(state: &Arc<Mutex<State>>) {
    unsafe extern "system" fn visit(handle: HWND, data: LPARAM) -> BOOL {
        capture(&*(data.0 as *const Arc<Mutex<State>>), handle);
        BOOL(1)
    }
    let _ = EnumWindows(Some(visit), LPARAM(state as *const _ as isize));
}

/// 生命周期只覆盖一次打开；Drop 通知线程清理，绝不在 UI 上 join 等待。
pub(super) struct Capture {
    state: Arc<Mutex<State>>,
    stop: Arc<AtomicBool>,
}
impl Capture {
    pub fn start(pid: u32, source: String) -> Result<Self, String> {
        let state = Arc::new(Mutex::new(State {
            pid,
            before: HashSet::new(),
            claimed: HashSet::new(),
            processing: HashSet::new(),
            masks: HashMap::new(),
        }));
        let stop = Arc::new(AtomicBool::new(false));
        let result = Self {
            state: state.clone(),
            stop: stop.clone(),
        };
        let (send, receive) = std::sync::mpsc::sync_channel(1);
        std::thread::spawn(move || unsafe {
            // 先建立全量快照，再安装限定 PID 的钩子；完成后才允许调用 OpenDevToolsWindow。
            unsafe extern "system" fn snapshot(handle: HWND, data: LPARAM) -> BOOL {
                let state = &*(data.0 as *const Arc<Mutex<State>>);
                let mut owner = 0;
                GetWindowThreadProcessId(handle, Some(&mut owner));
                if let Ok(mut state) = state.lock() {
                    if owner == state.pid {
                        state.before.insert(handle.0 as isize);
                    }
                }
                BOOL(1)
            }
            let _ = EnumWindows(Some(snapshot), LPARAM(&state as *const _ as isize));
            ACTIVE.with(|active| *active.borrow_mut() = Some(state.clone()));
            let hook = SetWinEventHook(
                EVENT_OBJECT_CREATE,
                EVENT_OBJECT_NAMECHANGE,
                None,
                Some(on_event),
                pid,
                0,
                WINEVENT_OUTOFCONTEXT,
            );
            if hook.0.is_null() {
                let _ = send.send(false);
                return;
            }
            let _ = send.send(true);
            let started = std::time::Instant::now();
            while !stop.load(Ordering::Acquire) && started.elapsed() < Duration::from_secs(10) {
                let mut message = MSG::default();
                while PeekMessageW(&mut message, None, 0, 0, PM_REMOVE).as_bool() {
                    let _ = TranslateMessage(&message);
                    DispatchMessageW(&message);
                }
                scan(&state);
                std::thread::sleep(Duration::from_millis(1));
            }
            let _ = UnhookWinEvent(hook);
            ACTIVE.with(|active| *active.borrow_mut() = None);
            // 未认领的唯一匹配文档属于已取消请求，关闭它；其他窗口恢复原状，不能遗留透明窗口。
            let masks = state
                .lock()
                .map(|mut state| std::mem::take(&mut state.masks))
                .unwrap_or_default();
            let matching = super::native::candidates(pid)
                .into_iter()
                .filter(|window| {
                    masks.contains_key(&window.handle)
                        && super::title_matches_document(&window.title, &source)
                })
                .collect::<Vec<_>>();
            for (id, mask) in masks {
                let handle = HWND(id as _);
                let mut owner = 0;
                GetWindowThreadProcessId(handle, Some(&mut owner));
                if owner != pid {
                    continue;
                }
                if matching.len() == 1 && matching[0].handle == id {
                    super::native::close(&matching[0]);
                } else {
                    mask.restore(handle, mask.ex_style);
                }
            }
        });
        if receive
            .recv_timeout(Duration::from_millis(500))
            .unwrap_or(false)
        {
            Ok(result)
        } else {
            Err("无法准备开发者工具的后台窗口监听".into())
        }
    }

    /// 明确文档归属后转移遮蔽所有权，布局在完成实际定位后才解除透明。
    pub fn claim(&self, handle: isize) -> Option<Mask> {
        let mut state = self.state.lock().ok()?;
        let mask = state.masks.remove(&handle)?;
        state.claimed.insert(handle);
        Some(mask)
    }
}
impl Drop for Capture {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Release);
    }
}
