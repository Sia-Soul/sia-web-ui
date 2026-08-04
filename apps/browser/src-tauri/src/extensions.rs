use serde::{Deserialize, Serialize};
use serde_json::Value;
#[cfg(windows)]
use std::sync::{Arc, Mutex};
use std::{
    collections::{hash_map::DefaultHasher, HashMap},
    fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Emitter, Manager};
#[cfg(windows)]
use webview2_com::{
    CoTaskMemPWSTR,
    Microsoft::Web::WebView2::Win32::{ICoreWebView2, ICoreWebView2Profile7, ICoreWebView2_13},
    ProfileGetBrowserExtensionsCompletedHandler,
};
#[cfg(windows)]
use windows::core::{Interface, PWSTR};

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
    options_page: Option<String>,
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

pub fn enabled_extensions_directory(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(extension_base_directory(app)?.join(ENABLED_DIRECTORY))
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
    let content = serde_json::to_string_pretty(records)
        .map_err(|error| format!("无法序列化扩展配置：{error}"))?;
    fs::write(&path, content.as_bytes())
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

fn invalidate_browser_webviews(app: &AppHandle) {
    for (label, webview) in app.webviews() {
        if label.starts_with(BROWSER_WEBVIEW_PREFIX) {
            let _ = webview.hide();
            let _ = webview.close();
        }
    }
    let _ = app.emit("sia://extensions-changed", ());
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
    let destination = enabled_base.join(&id);
    let disabled_destination = disabled_base.join(&id);
    remove_managed_directory(&enabled_base, &destination)?;
    remove_managed_directory(&disabled_base, &disabled_destination)?;
    copy_directory(&source_directory, &destination)?;

    let record = BrowserExtensionRecord {
        id: id.clone(),
        browser_id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        source: source.to_string(),
        enabled: true,
        options_page: manifest.options_page,
    };
    let mut records = load_records(app)?;
    records.retain(|item| item.id != id);
    records.push(record.clone());
    records.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    save_records(app, &records)?;
    invalidate_browser_webviews(app);
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
    load_records(&app)
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
    tauri::async_runtime::spawn_blocking(move || {
        let base = extension_base_directory(&app)?;
        let enabled_base = base.join(ENABLED_DIRECTORY);
        let disabled_base = base.join(DISABLED_DIRECTORY);
        let safe_id = sanitized_id(&id);
        if safe_id != id {
            return Err("扩展标识无效".to_string());
        }
        let source = if enabled {
            disabled_base.join(&id)
        } else {
            enabled_base.join(&id)
        };
        let destination = if enabled {
            enabled_base.join(&id)
        } else {
            disabled_base.join(&id)
        };
        validate_managed_target(source.parent().unwrap_or(&base), &source)?;
        validate_managed_target(destination.parent().unwrap_or(&base), &destination)?;
        if !source.exists() && !destination.exists() {
            return Err("找不到扩展文件，请重新安装该扩展".to_string());
        }
        if source.exists() {
            remove_managed_directory(destination.parent().unwrap_or(&base), &destination)?;
            fs::rename(&source, &destination).map_err(|error| {
                format!(
                    "无法{}扩展文件 {}：{error}",
                    if enabled { "启用" } else { "停用" },
                    source.display()
                )
            })?;
        }
        let mut records = load_records(&app)?;
        let record = records
            .iter_mut()
            .find(|record| record.id == id)
            .ok_or_else(|| "找不到扩展记录".to_string())?;
        record.enabled = enabled;
        let result = record.clone();
        save_records(&app, &records)?;
        invalidate_browser_webviews(&app);
        Ok(result)
    })
    .await
    .map_err(|error| format!("扩展状态更新任务失败：{error}"))?
}

#[cfg(windows)]
#[tauri::command]
pub async fn resolve_browser_extension_id(
    app: AppHandle,
    id: String,
    name: String,
) -> Result<String, String> {
    let webview = app
        .webviews()
        .into_iter()
        .find(|(label, _)| label.starts_with(BROWSER_WEBVIEW_PREFIX))
        .map(|(_, webview)| webview)
        .ok_or_else(|| "请先打开任意网页，再打开扩展配置页面".to_string())?;

    let (sender, receiver) = tokio::sync::oneshot::channel::<Result<String, String>>();
    let sender = Arc::new(Mutex::new(Some(sender)));
    let callback_sender = Arc::clone(&sender);
    let target_name = name.clone();

    webview
        .with_webview(move |platform_webview| {
            let result = (|| -> windows::core::Result<()> {
                let core_webview: ICoreWebView2 =
                    unsafe { platform_webview.controller().CoreWebView2()? };
                let profile = unsafe {
                    core_webview
                        .cast::<ICoreWebView2_13>()?
                        .Profile()?
                        .cast::<ICoreWebView2Profile7>()?
                };
                let handler = ProfileGetBrowserExtensionsCompletedHandler::create(Box::new(
                    move |status, extensions| {
                        let resolved = (|| -> Result<String, String> {
                            status
                                .map_err(|error| format!("无法读取 WebView2 扩展列表：{error}"))?;
                            let extensions =
                                extensions.ok_or_else(|| "WebView2 未返回扩展列表".to_string())?;
                            let mut count = 0;
                            unsafe {
                                extensions.Count(&mut count).map_err(|error| {
                                    format!("无法读取 WebView2 扩展数量：{error}")
                                })?;
                            }
                            for index in 0..count {
                                let extension = unsafe {
                                    extensions.GetValueAtIndex(index).map_err(|error| {
                                        format!("无法读取 WebView2 扩展：{error}")
                                    })?
                                };
                                let mut raw_name = PWSTR::null();
                                unsafe {
                                    extension.Name(&mut raw_name).map_err(|error| {
                                        format!("无法读取 WebView2 扩展名称：{error}")
                                    })?;
                                }
                                let extension_name = CoTaskMemPWSTR::from(raw_name).to_string();
                                if extension_name != target_name {
                                    continue;
                                }

                                let mut raw_id = PWSTR::null();
                                unsafe {
                                    extension.Id(&mut raw_id).map_err(|error| {
                                        format!("无法读取 WebView2 扩展标识：{error}")
                                    })?;
                                }
                                let extension_id = CoTaskMemPWSTR::from(raw_id).to_string();
                                if !extension_id.is_empty() {
                                    return Ok(extension_id);
                                }
                            }
                            Err(format!(
                                "未找到已加载的扩展“{target_name}”，请重新启用后再试"
                            ))
                        })();
                        if let Ok(mut sender) = callback_sender.lock() {
                            if let Some(sender) = sender.take() {
                                let _ = sender.send(resolved);
                            }
                        }
                        Ok(())
                    },
                ));
                unsafe {
                    profile.GetBrowserExtensions(&handler)?;
                }
                Ok(())
            })();

            if let Err(error) = result {
                if let Ok(mut sender) = sender.lock() {
                    if let Some(sender) = sender.take() {
                        let _ = sender.send(Err(format!("无法查询扩展配置页面：{error}")));
                    }
                }
            }
        })
        .map_err(|error| format!("无法访问浏览器网页视图：{error}"))?;

    let browser_id = receiver
        .await
        .map_err(|_| "扩展配置页面查询意外中断".to_string())??;
    let mut records = load_records(&app)?;
    if let Some(record) = records.iter_mut().find(|record| record.id == id) {
        record.browser_id = Some(browser_id.clone());
        save_records(&app, &records)?;
    }
    Ok(browser_id)
}

#[cfg(not(windows))]
#[tauri::command]
pub async fn resolve_browser_extension_id(
    _app: AppHandle,
    _id: String,
    _name: String,
) -> Result<String, String> {
    Err("扩展配置页面仅支持 Windows 桌面版".to_string())
}

#[tauri::command]
pub async fn remove_browser_extension(app: AppHandle, id: String) -> Result<(), String> {
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
        invalidate_browser_webviews(&app);
        Ok(())
    })
    .await
    .map_err(|error| format!("扩展删除任务失败：{error}"))?
}
