#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // 持有未加锁的命名互斥体供安装器检测；不限制浏览器实例数量，退出时由系统释放。
    #[cfg(windows)]
    let _installer_guard = unsafe {
        windows::Win32::System::Threading::CreateMutexW(
            None,
            false,
            windows::core::w!("Local\\SiaBrowser.Installation"),
        )
        .expect("无法创建浏览器安装保护互斥体")
    };
    // 西娅浏览器入口，与 Cargo 的品牌化二进制名称保持一致。
    sia_browser_lib::run();
}
