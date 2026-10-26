//! 附属面板只在普通窗口层内显示；隐藏时不重新排列主窗口或抢回前台。
use windows::Win32::{Foundation::{HWND, LPARAM, LRESULT, WPARAM}, UI::{WindowsAndMessaging::*, Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass}}};

const FRAMELESS_SUBCLASS: usize = 0x53494146;

unsafe extern "system" fn frameless_proc(hwnd: HWND, message: u32, wparam: WPARAM, lparam: LPARAM, id: usize, _data: usize) -> LRESULT {
    match message {
        // 阴影留白属于客户区，不能被系统当作可拖动的标题栏。
        WM_NCHITTEST => LRESULT(HTCLIENT as isize),
        WM_NCPAINT => LRESULT(0),
        // 保留 Tauri 的焦点状态更新，只禁止默认过程重画系统标题栏。
        WM_NCACTIVATE => DefSubclassProc(hwnd, message, wparam, LPARAM(-1)),
        WM_NCDESTROY => {
            let _ = RemoveWindowSubclass(hwnd, Some(frameless_proc), id);
            DefSubclassProc(hwnd, message, wparam, lparam)
        }
        _ => DefSubclassProc(hwnd, message, wparam, lparam),
    }
}

/// 在窗口所属线程安装无边框处理；阴影可点击，激活时不绘制系统标题栏，失败返回系统错误。
pub fn install_frameless(hwnd: HWND) -> windows::core::Result<()> {
    unsafe { SetWindowSubclass(hwnd, Some(frameless_proc), FRAMELESS_SUBCLASS, 0).ok() }
}

/// 显示时保留 owner 的层级、不激活；隐藏时同时保留自身层级，避免浏览器挡住刚点击的其他应用。
/// 不使用系统置顶：Windows 已保证附属面板位于所属窗口上方。
pub fn set_visible(hwnd: HWND, visible: bool) -> windows::core::Result<()> {
    let flags = SWP_NOACTIVATE
        | SWP_NOOWNERZORDER
        | SWP_NOMOVE
        | SWP_NOSIZE
        | if visible {
            SWP_SHOWWINDOW
        } else {
            SWP_HIDEWINDOW | SWP_NOZORDER
        };
    unsafe { SetWindowPos(hwnd, Some(HWND_TOP), 0, 0, 0, 0, flags) }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicIsize, Ordering};
    use windows::core::w;

    static ACTIVATION_PARAM: AtomicIsize = AtomicIsize::new(0);
    static PAINT_COUNT: AtomicIsize = AtomicIsize::new(0);

    unsafe extern "system" fn observe_proc(hwnd: HWND, msg: u32, wp: WPARAM, lp: LPARAM, _id: usize, _data: usize) -> LRESULT {
        if msg == WM_NCACTIVATE { ACTIVATION_PARAM.store(lp.0, Ordering::SeqCst); }
        if msg == WM_NCPAINT { PAINT_COUNT.fetch_add(1, Ordering::SeqCst); }
        DefSubclassProc(hwnd, msg, wp, lp)
    }

    #[test]
    fn popup_shadow_is_client_area_and_activation_does_not_paint_caption() {
        unsafe {
            // 隐藏测试窗口只验证消息链，不操作用户窗口。
            let hwnd = CreateWindowExW(WINDOW_EX_STYLE::default(), w!("STATIC"), w!("Popup test"),
                WS_POPUP | WS_CAPTION, 0, 0, 300, 200, None, None, None, None).unwrap();
            assert!(SetWindowSubclass(hwnd, Some(observe_proc), 1, 0).as_bool());
            SendMessageW(hwnd, WM_NCACTIVATE, Some(WPARAM(1)), Some(LPARAM(0)));
            assert_eq!(ACTIVATION_PARAM.load(Ordering::SeqCst), 0);
            install_frameless(hwnd).unwrap();
            PAINT_COUNT.store(0, Ordering::SeqCst);
            SendMessageW(hwnd, WM_NCACTIVATE, Some(WPARAM(1)), Some(LPARAM(0)));
            assert_eq!(ACTIVATION_PARAM.load(Ordering::SeqCst), -1, "焦点消息应继续传递，但禁止系统重画标题栏");
            SendMessageW(hwnd, WM_NCPAINT, Some(WPARAM(1)), Some(LPARAM(0)));
            assert_eq!(PAINT_COUNT.load(Ordering::SeqCst), 0);
            assert_eq!(SendMessageW(hwnd, WM_NCHITTEST, None, Some(LPARAM((10 << 16) | 10))).0, HTCLIENT as isize);
            DestroyWindow(hwnd).unwrap();
        }
    }
}
