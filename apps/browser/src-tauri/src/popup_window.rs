//! 附属面板只在普通窗口层内显示；隐藏时不重新排列主窗口或抢回前台。
use windows::Win32::{Foundation::HWND, UI::WindowsAndMessaging::*};

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
