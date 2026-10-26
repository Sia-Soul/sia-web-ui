//! Windows 默认浏览器登记与设置页入口；仅声明能力，默认关联始终由用户在系统中确认。

const REGISTERED_NAME: &str = "SiaBrowser";
const CLIENT_KEY: &str = r"Software\Clients\StartMenuInternet\SiaBrowser";
const PROG_ID: &str = "SiaBrowserURL";

/// 生成当前用户浏览器登记；名称和路径必须与 Inno 安装器一致，不写 UserChoice。
fn registration_entries(executable: &str) -> Vec<(String, String, String)> {
    let capabilities = format!(r"{CLIENT_KEY}\Capabilities");
    let class = format!(r"Software\Classes\{PROG_ID}");
    let command = format!(r#""{executable}" --open-url "%1""#);
    let icon = format!(r#""{executable}",0"#);
    let mut entries = vec![
        (CLIENT_KEY.into(), "".into(), "西娅浏览器".into()),
        (format!(r"{CLIENT_KEY}\DefaultIcon"), "".into(), icon.clone()),
        (format!(r"{CLIENT_KEY}\shell\open\command"), "".into(), format!(r#""{executable}""#)),
        (capabilities.clone(), "ApplicationName".into(), "西娅浏览器".into()),
        (capabilities.clone(), "ApplicationDescription".into(), "西娅浏览器 · 轻量级工作空间浏览器".into()),
        (capabilities.clone(), "ApplicationIcon".into(), icon.clone()),
        (format!(r"{capabilities}\URLAssociations"), "http".into(), PROG_ID.into()),
        (format!(r"{capabilities}\URLAssociations"), "https".into(), PROG_ID.into()),
        (class.clone(), "".into(), "西娅浏览器网址".into()),
        (class.clone(), "URL Protocol".into(), "".into()),
        (format!(r"{class}\DefaultIcon"), "".into(), icon),
        (format!(r"{class}\shell\open\command"), "".into(), command),
        (r"Software\RegisteredApplications".into(), REGISTERED_NAME.into(), capabilities.clone()),
    ];
    // 文件打开方式与 URL 协议分开，资源管理器只把支持的 HTML 类型列为候选。
    let application = r"Software\Classes\Applications\sia-browser.exe";
    let html_class = r"Software\Classes\SiaBrowserHTML";
    let file_command = format!(r#""{executable}" --open-file "%1""#);
    entries.extend([
        (application.into(), "FriendlyAppName".into(), "西娅浏览器".into()),
        (format!(r"{application}\shell\open\command"), "".into(), file_command.clone()),
        (html_class.into(), "".into(), "西娅浏览器 HTML 文档".into()),
        (format!(r"{html_class}\DefaultIcon"), "".into(), format!(r#""{executable}",0"#)),
        (format!(r"{html_class}\shell\open\command"), "".into(), file_command),
    ]);
    for extension in [".html", ".htm"] {
        entries.extend([
            (format!(r"{application}\SupportedTypes"), extension.into(), "".into()),
            (format!(r"Software\Classes\{extension}\OpenWithProgids"), "SiaBrowserHTML".into(), "".into()),
            (format!(r"{capabilities}\FileAssociations"), extension.into(), "SiaBrowserHTML".into()),
        ]);
    }
    entries
}

/// Windows 11 支持按应用定位的版本使用用户登记名；旧版系统定位浏览器默认项。
fn settings_uri(build: u32, revision: u32) -> (&'static str, bool) {
    if build > 22621 || (build == 22621 && revision >= 1555) || (build == 22000 && revision >= 1817) {
        ("ms-settings:defaultapps?registeredAppUser=SiaBrowser", true)
    } else {
        ("ms-settings:defaultapps?target=SystemSettings_DefaultApps_Browser", false)
    }
}

/// 写入指定根键，测试可使用独立的临时键验证，不触碰实际浏览器登记。
#[cfg(windows)]
fn write_registration(root: &winreg::RegKey, executable: &str) -> Result<(), String> {
    for (path, name, value) in registration_entries(executable) {
        let (key, _) = root.create_subkey(&path).map_err(|error| format!("无法登记西娅浏览器：{error}"))?;
        key.set_value(name, &value).map_err(|error| format!("无法写入西娅浏览器登记：{error}"))?;
    }
    Ok(())
}

/// 修复旧安装缺失的登记后打开西娅专属设置页；返回是否支持直接定位，不表示已设为默认。
#[tauri::command]
pub async fn open_default_browser_settings() -> Result<bool, String> {
    #[cfg(windows)]
    {
        use winreg::{enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE}, RegKey};
        use windows::Win32::UI::Shell::{SHChangeNotify, SHCNE_ASSOCCHANGED, SHCNF_IDLIST};
        let executable = std::env::current_exe().map_err(|error| error.to_string())?;
        write_registration(&RegKey::predef(HKEY_CURRENT_USER), &executable.to_string_lossy())?;
        // 刷新系统关联缓存，让修复登记后的首次点击也能定位到本应用。
        unsafe { SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, None, None); }
        let version = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(r"Software\Microsoft\Windows NT\CurrentVersion")
            .map_err(|error| format!("无法读取 Windows 版本：{error}"))?;
        let build = version.get_value::<String, _>("CurrentBuildNumber").ok().and_then(|value| value.parse().ok()).unwrap_or(0);
        let revision = version.get_value::<u32, _>("UBR").unwrap_or(0);
        let (uri, direct) = settings_uri(build, revision);
        crate::shell_execute(std::ffi::OsStr::new(uri), None, "无法打开 Windows 默认应用设置")?;
        Ok(direct)
    }
    #[cfg(not(windows))]
    Err("此入口仅支持 Windows 默认应用设置".into())
}

/// 只接受 HTTP/HTTPS 文本链接；本地文件必须走显式文件入口。
pub fn web_url(candidate: &str) -> Option<String> {
    let url = tauri::Url::parse(candidate.trim()).ok()?;
    (matches!(url.scheme(), "http" | "https") && url.host_str().is_some()).then(|| url.to_string())
}

/// 将明确选择的已有 HTML 文件转换为 file URL，保留中文、空格及相对资源的原目录。
pub fn html_file_url(candidate: &std::path::Path) -> Option<String> {
    let extension = candidate.extension()?.to_str()?;
    if !matches!(extension.to_ascii_lowercase().as_str(), "html" | "htm") || !candidate.is_file() { return None; }
    let path = candidate.canonicalize().ok()?;
    tauri::Url::from_file_path(path).ok().map(|url| url.to_string())
}

/// 安装器和“打开方式”使用不同参数，避免将诊断选项或其他协议当作网页打开。
fn launch_url(arguments: &[String]) -> Option<String> {
    launch_url_from(arguments, &std::env::current_dir().ok()?)
}

/// 第二次启动的相对文件路径按发送进程的工作目录解析，不使用已有窗口的目录。
pub(crate) fn launch_url_from(arguments: &[String], cwd: &std::path::Path) -> Option<String> {
    let pair = arguments.windows(2).find(|pair| matches!(pair[0].as_str(), "--open-url" | "--open-file"))?;
    if pair[0] == "--open-file" { html_file_url(&cwd.join(&pair[1])) }
    else { web_url(&pair[1]) }
}

/// 主界面恢复会话时读取启动网址，作为新标签打开，保留原来的标签与隔离分组。
#[tauri::command]
pub fn get_browser_launch_url() -> Option<String> {
    launch_url(&std::env::args().skip(1).collect::<Vec<_>>())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_targets_registered_app_on_supported_windows() {
        assert_eq!(settings_uri(22631, 0), ("ms-settings:defaultapps?registeredAppUser=SiaBrowser", true));
        assert!(settings_uri(22621, 1555).1);
        assert!(settings_uri(22000, 1817).1);
        for (build, revision) in [(19045, 6000), (22000, 1816), (22621, 1554)] {
            assert!(!settings_uri(build, revision).1);
        }
    }

    #[test]
    fn external_launch_accepts_web_urls_only() {
        for url in ["https://example.com/a?q=中文&b=2", "http://localhost:1440/"] {
            assert!(launch_url(&["--open-url".into(), url.into()]).is_some());
        }
        for url in ["javascript:alert(1)", "file:///C:/test.html", "sia://settings", "--diagnostic-data-dir", "not a url"] {
            assert!(launch_url(&["--open-url".into(), url.into()]).is_none());
        }
        assert!(launch_url(&["--open-url".into()]).is_none());
        assert!(launch_url(&["https://example.com/".into()]).is_none());
    }

    #[test]
    fn html_files_preserve_original_location_and_reject_other_types() {
        // 使用 D 盘构建临时目录，验证中文、空格和 URL 保留字符不会破坏文件打开路径。
        let name = format!("sia-网页 空格-{}-{}-#.HTML", std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
        let path = std::env::temp_dir().join(name);
        std::fs::write(&path, "<!doctype html><title>本地网页</title>").unwrap();
        let result = launch_url(&["--open-file".into(), path.to_string_lossy().into_owned()]);
        // 已有实例必须使用新启动进程传来的目录解析相对路径。
        let relative = launch_url_from(&["sia-browser.exe".into(), "--open-file".into(), path.file_name().unwrap().to_string_lossy().into_owned()], path.parent().unwrap());
        assert_eq!(relative, result);
        let expected = path.canonicalize().unwrap();
        std::fs::remove_file(&path).unwrap();
        let url = tauri::Url::parse(&result.expect("HTML 应可通过打开方式启动")).unwrap();
        assert_eq!(url.scheme(), "file");
        assert_eq!(tauri::Url::from_file_path(expected).unwrap(), url);
        assert!(html_file_url(&path).is_none(), "不存在的文件不能打开");
        assert!(html_file_url(std::path::Path::new("C:/Windows/notepad.exe")).is_none());
    }

    #[test]
    fn registration_quotes_paths_and_preserves_default_choices() {
        let entries = registration_entries(r"D:\我的程序\Sia Browser\sia-browser.exe");
        assert!(entries.iter().any(|(path, name, value)| path == r"Software\RegisteredApplications"
            && name == REGISTERED_NAME && value == &format!(r"{CLIENT_KEY}\Capabilities")));
        assert!(entries.iter().any(|(path, _, value)| path == r"Software\Classes\SiaBrowserURL\shell\open\command"
            && value == r#""D:\我的程序\Sia Browser\sia-browser.exe" --open-url "%1""#));
        assert!(entries.iter().all(|(path, _, _)| !path.contains("UserChoice")));
        // 安装注册和运行时修复必须使用相同的应用名、能力路径与启动参数。
        let installer = include_str!("../../installer/SiaBrowser.iss");
        for (path, name, _) in entries {
            assert!(installer.contains(&path), "安装器缺少登记：{path}");
            if !name.is_empty() { assert!(installer.contains(&name)); }
        }
    }

    #[cfg(windows)]
    #[test]
    fn registration_repairs_values_in_isolated_registry_root() {
        use winreg::{enums::HKEY_CURRENT_USER, RegKey};
        // 独立测试根只包含本用例创建的数据，退出时即使断言失败也清理，不碰真实默认关联。
        struct Fixture { path: String }
        impl Drop for Fixture {
            fn drop(&mut self) { let _ = RegKey::predef(HKEY_CURRENT_USER).delete_subkey_all(&self.path); }
        }
        let fixture = Fixture { path: format!(r"Software\SiaBrowser-RegistrationTest-{}-{}", std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()) };
        let (root, _) = RegKey::predef(HKEY_CURRENT_USER).create_subkey(&fixture.path).unwrap();
        write_registration(&root, r"C:\旧目录\sia-browser.exe").unwrap();
        let executable = r"D:\程序 空格\sia-browser.exe";
        write_registration(&root, executable).unwrap();
        for (path, name, value) in registration_entries(executable) {
            assert_eq!(root.open_subkey(path).unwrap().get_value::<String, _>(name).unwrap(), value);
        }
        drop(root);
    }
}
