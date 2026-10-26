#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // 持有未加锁的互斥体供安装器检测；窗口复用由单实例插件处理，退出时系统释放句柄。
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
