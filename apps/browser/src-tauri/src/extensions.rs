use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{hash_map::DefaultHasher, HashMap},
    fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Emitter, Manager};
const EXTENSIONS_DIRECTORY: &str = "browser-extensions";
const ENABLED_DIRECTORY: &str = "enabled";
const DISABLED_DIRECTORY: &str = "disabled";
const EXTENSIONS_STATE_FILE: &str = "extensions.json";
const BROWSER_WEBVIEW_PREFIX: &str = "browser-tab-";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserExtensionRecord {
    id: String,
    browser_id: Option<String>,
    name: String,
    version: String,
    description: String,
    source: String,
    enabled: bool,
    /// None 兼容旧记录，表示所有分组；空列表表示不允许任何分组。
    #[serde(default)]
    scopes: Option<Vec<ExtensionScope>>,
    options_page: Option<String>,
    /// 工具栏快捷入口的固定状态；旧版扩展记录默认为未固定。
    #[serde(default)]
    pinned: bool,
    /// 从受管目录中的图标生成的数据地址，仅在查询列表时补充。
    #[serde(default, skip_deserializing, skip_serializing_if = "Option::is_none")]
    icon_url: Option<String>,
}

/// 父分组不指定子分组 ID，自动覆盖其现有及未来的子分组。
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionScope {
    group_id: String,
    #[serde(default)]
    small_group_id: Option<String>,
}

impl BrowserExtensionRecord {
    /// 总开关和范围白名单共同决定是否允许当前隔离空间运行扩展。
    fn allows(&self, group: &str, small: Option<&str>) -> bool {
        self.enabled && self.scopes.as_ref().map_or(true, |scopes| scopes.iter().any(|scope| {
            scope.group_id == group && (scope.small_group_id.is_none() || scope.small_group_id.as_deref() == small)
        }))
    }
}

/// 为已有视图记录分组，配置变化时只销毁生效状态发生改变的页面。
#[derive(Default)]
pub struct ExtensionScopeStore(pub std::sync::Mutex<HashMap<String, (String, String, Option<String>)>>);

/// 保持已安装扩展的来源路径稳定，旧版 disabled 目录也可直接作为统一安装源。
fn extension_folder(base: &Path, id: &str) -> PathBuf {
    let enabled = base.join(ENABLED_DIRECTORY).join(sanitized_id(id));
    if enabled.is_dir() { enabled } else { base.join(DISABLED_DIRECTORY).join(sanitized_id(id)) }
}

/// 统一安装目录提供文件，实际装入哪些扩展由 Profile 同步器决定。
pub fn profile_extensions(app: &AppHandle, group: &str, small: Option<&str>) -> Result<Vec<(String, PathBuf, bool)>, String> {
    let base = extension_base_directory(app)?;
    Ok(profile_extensions_from(&base, &load_records(app)?, group, small))
}

/// 使用指定配置计算期望状态，保存前也能撤销旧策略授权。
fn profile_extensions_from(base: &Path, records: &[BrowserExtensionRecord], group: &str, small: Option<&str>) -> Vec<(String, PathBuf, bool)> {
    records.iter().map(|record| (
        record.id.clone(),
        extension_folder(&base, &record.id),
        record.allows(group, small),
    )).collect()
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserExtensionCandidate {
    id: String,
    browser_id: String,
    name: String,
    version: String,
    description: String,
    browser: String,
    profile: String,
    path: String,
    installed: bool,
}

#[derive(Clone, Debug)]
struct ExtensionManifest {
    name: String,
    version: String,
    description: String,
    options_page: Option<String>,
}

fn extension_base_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?
        .join(EXTENSIONS_DIRECTORY);
    fs::create_dir_all(directory.join(ENABLED_DIRECTORY))
        .map_err(|error| format!("无法创建已启用扩展目录 {}：{error}", directory.display()))?;
    fs::create_dir_all(directory.join(DISABLED_DIRECTORY))
        .map_err(|error| format!("无法创建已停用扩展目录 {}：{error}", directory.display()))?;
    Ok(directory)
}

fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(extension_base_directory(app)?.join(EXTENSIONS_STATE_FILE))
}

fn load_records(app: &AppHandle) -> Result<Vec<BrowserExtensionRecord>, String> {
    let path = state_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("无法读取扩展配置 {}：{error}", path.display()))?;
    serde_json::from_str(&content)
        .map_err(|error| format!("扩展配置格式错误 {}：{error}", path.display()))
}

fn save_records(app: &AppHandle, records: &[BrowserExtensionRecord]) -> Result<(), String> {
    let path = state_path(app)?;
    crate::extension_runtime::write_json_atomic(&path, &records)
        .map_err(|error| format!("无法写入扩展配置 {}：{error}", path.display()))
}

fn sanitized_id(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '_'
            }
        })
        .collect()
}

fn managed_extension_id(path: &Path, browser_id: Option<&str>) -> Result<String, String> {
    if let Some(browser_id) = browser_id.filter(|value| !value.trim().is_empty()) {
        return Ok(sanitized_id(browser_id));
    }
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("无法读取扩展目录 {}：{error}", path.display()))?;
    let mut hasher = DefaultHasher::new();
    canonical.to_string_lossy().to_lowercase().hash(&mut hasher);
    Ok(format!("unpacked-{:016x}", hasher.finish()))
}

fn read_json(path: &Path) -> Result<Value, String> {
    let content = fs::read_to_string(path)
        .map_err(|error| format!("无法读取 {}：{error}", path.display()))?;
    serde_json::from_str(&content)
        .map_err(|error| format!("JSON 文件格式错误 {}：{error}", path.display()))
}

fn resolve_localized_message(extension_path: &Path, value: &str) -> String {
    let Some(key) = value
        .strip_prefix("__MSG_")
        .and_then(|value| value.strip_suffix("__"))
    else {
        return value.to_string();
    };
    let locales = extension_path.join("_locales");
    if !locales.is_dir() {
        return value.to_string();
    }
    let mut locale_directories = Vec::new();
    for preferred in ["zh_CN", "zh_TW", "zh", "en", "en_US"] {
        let directory = locales.join(preferred);
        if directory.is_dir() {
            locale_directories.push(directory);
        }
    }
    if let Ok(entries) = fs::read_dir(&locales) {
        for entry in entries.flatten() {
            if entry.path().is_dir() && !locale_directories.contains(&entry.path()) {
                locale_directories.push(entry.path());
            }
        }
    }
    for directory in locale_directories {
        let messages = directory.join("messages.json");
        let Ok(json) = read_json(&messages) else {
            continue;
        };
        let Some(message) = json
            .get(key)
            .or_else(|| json.get(key.to_lowercase()))
            .and_then(|entry| entry.get("message"))
            .and_then(Value::as_str)
        else {
            continue;
        };
        return message.to_string();
    }
    value.to_string()
}

fn read_manifest(extension_path: &Path) -> Result<ExtensionManifest, String> {
    let manifest_path = extension_path.join("manifest.json");
    if !manifest_path.is_file() {
        return Err(format!(
            "所选目录不是有效的已解压扩展，缺少 {}",
            manifest_path.display()
        ));
    }
    let manifest = read_json(&manifest_path)?;
    let name = manifest
        .get("name")
        .and_then(Value::as_str)
        .ok_or_else(|| "扩展 manifest.json 缺少 name".to_string())?;
    let version = manifest
        .get("version")
        .and_then(Value::as_str)
        .ok_or_else(|| "扩展 manifest.json 缺少 version".to_string())?;
    let description = manifest
        .get("description")
        .and_then(Value::as_str)
        .map(|value| resolve_localized_message(extension_path, value))
        .unwrap_or_default();
    let options_page = manifest
        .get("options_ui")
        .and_then(|value| value.get("page"))
        .and_then(Value::as_str)
        .or_else(|| manifest.get("options_page").and_then(Value::as_str))
        .map(ToString::to_string);
    Ok(ExtensionManifest {
        name: resolve_localized_message(extension_path, name),
        version: version.to_string(),
        description,
        options_page,
    })
}

fn copy_directory(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination)
        .map_err(|error| format!("无法创建扩展目录 {}：{error}", destination.display()))?;
    for entry in fs::read_dir(source)
        .map_err(|error| format!("无法读取扩展目录 {}：{error}", source.display()))?
    {
        let entry = entry.map_err(|error| format!("无法读取扩展文件：{error}"))?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        let file_type = entry
            .file_type()
            .map_err(|error| format!("无法读取扩展文件类型 {}：{error}", source_path.display()))?;
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            copy_directory(&source_path, &destination_path)?;
        } else if file_type.is_file() {
            fs::copy(&source_path, &destination_path).map_err(|error| {
                format!(
                    "无法复制扩展文件 {} 到 {}：{error}",
                    source_path.display(),
                    destination_path.display()
                )
            })?;
        }
    }
    Ok(())
}

fn validate_managed_target(base: &Path, target: &Path) -> Result<(), String> {
    if target.parent() != Some(base) {
        return Err("扩展目录超出浏览器数据范围".to_string());
    }
    Ok(())
}

fn remove_managed_directory(base: &Path, target: &Path) -> Result<(), String> {
    validate_managed_target(base, target)?;
    if target.exists() {
        fs::remove_dir_all(target)
            .map_err(|error| format!("无法删除扩展目录 {}：{error}", target.display()))?;
    }
    Ok(())
}

/// 失效通知带具体标签 ID，前端保留其他分组的网页和加载状态。
fn invalidate_browser_webviews(app: &AppHandle, changed: Option<(&BrowserExtensionRecord, &BrowserExtensionRecord)>) -> Result<(), String> {
    let scopes = app.state::<ExtensionScopeStore>().0.lock().map_err(|_| "无法读取扩展分组")?.clone();
    let mut tabs = Vec::new();
    for (label, webview) in app.webviews() {
        if !label.starts_with(BROWSER_WEBVIEW_PREFIX) { continue; }
        let affected = match (changed, scopes.get(&label)) {
            (Some((before, after)), Some((_, group, small))) => before.allows(group, small.as_deref()) != after.allows(group, small.as_deref()),
            _ => true,
        };
        if affected {
            webview.hide().map_err(|error| error.to_string())?;
            webview.close().map_err(|error| error.to_string())?;
            if let Some((tab, _, _)) = scopes.get(&label) { tabs.push(tab.clone()); }
        }
    }
    app.emit("sia://extensions-changed", serde_json::json!({ "tabIds": tabs })).map_err(|error| error.to_string())
}

/// 向独立扩展面板发送当前标签上下文，不改变面板的打开状态。
#[tauri::command]
pub fn update_browser_extension_context(app: crate::window_context::BrowserContext, extension_scope: ExtensionScope, heading: String) -> Result<(), String> {
    app.emit("sia://extension-context-changed", serde_json::json!({ "extensionScope": extension_scope, "heading": heading })).map_err(|error| error.to_string())
}

/// 保存允许的父分组或子分组；空列表表示暂不在任何分组启用。
#[tauri::command]
pub async fn set_browser_extension_scopes(app: AppHandle, id: String, scopes: Option<Vec<ExtensionScope>>) -> Result<BrowserExtensionRecord, String> {
    let state = app.state::<crate::extension_runtime::ExtensionOperationLock>();
    let _guard = state.0.lock().await;
    let mut records = load_records(&app)?;
    let record = records.iter_mut().find(|record| record.id == id).ok_or("扩展不存在")?;
    let before = record.clone();
    if scopes.as_ref().is_some_and(|items| items.iter().any(|scope| scope.group_id.is_empty() || scope.small_group_id.as_deref() == Some(""))) {
        return Err("分组标识不能为空".into());
    }
    record.scopes = scopes;
    let result = record.clone();
    apply_extension_change(&app, &records, &before, &result).await?;
    Ok(result)
}

/// 保存前撤销全部已有 Profile 的旧授权，包含没有活跃视图的休眠空间。
/// 新增授权留待保存成功后正常打开页面时加载，失败时不会提前授予权限。
async fn apply_extension_change(app: &AppHandle, records: &[BrowserExtensionRecord], before: &BrowserExtensionRecord, after: &BrowserExtensionRecord) -> Result<(), String> {
    let local = app.path().app_local_data_dir().map_err(|error| error.to_string())?;
    let profiles = crate::browser_profiles::existing_profile_scopes(&local)?;
    let base = extension_base_directory(app)?;
    let open_profiles = app.state::<crate::BrowserProfileStore>().0.lock().map_err(|_| "无法读取页面配置")?.clone();
    let mut failure = None;
    for (group, small, directory) in profiles {
        if !before.allows(&group, small.as_deref()) || after.allows(&group, small.as_deref()) { continue; }
        let result = async {
            let desired = profile_extensions_from(&base, records, &group, small.as_deref());
            let live = open_profiles.iter().find_map(|(label, path)| {
                if path == &directory { app.get_webview(label) } else { None }
            });
            if let Some(webview) = live {
                crate::extension_runtime::synchronize(&webview, &directory, desired).await
            } else {
                // 校准窗口始终隐藏且不获焦，只打开空白页，不干扰用户当前页面。
                static NEXT_SYNC: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
                let label = format!("extension-policy-sync-{}", NEXT_SYNC.fetch_add(1, std::sync::atomic::Ordering::Relaxed));
                let window = tauri::WebviewWindowBuilder::new(app, label, tauri::WebviewUrl::External("about:blank".parse().unwrap()))
                    .visible(false).focused(false).skip_taskbar(true).data_directory(directory.clone())
                    .browser_extensions_enabled(true)
                    .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
                    .build().map_err(|error| error.to_string())?;
                let result = crate::extension_runtime::synchronize(window.as_ref(), &directory, desired).await;
                let closed = window.close().map_err(|error| error.to_string());
                result.and(closed)
            }
        }.await;
        if let Err(error) = result { failure = Some(error); break; }
    }
    // 磁盘策略只在全部撤销成功后切换；失败则保留旧配置，关闭已变更页面以便按旧配置恢复。
    let saved = match failure {
        Some(error) => Err(format!("未保存生效范围，扩展权限校准失败：{error}")),
        None => save_records(app, records),
    };
    invalidate_browser_webviews(app, Some((before, after)))?;
    app.emit("sia://extension-toolbar-changed", ()).map_err(|error| error.to_string())?;
    saved
}

fn install_extension_sync(
    app: &AppHandle,
    source_path: &str,
    source: &str,
    browser_id: Option<String>,
) -> Result<BrowserExtensionRecord, String> {
    let source_directory = PathBuf::from(source_path)
        .canonicalize()
        .map_err(|error| format!("无法打开扩展目录 {source_path}：{error}"))?;
    let manifest = read_manifest(&source_directory)?;
    let id = managed_extension_id(&source_directory, browser_id.as_deref())?;
    let base = extension_base_directory(app)?;
    let enabled_base = base.join(ENABLED_DIRECTORY);
    let disabled_base = base.join(DISABLED_DIRECTORY);
    let mut records = load_records(app)?;
    let previous = records.iter().find(|record| record.id == id).cloned();
    let enabled = previous.as_ref().map_or(true, |record| record.enabled);
    let previous_folder = extension_folder(&base, &id);
    let destination = enabled_base.join(&id);
    let disabled_destination = disabled_base.join(&id);
    remove_managed_directory(&enabled_base, &destination)?;
    remove_managed_directory(&disabled_base, &disabled_destination)?;
    copy_directory(&source_directory, if previous.is_some() { &previous_folder } else { &destination })?;

    let record = BrowserExtensionRecord {
        id: id.clone(),
        browser_id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        source: source.to_string(),
        enabled,
        scopes: previous.as_ref().and_then(|record| record.scopes.clone()),
        options_page: manifest.options_page,
        pinned: previous.as_ref().is_some_and(|record| record.pinned),
        icon_url: None,
    };
    records.retain(|item| item.id != id);
    records.push(record.clone());
    records.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    save_records(app, &records)?;
    invalidate_browser_webviews(app, None)?;
    Ok(record)
}

fn extension_profiles(user_data: &Path) -> Vec<(String, PathBuf)> {
    let mut profiles = Vec::new();
    let Ok(entries) = fs::read_dir(user_data) else {
        return profiles;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name == "Default" || name.starts_with("Profile ") {
            let extensions = entry.path().join("Extensions");
            if extensions.is_dir() {
                profiles.push((name, extensions));
            }
        }
    }
    profiles
}

fn latest_extension_version(extension_root: &Path) -> Option<PathBuf> {
    let mut versions = fs::read_dir(extension_root)
        .ok()?
        .flatten()
        .filter(|entry| entry.path().join("manifest.json").is_file())
        .map(|entry| entry.path())
        .collect::<Vec<_>>();
    versions.sort_by(|left, right| {
        left.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .cmp(&right.file_name().unwrap_or_default().to_string_lossy())
    });
    versions.pop()
}

fn scan_extensions_sync(app: &AppHandle) -> Result<Vec<BrowserExtensionCandidate>, String> {
    let local_app_data = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "无法读取 Windows LOCALAPPDATA 目录".to_string())?;
    let browsers = [
        (
            "Google Chrome",
            local_app_data
                .join("Google")
                .join("Chrome")
                .join("User Data"),
        ),
        (
            "Microsoft Edge",
            local_app_data
                .join("Microsoft")
                .join("Edge")
                .join("User Data"),
        ),
    ];
    let records = load_records(app)?;
    let installed_ids = records
        .iter()
        .filter_map(|record| record.browser_id.clone())
        .collect::<Vec<_>>();
    let mut candidates = HashMap::<String, BrowserExtensionCandidate>::new();
    for (browser, user_data) in browsers {
        for (profile, extensions) in extension_profiles(&user_data) {
            let Ok(entries) = fs::read_dir(&extensions) else {
                continue;
            };
            for entry in entries.flatten() {
                let browser_id = entry.file_name().to_string_lossy().to_string();
                let Some(version_path) = latest_extension_version(&entry.path()) else {
                    continue;
                };
                let Ok(manifest) = read_manifest(&version_path) else {
                    continue;
                };
                let key = format!("{browser}:{profile}:{browser_id}");
                candidates.insert(
                    key,
                    BrowserExtensionCandidate {
                        id: format!("{browser}-{profile}-{browser_id}"),
                        browser_id: browser_id.clone(),
                        name: manifest.name,
                        version: manifest.version,
                        description: manifest.description,
                        browser: browser.to_string(),
                        profile: profile.clone(),
                        path: version_path.to_string_lossy().to_string(),
                        installed: installed_ids.contains(&browser_id),
                    },
                );
            }
        }
    }
    let mut result = candidates.into_values().collect::<Vec<_>>();
    result.sort_by(|left, right| {
        left.name
            .to_lowercase()
            .cmp(&right.name.to_lowercase())
            .then_with(|| left.browser.cmp(&right.browser))
    });
    Ok(result)
}

#[tauri::command]
pub async fn list_browser_extensions(
    app: AppHandle,
) -> Result<Vec<BrowserExtensionRecord>, String> {
    // 磁盘读取在后台执行，面板使用前端缓存即时打开。
    tauri::async_runtime::spawn_blocking(move || {
        let mut records = load_records(&app)?;
        let base = extension_base_directory(&app)?;
        for record in &mut records {
            let folder = extension_folder(&base, &record.id);
            record.icon_url = read_extension_icon(&folder);
        }
        Ok(records)
    }).await.map_err(|error| format!("读取扩展列表失败：{error}"))?
}

/// 只读取扩展目录内有限大小的位图，避免路径穿越及不受信任的 SVG 脚本。
fn read_extension_icon(folder: &Path) -> Option<String> {
    let manifest = read_json(&folder.join("manifest.json")).ok()?;
    let icons = manifest.get("icons")?.as_object()?;
    let relative = ["32", "48", "16", "128"].into_iter()
        .find_map(|size| icons.get(size).and_then(Value::as_str))?;
    let root = folder.canonicalize().ok()?;
    let path = root.join(relative).canonicalize().ok()?;
    if !path.starts_with(&root) || fs::metadata(&path).ok()?.len() > 262_144 { return None; }
    let mime = match path.extension()?.to_str()?.to_ascii_lowercase().as_str() {
        "png" => "image/png", "jpg" | "jpeg" => "image/jpeg", "webp" => "image/webp",
        _ => return None,
    };
    let bytes = fs::read(path).ok()?;
    let encoded: String = bytes.iter().map(|byte| format!("%{byte:02X}")).collect();
    Some(format!("data:{mime},{encoded}"))
}

/// 固定状态只改变工具栏，不销毁网页或重新加载扩展运行环境。
#[tauri::command]
pub async fn set_browser_extension_pinned(app: AppHandle, id: String, pinned: bool) -> Result<(), String> {
    let state = app.state::<crate::extension_runtime::ExtensionOperationLock>();
    let _guard = state.0.lock().await;

    let mut records = load_records(&app)?;
    let record = records.iter_mut().find(|record| record.id == id)
        .ok_or_else(|| "扩展不存在".to_string())?;
    record.pinned = pinned;
    save_records(&app, &records)?;
    app.emit("sia://extension-toolbar-changed", ()).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn scan_browser_extensions(
    app: AppHandle,
) -> Result<Vec<BrowserExtensionCandidate>, String> {
    tauri::async_runtime::spawn_blocking(move || scan_extensions_sync(&app))
        .await
        .map_err(|error| format!("扩展扫描任务失败：{error}"))?
}

#[tauri::command]
pub async fn pick_browser_extension_folder() -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new()
            .set_title("选择包含 manifest.json 的已解压扩展目录")
            .pick_folder()
            .map(|path| path.to_string_lossy().to_string())
    })
    .await
    .map_err(|error| format!("打开扩展目录选择器失败：{error}"))
}

#[tauri::command]
pub async fn install_browser_extension(
    app: AppHandle,
    path: String,
    source: String,
    browser_id: Option<String>,
) -> Result<BrowserExtensionRecord, String> {
    let state = app.state::<crate::extension_runtime::ExtensionOperationLock>();
    let _guard = state.0.lock().await;

    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        install_extension_sync(&app, &path, &source, browser_id)
    })
    .await
    .map_err(|error| format!("扩展安装任务失败：{error}"))?
}

#[tauri::command]
pub async fn set_browser_extension_enabled(
    app: AppHandle,
    id: String,
    enabled: bool,
) -> Result<BrowserExtensionRecord, String> {
    let state = app.state::<crate::extension_runtime::ExtensionOperationLock>();
    let _guard = state.0.lock().await;

    let mut records = load_records(&app)?;
    let record = records.iter_mut().find(|record| record.id == id).ok_or("扩展不存在")?;
    let before = record.clone();
    record.enabled = enabled;
    let result = record.clone();
    apply_extension_change(&app, &records, &before, &result).await?;
    Ok(result)
}

/// 返回指定标签所在 Profile 的真实扩展 ID，不使用来自 Chrome/Edge 的原始安装 ID。
#[tauri::command]
pub async fn resolve_browser_extension_id(app: AppHandle, id: String, tab_id: String) -> Result<String, String> {
    let state = app.state::<crate::extension_runtime::ExtensionOperationLock>();
    let _guard = state.0.lock().await;
    let label = crate::browser_label(&tab_id);
    let scopes = app.state::<ExtensionScopeStore>().0.lock().map_err(|_| "无法读取标签分组")?.clone();
    let (_, group, small) = scopes.get(&label).ok_or("请先打开当前分组的网页")?;
    let record = load_records(&app)?.into_iter().find(|record| record.id == id).ok_or("扩展不存在")?;
    if !record.allows(group, small.as_deref()) { return Err("此分组未启用该扩展".into()); }
    let directory = crate::browser_group_data_directory(&app, group, small.as_deref())?;
    crate::extension_runtime::read_runtime_ids(&directory)?.remove(&id).ok_or("扩展尚未在当前分组加载".into())
}

#[tauri::command]
pub async fn remove_browser_extension(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<crate::extension_runtime::ExtensionOperationLock>();
    let _guard = state.0.lock().await;

    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let base = extension_base_directory(&app)?;
        let enabled_base = base.join(ENABLED_DIRECTORY);
        let disabled_base = base.join(DISABLED_DIRECTORY);
        let safe_id = sanitized_id(&id);
        if safe_id != id {
            return Err("扩展标识无效".to_string());
        }
        remove_managed_directory(&enabled_base, &enabled_base.join(&id))?;
        remove_managed_directory(&disabled_base, &disabled_base.join(&id))?;
        let mut records = load_records(&app)?;
        records.retain(|record| record.id != id);
        save_records(&app, &records)?;
        invalidate_browser_webviews(&app, None)?;
        Ok(())
    })
    .await
    .map_err(|error| format!("扩展删除任务失败：{error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 旧记录缺少 scopes 时兼容所有分组，明确空白名单时禁止任何范围。
    fn record(scopes: Option<Vec<ExtensionScope>>) -> BrowserExtensionRecord {
        let mut record: BrowserExtensionRecord = serde_json::from_str(r#"{"id":"test","name":"测试扩展","version":"1","description":"","source":"test","enabled":true}"#).unwrap();
        record.scopes = scopes;
        record
    }

    #[test]
    fn legacy_and_empty_scopes_are_distinct() {
        assert!(record(None).allows("未分组", None));
        assert!(!record(Some(vec![])).allows("dev", Some("admin")));
    }

    #[test]
    fn parent_covers_existing_and_future_children_only_in_its_group() {
        let value = record(Some(vec![ExtensionScope { group_id: "dev".into(), small_group_id: None }]));
        assert!(value.allows("dev", None));
        assert!(value.allows("dev", Some("future-child")));
        assert!(!value.allows("pre", Some("future-child")));
    }

    #[test]
    fn child_scope_does_not_grant_parent_or_sibling_access() {
        let mut value = record(Some(vec![ExtensionScope { group_id: "dev".into(), small_group_id: Some("admin".into()) }]));
        assert!(value.allows("dev", Some("admin")));
        assert!(!value.allows("dev", None));
        assert!(!value.allows("dev", Some("brand")));
        assert!(!value.allows("pre", Some("admin")));
        value.enabled = false;
        assert!(!value.allows("dev", Some("admin")));
    }
}
