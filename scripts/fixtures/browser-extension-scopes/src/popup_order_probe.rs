//! 在从不切换显示的独立测试桌面上验证面板开关，完全隔离用户可见桌面和前台窗口。
#[path = "../../../../apps/browser/src-tauri/src/popup_window.rs"]
mod popup_window;
use windows::{
    core::w,
    Win32::{Foundation::HWND, UI::WindowsAndMessaging::*},
};
use windows::{
    core::{HSTRING, PCWSTR},
    Win32::System::{StationsAndDesktops::*, Threading::GetCurrentThreadId},
};

/// 只比较本测试创建的 HWND 在系统 Z 序中的相对位置。
unsafe fn above(first: HWND, second: HWND) -> bool {
    let mut next = GetWindow(first, GW_HWNDNEXT).ok();
    while let Some(window) = next {
        if window == second {
            return true;
        }
        next = GetWindow(window, GW_HWNDNEXT).ok();
    }
    false
}

/// STATIC 为系统窗口类；不设置 WS_VISIBLE，测试始终不会显示窗体。
unsafe fn hidden(owner: Option<HWND>) -> HWND {
    CreateWindowExW(
        WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
        w!("STATIC"),
        w!("Sia popup order probe"),
        WS_POPUP,
        0,
        0,
        10,
        10,
        owner,
        None,
        None,
        None,
    )
    .unwrap()
}

fn main() {
    unsafe {
        // 只让测试线程连接独立桌面；绝不调用 SwitchDesktop，测试窗体不会出现在用户屏幕上。
        let original = GetThreadDesktop(GetCurrentThreadId()).unwrap();
        let desktop = CreateDesktopW(
            &HSTRING::from(format!("SiaPopupProbe-{}", std::process::id())),
            PCWSTR::null(),
            None,
            DESKTOP_CONTROL_FLAGS(0),
            0x01ff,
            None,
        )
        .unwrap();
        SetThreadDesktop(desktop).unwrap();
        let main = hidden(None);
        let other = hidden(None);
        let popup = hidden(Some(main));
        let flags = SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE;
        // 旧实现对照：取消系统置顶会同时把 owner 重新抬到其他窗口之前。
        SetWindowPos(popup, Some(HWND_TOPMOST), 0, 0, 0, 0, flags).unwrap();
        SetWindowPos(other, Some(HWND_TOP), 0, 0, 0, 0, flags).unwrap();
        assert!(above(other, main), "前置条件：其他窗口应位于浏览器之前");
        SetWindowPos(popup, Some(HWND_NOTOPMOST), 0, 0, 0, 0, flags).unwrap();
        assert!(!above(other, main), "旧实现对照应复现 owner 被重新提升");
        for _ in 0..5 {
            // 真实面板共用的开关函数，覆盖反复开关而非仅验证标志常量。
            SetWindowPos(other, Some(HWND_TOP), 0, 0, 0, 0, flags).unwrap();
            popup_window::set_visible(popup, true).unwrap();
            assert!(IsWindowVisible(popup).as_bool());
            assert_eq!(
                GetWindowLongPtrW(popup, GWL_EXSTYLE) as u32 & WS_EX_TOPMOST.0,
                0
            );
            assert!(above(popup, main), "面板必须覆盖浏览器主窗口");
            assert!(above(other, main), "显示面板不能改变主窗口层级");
            // 模拟外部窗口已被点击并来到前面；关闭面板后必须保持该顺序。
            SetWindowPos(other, Some(HWND_TOP), 0, 0, 0, 0, flags).unwrap();
            popup_window::set_visible(popup, false).unwrap();
            assert!(!IsWindowVisible(popup).as_bool());
            assert!(above(other, main), "关闭面板不能把浏览器抬回前面");
            assert_eq!(
                GetWindowLongPtrW(main, GWL_EXSTYLE) as u32 & WS_EX_TOPMOST.0,
                0
            );
        }
        for window in [popup, other, main] {
            DestroyWindow(window).unwrap();
        }
        SetThreadDesktop(original).unwrap();
        CloseDesktop(desktop).unwrap();
        println!(
            "PASS: 旧实现复现层级回跳；新实现反复开关不置顶、不重新提升 owner，外部窗口保持在前"
        );
    }
}
