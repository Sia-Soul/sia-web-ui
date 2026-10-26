//! 为桌面启动回归检查提供独立目录，避免测试读写用户的浏览器资料。

/// 显式指定诊断目录时隔离所有应用目录；已有目录必须包含本工具创建的标记。
pub fn configure(context: &mut tauri::Context<tauri::Wry>) -> Result<(), String> {
    let mut arguments = std::env::args_os();
    let Some(_) = arguments.find(|argument| argument == "--diagnostic-data-dir") else {
        return Ok(());
    };
    let directory = std::path::PathBuf::from(arguments.next().ok_or("缺少诊断目录")?);
    if !directory.is_absolute() {
        return Err("诊断目录必须为绝对路径".into());
    }
    let marker = directory.join(".sia-startup-test");
    if directory.exists() {
        if !marker.is_file() {
            return Err("诊断目录已存在且没有测试标记，拒绝使用".into());
        }
    } else {
        std::fs::create_dir(&directory).map_err(|error| error.to_string())?;
        std::fs::write(&marker, b"Sia Browser isolated startup test\n")
            .map_err(|error| error.to_string())?;
    }
    context.config_mut().app.app_directories_override =
        Some(tauri::utils::config::AppDirectoriesOverride::Root(directory.clone()));
    // 同一诊断目录共享实例，不同诊断目录与正式浏览器完全隔离。
    use std::hash::{Hash, Hasher};
    let mut identity = std::collections::hash_map::DefaultHasher::new();
    directory.canonicalize().map_err(|error| error.to_string())?.hash(&mut identity);
    context.config_mut().identifier.push_str(&format!(".diagnostic-{:x}", identity.finish()));
    // 主壳层也使用独立的 WebView2 资料目录；子页面由应用目录设置隔离。
    for window in &mut context.config_mut().app.windows {
        window.data_directory = Some(directory.join("shell-webview"));
        window.visible = false;
    }
    Ok(())
}
