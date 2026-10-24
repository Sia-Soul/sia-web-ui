mod browser_overlay;
mod browser_profiles;
mod browser_visibility;
mod browser_theme;
mod extensions;
mod extension_runtime;
mod floating_windows;
mod passwords;
mod startup_diagnostics;
mod browser_startup;
mod window_resize;
#[cfg(windows)]
mod browser_favicon;
#[cfg(windows)]
mod browser_shortcuts;
#[cfg(windows)]
mod popup_window;

#[cfg(windows)]
use std::{
    cell::RefCell,
    collections::{HashMap, HashSet},
    ffi::{OsStr, OsString},
    os::windows::ffi::OsStrExt,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
};

use passwords::{attach_password_bridge, PASSWORD_AUTOFILL_SCRIPT};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{
    webview::{NewWindowResponse, PageLoadEvent, WebviewBuilder},
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Position, Rect, Size, WebviewUrl,
};
#[cfg(windows)]
use webview2_com::{
    BytesReceivedChangedEventHandler, CallDevToolsProtocolMethodCompletedHandler, CoTaskMemPWSTR,
    DownloadStartingEventHandler, IsDocumentPlayingAudioChangedEventHandler,
    Microsoft::Web::WebView2::Win32::{
        ICoreWebView2, ICoreWebView2Deferral, ICoreWebView2DownloadOperation,
        ICoreWebView2DownloadStartingEventArgs, ICoreWebView2_4, ICoreWebView2_8,
        COREWEBVIEW2_DOWNLOAD_STATE, COREWEBVIEW2_DOWNLOAD_STATE_COMPLETED,
        COREWEBVIEW2_DOWNLOAD_STATE_IN_PROGRESS,
    },
    StateChangedEventHandler, WindowCloseRequestedEventHandler,
};
#[cfg(windows)]
use windows::core::{Interface, BOOL, PCWSTR, PWSTR};
#[cfg(windows)]
use windows::Win32::UI::{
    Shell::ShellExecuteW,
    WindowsAndMessaging::SW_SHOWNORMAL,
};

const BROWSER_WEBVIEW_PREFIX: &str = "browser-tab-";
const BROWSER_STATE_FILE: &str = "browser-state.json";
/// 记录每个已创建 WebView 的数据目录，防止标签变更隔离范围后复用旧登录状态。
#[derive(Default)]
struct BrowserProfileStore(std::sync::Mutex<std::collections::HashMap<String, std::path::PathBuf>>);
#[cfg(windows)]
static NEXT_DOWNLOAD_ID: AtomicU64 = AtomicU64::new(1);

#[cfg(windows)]
#[derive(Clone, Debug, Default)]
struct DownloadPreferences {
    directory: PathBuf,
    ask_before_download: bool,
}

#[cfg(windows)]
#[derive(Clone, Debug, Default)]
struct PendingDownloadMetadata {
    file_name: String,
}

#[cfg(windows)]
#[derive(Default)]
struct DownloadRuntimeState {
    preferences: Mutex<DownloadPreferences>,
    pending: Mutex<HashMap<String, PendingDownloadMetadata>>,
    open_after_completion: Mutex<HashSet<String>>,
    active: Mutex<HashMap<String, String>>,
    closing_tabs: Mutex<HashSet<String>>,
}

#[cfg(windows)]
struct PendingDownload {
    args: ICoreWebView2DownloadStartingEventArgs,
    deferral: ICoreWebView2Deferral,
    operation: ICoreWebView2DownloadOperation,
    tab_id: String,
}

#[cfg(windows)]
thread_local! {
    static PENDING_DOWNLOADS: RefCell<HashMap<String, PendingDownload>> =
        RefCell::new(HashMap::new());
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowserBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BrowserMenuGroup {
    id: String,
    name: String,
    disabled: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BrowserEvent {
    tab_id: String,
    group_id: String,
    kind: &'static str,
    url: Option<String>,
    title: Option<String>,
    loading: Option<bool>,
    audible: Option<bool>,
    muted: Option<bool>,
    message: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BrowserDownloadEvent {
    id: String,
    tab_id: String,
    state: &'static str,
    received_bytes: u64,
    total_bytes: Option<u64>,
    success: Option<bool>,
    source_url: Option<String>,
    file_path: Option<String>,
    file_name: Option<String>,
}

fn sanitize_identifier(value: &str) -> String {
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

fn browser_label(tab_id: &str) -> String {
    format!("{BROWSER_WEBVIEW_PREFIX}{}", sanitize_identifier(tab_id))
}

fn browser_state_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&directory)
        .map_err(|error| format!("无法创建浏览器数据目录 {}：{error}", directory.display()))?;
    Ok(directory.join(BROWSER_STATE_FILE))
}

/// 按大分组和小分组的稳定标识创建独立 WebView2 数据目录，重命名不会改变目录。
fn browser_group_data_directory(
    app: &AppHandle,
    group_id: &str,
    small_group_id: Option<&str>,
) -> Result<std::path::PathBuf, String> {
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?
        .join(browser_profiles::relative_profile_path(group_id, small_group_id));
    std::fs::create_dir_all(&directory).map_err(|error| {
        format!(
            "无法创建分组 Cookie 数据目录 {}：{error}",
            directory.display()
        )
    })?;
    Ok(directory)
}

fn logical_rect(bounds: BrowserBounds) -> Rect {
    Rect {
        position: Position::Logical(LogicalPosition::new(bounds.x, bounds.y)),
        size: Size::Logical(LogicalSize::new(
            bounds.width.max(1.0),
            bounds.height.max(1.0),
        )),
    }
}

fn parse_browser_url(value: &str) -> Result<tauri::Url, String> {
    let url = tauri::Url::parse(value).map_err(|error| format!("网址无效：{error}"))?;
    match url.scheme() {
        "http" | "https" | "chrome-extension" | "about" => Ok(url),
        scheme => Err(format!("当前版本暂不支持 {scheme} 协议")),
    }
}

fn emit_browser_event(app: &AppHandle, event: BrowserEvent) {
    eprintln!(
        "[browser-event] tab={} kind={} loading={:?} url={:?}",
        event.tab_id, event.kind, event.loading, event.url
    );
    let _ = app.emit("sia://browser-event", event);
}

#[cfg(windows)]
fn read_download_progress(
    operation: &ICoreWebView2DownloadOperation,
) -> windows::core::Result<(u64, Option<u64>)> {
    let mut received_bytes = 0_i64;
    let mut total_bytes = 0_i64;
    unsafe {
        operation.BytesReceived(&mut received_bytes)?;
        operation.TotalBytesToReceive(&mut total_bytes)?;
    }
    Ok((
        received_bytes.max(0) as u64,
        (total_bytes > 0).then_some(total_bytes as u64),
    ))
}

#[cfg(windows)]
fn download_file_name(operation: &ICoreWebView2DownloadOperation) -> String {
    let mut raw_file_path = PWSTR::null();
    let file_path = unsafe { operation.ResultFilePath(&mut raw_file_path) }
        .ok()
        .map(|_| CoTaskMemPWSTR::from(raw_file_path).to_string())
        .filter(|value| !value.is_empty());
    file_path
        .as_deref()
        .and_then(|path| Path::new(path).file_name())
        .map(|name| name.to_string_lossy().into_owned())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "download".to_string())
}

#[cfg(windows)]
fn unique_download_path(directory: &Path, file_name: &str) -> Result<PathBuf, String> {
    std::fs::create_dir_all(directory)
        .map_err(|error| format!("无法创建下载目录 {}：{error}", directory.display()))?;
    let original = directory.join(file_name);
    if !original.exists() {
        return Ok(original);
    }

    let file_path = Path::new(file_name);
    let stem = file_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("download");
    let extension = file_path.extension().and_then(|value| value.to_str());
    for index in 1..10_000 {
        let candidate_name = match extension {
            Some(extension) if !extension.is_empty() => format!("{stem} ({index}).{extension}"),
            _ => format!("{stem} ({index})"),
        };
        let candidate = directory.join(candidate_name);
        if !candidate.exists() {
            return Ok(candidate);
        }
    }
    Err("无法为下载文件生成可用的文件名".to_string())
}

#[cfg(windows)]
fn set_download_result_path(
    args: &ICoreWebView2DownloadStartingEventArgs,
    path: &Path,
) -> windows::core::Result<()> {
    let wide_path = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    unsafe { args.SetResultFilePath(PCWSTR(wide_path.as_ptr())) }
}

#[cfg(windows)]
fn wide_null(value: &OsStr) -> Vec<u16> {
    value
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

#[cfg(windows)]
fn shell_execute(
    file: &OsStr,
    parameters: Option<&OsStr>,
    error_context: &str,
) -> Result<(), String> {
    let operation = wide_null(OsStr::new("open"));
    let file = wide_null(file);
    let parameters = parameters.map(wide_null);
    let parameter_pointer = parameters
        .as_ref()
        .map(|value| PCWSTR(value.as_ptr()))
        .unwrap_or(PCWSTR::null());
    let result = unsafe {
        ShellExecuteW(
            None,
            PCWSTR(operation.as_ptr()),
            PCWSTR(file.as_ptr()),
            parameter_pointer,
            PCWSTR::null(),
            SW_SHOWNORMAL,
        )
    };
    let status = result.0 as isize;
    if status <= 32 {
        Err(format!("{error_context}（ShellExecute 错误码：{status}）"))
    } else {
        Ok(())
    }
}

#[cfg(windows)]
fn open_download_path(path: &Path) {
    if let Err(error) = shell_execute(
        path.as_os_str(),
        None,
        "Windows 无法使用默认应用打开该文件",
    ) {
        eprintln!("无法自动打开下载文件 {}：{error}", path.display());
    }
}

#[cfg(windows)]
fn emit_download_event(
    app: &AppHandle,
    tab_id: &str,
    download_id: &str,
    state: &'static str,
    operation: &ICoreWebView2DownloadOperation,
    success: Option<bool>,
) -> windows::core::Result<()> {
    // 已关闭页签的下载仍由隐藏 WebView 托管，最后一个任务结束后才释放它。
    let runtime = app.state::<DownloadRuntimeState>();
    if let Ok(mut active) = runtime.active.lock() {
        if state == "finished" { active.remove(download_id); }
        else { active.insert(download_id.to_string(), tab_id.to_string()); }
    }
    if state == "finished" && runtime.closing_tabs.lock().map(|tabs| tabs.contains(tab_id)).unwrap_or(false) {
        let cleanup_app = app.clone();
        let cleanup_tab = tab_id.to_string();
        let _ = app.run_on_main_thread(move || { let _ = close_browser_tab(cleanup_app, cleanup_tab); });
    }
    let (received_bytes, total_bytes) = read_download_progress(operation)?;
    let mut raw_source_url = PWSTR::null();
    let source_url = unsafe { operation.Uri(&mut raw_source_url) }
        .ok()
        .map(|_| CoTaskMemPWSTR::from(raw_source_url).to_string())
        .filter(|value| !value.is_empty());
    let mut raw_file_path = PWSTR::null();
    let file_path = unsafe { operation.ResultFilePath(&mut raw_file_path) }
        .ok()
        .map(|_| CoTaskMemPWSTR::from(raw_file_path).to_string())
        .filter(|value| !value.is_empty());
    let file_name = file_path.as_ref().and_then(|path| {
        std::path::Path::new(path)
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
    });
    eprintln!(
        "[browser-download] id={download_id} tab={tab_id} state={state} received={received_bytes} total={total_bytes:?}"
    );
    let _ = app.emit(
        "sia://browser-download",
        BrowserDownloadEvent {
            id: download_id.to_string(),
            tab_id: tab_id.to_string(),
            state,
            received_bytes,
            total_bytes,
            success,
            source_url,
            file_path,
            file_name,
        },
    );
    Ok(())
}

#[cfg(windows)]
fn attach_download_operation(
    app: &AppHandle,
    tab_id: &str,
    download_id: &str,
    operation: &ICoreWebView2DownloadOperation,
) -> windows::core::Result<()> {
    let progress_app = app.clone();
    let progress_tab_id = tab_id.to_string();
    let progress_download_id = download_id.to_string();
    let progress_handler =
        BytesReceivedChangedEventHandler::create(Box::new(move |sender, _args| {
            if let Some(operation) = sender {
                emit_download_event(
                    &progress_app,
                    &progress_tab_id,
                    &progress_download_id,
                    "progress",
                    &operation,
                    None,
                )?;
            }
            Ok(())
        }));
    let mut progress_token = 0;
    unsafe {
        operation.add_BytesReceivedChanged(&progress_handler, &mut progress_token)?;
    }

    let state_app = app.clone();
    let state_tab_id = tab_id.to_string();
    let state_download_id = download_id.to_string();
    let state_handler = StateChangedEventHandler::create(Box::new(move |sender, _args| {
        if let Some(operation) = sender {
            let mut download_state = COREWEBVIEW2_DOWNLOAD_STATE::default();
            unsafe {
                operation.State(&mut download_state)?;
            }
            if download_state != COREWEBVIEW2_DOWNLOAD_STATE_IN_PROGRESS {
                let completed = download_state == COREWEBVIEW2_DOWNLOAD_STATE_COMPLETED;
                emit_download_event(
                    &state_app,
                    &state_tab_id,
                    &state_download_id,
                    "finished",
                    &operation,
                    Some(completed),
                )?;
                let should_open = state_app
                    .state::<DownloadRuntimeState>()
                    .open_after_completion
                    .lock()
                    .map(|mut entries| entries.remove(&state_download_id))
                    .unwrap_or(false);
                if completed && should_open {
                    let mut raw_file_path = PWSTR::null();
                    if unsafe { operation.ResultFilePath(&mut raw_file_path) }.is_ok() {
                        let path = CoTaskMemPWSTR::from(raw_file_path).to_string();
                        if !path.is_empty() {
                            open_download_path(Path::new(&path));
                        }
                    }
                }
            }
        }
        Ok(())
    }));
    let mut state_token = 0;
    unsafe {
        operation.add_StateChanged(&state_handler, &mut state_token)?;
    }

    emit_download_event(app, tab_id, download_id, "started", operation, None)
}

#[cfg(windows)]
async fn attach_download_monitor(
    app: &AppHandle,
    webview: &tauri::Webview,
    tab_id: String,
) -> Result<(), String> {
    let monitor_app = app.clone();
    let (sender, receiver) = tokio::sync::oneshot::channel();
    webview
        .with_webview(move |platform_webview| {
            let setup = (|| -> windows::core::Result<()> {
                let core_webview: ICoreWebView2 =
                    unsafe { platform_webview.controller().CoreWebView2()? };
                let close_app = monitor_app.clone();
                let close_tab = tab_id.clone();
                let mut close_token = 0;
                unsafe { core_webview.add_WindowCloseRequested(
                    &WindowCloseRequestedEventHandler::create(Box::new(move |_, _| {
                        emit_browser_event(&close_app, BrowserEvent {
                            tab_id: close_tab.clone(), group_id: String::new(), kind: "close-requested",
                            url: None, title: None, loading: None, audible: None, muted: None, message: None,
                        });
                        Ok(())
                    })), &mut close_token)?; }
                let core_webview_4: ICoreWebView2_4 = core_webview.cast()?;
                let event_app = monitor_app.clone();
                let event_tab_id = tab_id.clone();
                let handler =
                    DownloadStartingEventHandler::create(Box::new(move |_sender, args| {
                        if let Some(args) = args {
                            let operation = unsafe { args.DownloadOperation()? };
                            let download_id = format!(
                                "download-{}",
                                NEXT_DOWNLOAD_ID.fetch_add(1, Ordering::Relaxed)
                            );
                            let preferences = event_app
                                .state::<DownloadRuntimeState>()
                                .preferences
                                .lock()
                                .map(|preferences| preferences.clone())
                                .unwrap_or_default();
                            unsafe {
                                args.SetHandled(true)?;
                            }
                            if preferences.ask_before_download {
                                let deferral = unsafe { args.GetDeferral()? };
                                let file_name = download_file_name(&operation);
                                if let Ok(mut pending) =
                                    event_app.state::<DownloadRuntimeState>().pending.lock()
                                {
                                    pending.insert(
                                        download_id.clone(),
                                        PendingDownloadMetadata {
                                            file_name: file_name.clone(),
                                        },
                                    );
                                }
                                PENDING_DOWNLOADS.with(|pending| {
                                    pending.borrow_mut().insert(
                                        download_id.clone(),
                                        PendingDownload {
                                            args: args.clone(),
                                            deferral,
                                            operation: operation.clone(),
                                            tab_id: event_tab_id.clone(),
                                        },
                                    );
                                });
                                emit_download_event(
                                    &event_app,
                                    &event_tab_id,
                                    &download_id,
                                    "waiting",
                                    &operation,
                                    None,
                                )?;
                            } else {
                                if !preferences.directory.as_os_str().is_empty() {
                                    if let Ok(path) = unique_download_path(
                                        &preferences.directory,
                                        &download_file_name(&operation),
                                    ) {
                                        set_download_result_path(&args, &path)?;
                                    }
                                }
                                attach_download_operation(
                                    &event_app,
                                    &event_tab_id,
                                    &download_id,
                                    &operation,
                                )?;
                            }
                        }
                        Ok(())
                    }));
                let mut token = 0;
                unsafe {
                    core_webview_4.add_DownloadStarting(&handler, &mut token)?;
                }
                Ok(())
            })();

            let _ = sender.send(setup.map_err(|error| error.to_string()));
        })
        .map_err(|error| error.to_string())?;
    receiver.await.map_err(|_| "下载监听初始化中断".to_string())?
}

#[cfg(not(windows))]
async fn attach_download_monitor(
    _app: &AppHandle,
    _webview: &tauri::Webview,
    _tab_id: String,
) -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
fn emit_audio_state(
    app: &AppHandle,
    tab_id: &str,
    group_id: &str,
    core_webview: &ICoreWebView2_8,
) -> windows::core::Result<()> {
    let mut audible = BOOL(0);
    let mut muted = BOOL(0);
    unsafe {
        core_webview.IsDocumentPlayingAudio(&mut audible)?;
        core_webview.IsMuted(&mut muted)?;
    }
    emit_browser_event(
        app,
        BrowserEvent {
            tab_id: tab_id.to_string(),
            group_id: group_id.to_string(),
            kind: "audio",
            url: None,
            title: None,
            loading: None,
            audible: Some(audible.as_bool()),
            muted: Some(muted.as_bool()),
            message: None,
        },
    );
    Ok(())
}

#[cfg(windows)]
fn attach_audio_monitor(
    app: &AppHandle,
    webview: &tauri::Webview,
    tab_id: String,
    group_id: String,
) -> Result<(), String> {
    let monitor_app = app.clone();
    webview
        .with_webview(move |platform_webview| {
            let setup = (|| -> windows::core::Result<()> {
                let core_webview: ICoreWebView2 =
                    unsafe { platform_webview.controller().CoreWebView2()? };
                unsafe {
                    // 内容网页保留 WebView2 默认右键菜单；外壳在自己的文档入口拦截，不影响网页与站点菜单。
                    core_webview
                        .Settings()?
                        .SetAreDefaultContextMenusEnabled(true)?;
                }
                let core_webview_8: ICoreWebView2_8 = core_webview.cast()?;
                let event_app = monitor_app.clone();
                let event_tab_id = tab_id.clone();
                let event_group_id = group_id.clone();
                let handler = IsDocumentPlayingAudioChangedEventHandler::create(Box::new(
                    move |sender, _args| {
                        if let Some(sender) = sender {
                            let sender_8: ICoreWebView2_8 = sender.cast()?;
                            emit_audio_state(
                                &event_app,
                                &event_tab_id,
                                &event_group_id,
                                &sender_8,
                            )?;
                        }
                        Ok(())
                    },
                ));
                let mut token = 0;
                unsafe {
                    core_webview_8.add_IsDocumentPlayingAudioChanged(&handler, &mut token)?;
                }
                emit_audio_state(&monitor_app, &tab_id, &group_id, &core_webview_8)
            })();

            if let Err(error) = setup {
                emit_browser_event(
                    &monitor_app,
                    BrowserEvent {
                        tab_id,
                        group_id,
                        kind: "error",
                        url: None,
                        title: None,
                        loading: None,
                        audible: None,
                        muted: None,
                        message: Some(format!("无法监听网页声音状态：{error}")),
                    },
                );
            }
        })
        .map_err(|error| error.to_string())
}

#[cfg(not(windows))]
fn attach_audio_monitor(
    _app: &AppHandle,
    _webview: &tauri::Webview,
    _tab_id: String,
    _group_id: String,
) -> Result<(), String> {
    Ok(())
}

fn hide_browser_webviews(app: &AppHandle, except_label: Option<&str>) -> Result<(), String> {
    let visibility = app.state::<browser_visibility::BrowserVisibility>();
    for (label, webview) in app.webviews() {
        if label.starts_with(BROWSER_WEBVIEW_PREFIX)
            && Some(label.as_str()) != except_label
        {
            let Some(revision) = visibility.hide_revision(&label)? else { continue; };
            webview.hide().map_err(|error| error.to_string())?;
            visibility.mark_hidden(&label, revision)?;
        }
    }
    Ok(())
}

#[tauri::command]
fn hide_browser_pages(app: AppHandle) -> Result<(), String> {
    hide_browser_webviews(&app, None)
}

#[tauri::command]
async fn open_browser_tab(
    app: AppHandle,
    tab_id: String,
    group_id: String,
    small_group_id: Option<String>,
    url: String,
    bounds: BrowserBounds,
) -> Result<(), String> {
    // 外部页面创建也必须排在壳层和辅助视图预加载之后。
    app.state::<browser_startup::BrowserStartup>().wait().await?;
    // 导航与扩展策略修改串行执行，确保页面只能在最新策略同步成功后加载。
    let extension_lock = app.state::<extension_runtime::ExtensionOperationLock>();
    let _extension_guard = extension_lock.0.lock().await;
    let parsed_url = parse_browser_url(&url)?;
    let label = browser_label(&tab_id);
    let data_directory = browser_group_data_directory(&app, &group_id, small_group_id.as_deref())?;
    // 相同标签只有在隔离目录一致时才能复用；跨范围必须销毁旧 WebView 后重建。
    let profile_matches = app.state::<BrowserProfileStore>().0.lock()
        .map_err(|_| "无法读取标签数据目录")?.get(&label) == Some(&data_directory);
    if app.get_webview(&label).is_some() && !profile_matches {
        close_browser_tab(app.clone(), tab_id.clone())?;
    }
    eprintln!(
        "[browser-view] open tab={tab_id} label={label} bounds=({}, {}, {}, {})",
        bounds.x, bounds.y, bounds.width, bounds.height
    );
    hide_browser_webviews(&app, Some(&label))?;
    app.state::<browser_visibility::BrowserVisibility>().mark_visible(&label)?;

    if let Some(webview) = app.get_webview(&label).filter(|_| profile_matches) {
        eprintln!("[browser-view] reuse label={label}");
        browser_theme::apply_browser_theme(&app, &webview).await?;
        webview
            .set_bounds(logical_rect(bounds))
            .map_err(|error| error.to_string())?;
        webview
            .navigate(parsed_url)
            .map_err(|error| error.to_string())?;
        app.state::<browser_visibility::BrowserVisibility>().mark_visible(&label)?;
        webview.show().map_err(|error| error.to_string())?;
        webview.set_focus().map_err(|error| error.to_string())?;
        floating_windows::raise_tab_panel_if_visible(&app);
        return Ok(());
    }

    let window = app
        .get_window("main")
        .ok_or_else(|| "找不到浏览器主窗口".to_string())?;
    let desired_extensions = extensions::profile_extensions(&app, &group_id, small_group_id.as_deref())?;

    let suppress_initial_blank = parsed_url.as_str() != "about:blank";
    let page_event_app = app.clone();
    let page_event_tab_id = tab_id.clone();
    let page_event_group_id = group_id.clone();
    let title_event_app = app.clone();
    let title_event_tab_id = tab_id.clone();
    let title_event_group_id = group_id.clone();
    let new_window_app = app.clone();
    let new_window_tab_id = tab_id.clone();
    let new_window_group_id = group_id.clone();

    // 先创建空白视图，禁止旧版已持久化扩展在权限校准前接触目标网页。
    let builder = WebviewBuilder::new(label, WebviewUrl::External("about:blank".parse().unwrap()))
        .data_directory(data_directory.clone())
        .browser_extensions_enabled(true)
        .devtools(true)
        .initialization_script(PASSWORD_AUTOFILL_SCRIPT)
        .zoom_hotkeys_enabled(true)
        .on_navigation(|next_url| {
            matches!(
                next_url.scheme(),
                "http" | "https" | "chrome-extension" | "about" | "data" | "blob"
            )
        })
        .on_page_load(move |_webview, payload| {
            if suppress_initial_blank && payload.url().as_str() == "about:blank" { return; }
            emit_browser_event(
                &page_event_app,
                BrowserEvent {
                    tab_id: page_event_tab_id.clone(),
                    group_id: page_event_group_id.clone(),
                    kind: "load",
                    url: Some(payload.url().to_string()),
                    title: None,
                    loading: Some(matches!(payload.event(), PageLoadEvent::Started)),
                    audible: None,
                    muted: None,
                    message: None,
                },
            );
        })
        .on_document_title_changed(move |_webview, title| {
            emit_browser_event(
                &title_event_app,
                BrowserEvent {
                    tab_id: title_event_tab_id.clone(),
                    group_id: title_event_group_id.clone(),
                    kind: "title",
                    url: None,
                    title: Some(title),
                    loading: None,
                    audible: None,
                    muted: None,
                    message: None,
                },
            );
        })
        .on_new_window(move |next_url, _features| {
            if matches!(next_url.scheme(), "http" | "https") {
                emit_browser_event(
                    &new_window_app,
                    BrowserEvent {
                        tab_id: new_window_tab_id.clone(),
                        group_id: new_window_group_id.clone(),
                        kind: "new-window",
                        url: Some(next_url.to_string()),
                        title: None,
                        loading: None,
                        audible: None,
                        muted: None,
                        message: None,
                    },
                );
            }
            NewWindowResponse::Deny
        });

    // WebView2 在窄高窗口播放铺满视口的视频时可能停止呈现页面合成层，
    // 导致控制栏 DOM 已显示而屏幕仍为黑色；只对外部网页启用软件合成兼容路径。
    // 保留 Wry 默认参数，外壳与侧栏仍使用原有渲染配置。
    // https://github.com/MicrosoftEdge/WebView2Feedback/issues/5574
    #[cfg(windows)]
    let builder = builder.additional_browser_args(
        "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --disable-gpu-compositing",
    );

    let webview = window
        .add_child(
            builder,
            LogicalPosition::new(bounds.x, bounds.y),
            LogicalSize::new(bounds.width.max(1.0), bounds.height.max(1.0)),
        )
        .map_err(|error| {
            eprintln!("创建网页 WebView 失败：tab={tab_id} error={error}");
            error.to_string()
        })?;
    eprintln!("[browser-view] created label={}", browser_label(&tab_id));
    // 新建及休眠恢复都先应用浏览器主题，再加载网页或内核错误页。
    if let Err(error) = browser_theme::apply_browser_theme(&app, &webview).await {
        let _ = webview.close();
        return Err(error);
    }
    if let Err(error) = extension_runtime::synchronize(&webview, &data_directory, desired_extensions).await {
        let _ = webview.close();
        return Err(format!("分组扩展初始化失败：{error}"));
    }
    app.state::<extensions::ExtensionScopeStore>().0.lock().map_err(|_| "无法记录扩展分组")?
        .insert(browser_label(&tab_id), (tab_id.clone(), group_id.clone(), small_group_id));
    app.state::<BrowserProfileStore>().0.lock()
        .map_err(|_| "无法记录标签数据目录")?.insert(browser_label(&tab_id), data_directory);
    // 在首次导航前订阅内核站点图标；旧运行时不支持时仍允许正常浏览网页。
    if let Err(error) = browser_favicon::attach(&app, &webview, tab_id.clone()).await {
        eprintln!("无法监听站点图标：{error}");
    }
    #[cfg(windows)]
    if let Err(error) = browser_shortcuts::attach(&app, &webview, tab_id.clone()).await {
        let _ = webview.close();
        return Err(error);
    }
    // 下载链接可能立即返回附件，必须在首次导航前完成订阅。
    attach_download_monitor(&app, &webview, tab_id.clone()).await?;
    webview.navigate(parsed_url).map_err(|error| error.to_string())?;
    webview.set_focus().map_err(|error| error.to_string())?;
    floating_windows::raise_tab_panel_if_visible(&app);

    let audio_app = app.clone();
    let audio_webview = webview.clone();
    let audio_tab_id = tab_id.clone();
    let audio_group_id = group_id.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = attach_audio_monitor(
            &audio_app,
            &audio_webview,
            audio_tab_id.clone(),
            audio_group_id.clone(),
        ) {
            emit_browser_event(
                &audio_app,
                BrowserEvent {
                    tab_id: audio_tab_id,
                    group_id: audio_group_id,
                    kind: "error",
                    url: None,
                    title: None,
                    loading: None,
                    audible: None,
                    muted: None,
                    message: Some(format!("无法初始化网页声音监听：{error}")),
                },
            );
        }
    });

    let password_app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = attach_password_bridge(&password_app, &webview, tab_id) {
            eprintln!("无法初始化密码表单桥接：{error}");
        }
    });
    Ok(())
}

#[tauri::command]
async fn switch_browser_tab(
    app: AppHandle,
    tab_id: String,
    group_id: String,
    small_group_id: Option<String>,
    bounds: BrowserBounds,
) -> Result<bool, String> {
    let label = browser_label(&tab_id);
    // 激活已有标签也校验隔离范围；不匹配时让调用方走重建流程，不能显示旧空间的页面。
    // 已有视图只需比对隔离路径；目录在创建视图时已建立，切页不再触发磁盘访问。
    let expected_directory = app.path().app_local_data_dir()
        .map_err(|error| error.to_string())?
        .join(browser_profiles::relative_profile_path(&group_id, small_group_id.as_deref()));
    if app.state::<BrowserProfileStore>().0.lock()
        .map_err(|_| "无法读取标签数据目录")?.get(&label) != Some(&expected_directory) {
        return Ok(false);
    }
    eprintln!(
        "[browser-view] switch tab={tab_id} label={label} bounds=({}, {}, {}, {})",
        bounds.x, bounds.y, bounds.width, bounds.height
    );
    if let Some(webview) = app.get_webview(&label) {
        hide_browser_webviews(&app, Some(&label))?;
        eprintln!("[browser-view] show label={label}");
        webview
            .set_bounds(logical_rect(bounds))
            .map_err(|error| error.to_string())?;
        app.state::<browser_visibility::BrowserVisibility>().mark_visible(&label)?;
        webview.show().map_err(|error| error.to_string())?;
        webview.set_focus().map_err(|error| error.to_string())?;
        floating_windows::raise_tab_panel_if_visible(&app);
        Ok(true)
    } else {
        eprintln!("[browser-view] missing label={label}");
        Ok(false)
    }
}

#[tauri::command]
fn close_browser_tab(app: AppHandle, tab_id: String) -> Result<(), String> {
    app.state::<browser_visibility::BrowserVisibility>().mark_visible(&browser_label(&tab_id))?;
    if let Some(webview) = app.get_webview(&browser_label(&tab_id)) {
        // 先隐藏再销毁，确保“主页”和关闭标签操作不会因 WebView2 延迟销毁而残留旧网页。
        webview.hide().map_err(|error| error.to_string())?;
        #[cfg(windows)]
        {
            let runtime = app.state::<DownloadRuntimeState>();
            if runtime.active.lock().map_err(|_| "无法读取下载状态")?.values().any(|id| id == &tab_id) {
                runtime.closing_tabs.lock().map_err(|_| "无法记录关闭页签")?.insert(tab_id);
                return Ok(());
            }
            runtime.closing_tabs.lock().map_err(|_| "无法清理关闭页签")?.remove(&tab_id);
        }
        webview.close().map_err(|error| error.to_string())?;
    }
    app.state::<extensions::ExtensionScopeStore>().0.lock()
        .map_err(|_| "无法移除扩展分组记录")?.remove(&browser_label(&tab_id));
    app.state::<BrowserProfileStore>().0.lock()
        .map_err(|_| "无法移除标签数据目录记录")?.remove(&browser_label(&tab_id));
    Ok(())
}

#[tauri::command]
fn open_browser_devtools(app: AppHandle, tab_id: String) -> Result<(), String> {
    let webview = app
        .get_webview(&browser_label(&tab_id))
        .ok_or_else(|| "当前标签页还没有打开网页".to_string())?;
    webview.open_devtools();
    Ok(())
}

#[tauri::command]
fn set_browser_tab_muted(app: AppHandle, tab_id: String, muted: bool) -> Result<(), String> {
    let webview = app
        .get_webview(&browser_label(&tab_id))
        .ok_or_else(|| "当前标签页还没有打开网页".to_string())?;

    #[cfg(windows)]
    {
        let event_app = app.clone();
        let event_tab_id = tab_id.clone();
        webview
            .with_webview(move |platform_webview| {
                let result = (|| -> windows::core::Result<()> {
                    let core_webview: ICoreWebView2 =
                        unsafe { platform_webview.controller().CoreWebView2()? };
                    let core_webview_8: ICoreWebView2_8 = core_webview.cast()?;
                    unsafe {
                        core_webview_8.SetIsMuted(muted)?;
                    }
                    emit_audio_state(&event_app, &event_tab_id, "", &core_webview_8)
                })();
                if let Err(error) = result {
                    emit_browser_event(
                        &event_app,
                        BrowserEvent {
                            tab_id: event_tab_id,
                            group_id: String::new(),
                            kind: "error",
                            url: None,
                            title: None,
                            loading: None,
                            audible: None,
                            muted: None,
                            message: Some(format!("无法切换网页静音状态：{error}")),
                        },
                    );
                }
            })
            .map_err(|error| error.to_string())?;
    }

    #[cfg(not(windows))]
    webview
        .eval(&format!(
            "document.querySelectorAll('audio,video').forEach((element) => {{ element.muted = {}; }});",
            if muted { "true" } else { "false" }
        ))
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
/// 打开浏览器功能菜单；标签固定使用左侧树形布局，不提供布局切换入口。
fn show_browser_more_menu(
    app: AppHandle,
    menu_store: tauri::State<'_, floating_windows::BrowserMenuStore>,
    show_bookmarks_bar: bool,
    dark_mode: bool,
    source_window: String,
    x: f64,
    y: f64,
    trigger_bounds: Option<serde_json::Value>,
) -> Result<(), String> {
    eprintln!("[browser-menu] show more x={x} y={y}");
    // 与收藏、历史等面板共用切换规则，只关闭同一入口打开的菜单。
    let payload = json!({
        "darkMode": dark_mode,
        "panelKey": "more",
        "toggleKey": "more",
        "triggerBounds": trigger_bounds,
        "items": [
            { "key": "more:bookmarks", "label": "收藏夹" },
            {
                "key": "more:bookmark-bar",
                "label": "显示收藏夹栏",
                "checked": show_bookmarks_bar
            },
            { "type": "divider" },
            { "key": "more:passwords", "label": "密码" },
            { "type": "divider" },
            {
                "key": "more:theme",
                "label": "主题",
                "variant": "theme",
                "checked": dark_mode
            },
            { "type": "divider" },
            { "key": "more:history", "label": "历史记录" },
            { "key": "more:settings", "label": "浏览器设置" }
        ]
    });
    floating_windows::show_menu(
        &app,
        &menu_store,
        payload,
        source_window,
        floating_windows::FloatingWindowBounds {
            x,
            y,
            width: 240.0,
            height: 354.0,
        },
    )
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn show_browser_panel(
    app: AppHandle,
    menu_store: tauri::State<'_, floating_windows::BrowserMenuStore>,
    payload: serde_json::Value,
    source_window: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    floating_windows::show_menu(
        &app,
        &menu_store,
        payload,
        source_window,
        floating_windows::FloatingWindowBounds {
            x,
            y,
            width,
            height,
        },
    )
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn show_browser_tab_menu(
    app: AppHandle,
    menu_store: tauri::State<'_, floating_windows::BrowserMenuStore>,
    tab_id: String,
    adjacent_direction: String,
    groups: Vec<BrowserMenuGroup>,
    pinned: bool,
    muted: bool,
    disable_close_others: bool,
    disable_close_following: bool,
    disable_reopen_closed: bool,
    dark_mode: bool,
    source_window: String,
    x: f64,
    y: f64,
) -> Result<(), String> {
    let prefix = format!("tab|{tab_id}");
    let move_items = groups
        .into_iter()
        .map(|group| {
            json!({
                "key": format!("{prefix}|move|{}", group.id),
                "label": group.name,
                "disabled": group.disabled
            })
        })
        .collect::<Vec<_>>();
    let payload = json!({
        "darkMode": dark_mode,
        "items": [
            {
                "key": format!("{prefix}|new-adjacent"),
                "label": format!("在{adjacent_direction}新建标签页")
            },
            {
                "key": format!("{prefix}|move"),
                "label": "移动到",
                "children": move_items
            },
            { "type": "divider" },
            {
                "key": format!("{prefix}|refresh"),
                "label": "刷新",
                "shortcut": "Ctrl+R"
            },
            {
                "key": format!("{prefix}|duplicate"),
                "label": "复制标签页",
                "shortcut": "Ctrl+Shift+K"
            },
            {
                "key": format!("{prefix}|move-window"),
                "label": "将标签页移动到新窗口"
            },
            {
                "key": format!("{prefix}|toggle-pin"),
                "label": if pinned { "取消固定标签页" } else { "固定标签页" }
            },
            {
                "key": format!("{prefix}|toggle-mute"),
                "label": if muted { "取消标签页静音" } else { "使标签页静音" },
                "shortcut": "Ctrl+M"
            },
            { "type": "divider" },
            {
                "key": format!("{prefix}|close"),
                "label": "关闭标签页",
                "shortcut": "Ctrl+W"
            },
            {
                "key": format!("{prefix}|close-others"),
                "label": "关闭其他标签页",
                "disabled": disable_close_others
            },
            {
                "key": format!("{prefix}|close-following"),
                "label": format!("关闭{adjacent_direction}标签页"),
                "disabled": disable_close_following
            },
            { "type": "divider" },
            {
                "key": format!("{prefix}|reopen-closed"),
                "label": "重新打开关闭的标签页",
                "shortcut": "Ctrl+Shift+T",
                "disabled": disable_reopen_closed
            }
        ]
    });
    floating_windows::show_menu(
        &app,
        &menu_store,
        payload,
        source_window,
        floating_windows::FloatingWindowBounds {
            x,
            y,
            width: 304.0,
            height: 494.0,
        },
    )
}

#[tauri::command]
/// 节点的更多按钮和右键共用此菜单；小分组仅提供新增标签、重命名和删除操作。
fn show_browser_tree_menu(
    app: AppHandle,
    menu_store: tauri::State<'_, floating_windows::BrowserMenuStore>,
    group_id: String,
    small_group_id: Option<String>,
    dark_mode: bool,
    source_window: String,
    x: f64,
    y: f64,
) -> Result<(), String> {
    let small_group = small_group_id.as_deref().unwrap_or_default();
    let prefix = format!("tree|{group_id}|{small_group}");
    let mut items = vec![json!({
        "key": format!("{prefix}|new-tab"),
        "label": "新建标签页"
    })];
    if small_group_id.is_none() {
        items.push(json!({
            "key": format!("{prefix}|new-small-group"),
            "label": "新建小分组"
        }));
    }
    items.extend([
        json!({
            "key": format!("{prefix}|rename"),
            "label": "重命名"
        }),
        json!({ "type": "divider" }),
    ]);
    // 一级分组入口统一清理其已加载的数据空间；小分组菜单保留新增、重命名和删除布局。
    if small_group_id.is_none() {
        items.extend([
            json!({
                "key": format!("{prefix}|clear-data"),
                "label": "清除此组的浏览数据"
            }),
            json!({ "type": "divider" }),
        ]);
    }
    items.push(json!({
        "key": format!("{prefix}|delete"),
        "label": if small_group_id.is_some() {
            "删除小分组"
        } else {
            "删除标签组"
        },
        "danger": true
    }));
    let height = if small_group_id.is_some() {
        160.0
    } else {
        252.0
    };
    floating_windows::show_menu(
        &app,
        &menu_store,
        json!({ "darkMode": dark_mode, "items": items }),
        source_window,
        floating_windows::FloatingWindowBounds {
            x,
            y,
            width: 286.0,
            height,
        },
    )
}

#[tauri::command]
fn clear_browser_tabs_data(app: AppHandle, tab_ids: Vec<String>) -> Result<(), String> {
    // 一个大分组现在可能包含多个独立数据空间，必须遍历所有目标标签，不能清理首个后退出。
    for tab_id in tab_ids {
        if let Some(webview) = app.get_webview(&browser_label(&tab_id)) {
            webview
                .clear_all_browsing_data()
                .map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn load_browser_state(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let path = browser_state_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|error| format!("无法读取浏览器状态文件 {}：{error}", path.display()))?;
    serde_json::from_str(&content)
        .map(Some)
        .map_err(|error| format!("浏览器状态文件格式错误 {}：{error}", path.display()))
}

#[tauri::command]
fn save_browser_state(app: AppHandle, state: serde_json::Value) -> Result<(), String> {
    let path = browser_state_path(&app)?;
    let content = serde_json::to_string_pretty(&state)
        .map_err(|error| format!("无法序列化浏览器状态：{error}"))?;
    std::fs::write(&path, content.as_bytes())
        .map_err(|error| format!("无法写入浏览器状态文件 {}：{error}", path.display()))
}

#[tauri::command]
async fn set_browser_bounds(app: AppHandle, bounds: BrowserBounds) -> Result<(), String> {
    eprintln!(
        "[browser-view] bounds=({}, {}, {}, {})",
        bounds.x, bounds.y, bounds.width, bounds.height
    );
    let bounds = logical_rect(bounds);
    for (label, webview) in app.webviews() {
        if label.starts_with(BROWSER_WEBVIEW_PREFIX) {
            webview.set_bounds(bounds).map_err(|error| {
                format!("同步网页 WebView 边界失败：label={label} error={error}")
            })?;
        }
    }
    Ok(())
}

#[tauri::command]
fn browser_page_action(app: AppHandle, tab_id: String, action: String) -> Result<(), String> {
    let webview = app
        .get_webview(&browser_label(&tab_id))
        .ok_or_else(|| "当前标签页还没有打开网页".to_string())?;

    #[cfg(windows)]
    if action == "reload-clear-cache" {
        webview
            .with_webview(move |platform_webview| {
                let result = (|| -> windows::core::Result<()> {
                    let core_webview: ICoreWebView2 =
                        unsafe { platform_webview.controller().CoreWebView2()? };
                    let reload_webview = core_webview.clone();
                    let handler = CallDevToolsProtocolMethodCompletedHandler::create(Box::new(
                        move |_error, _result| unsafe { reload_webview.Reload() },
                    ));
                    let method = "Network.clearBrowserCache"
                        .encode_utf16()
                        .chain(std::iter::once(0))
                        .collect::<Vec<_>>();
                    let parameters = "{}"
                        .encode_utf16()
                        .chain(std::iter::once(0))
                        .collect::<Vec<_>>();
                    unsafe {
                        core_webview.CallDevToolsProtocolMethod(
                            PCWSTR::from_raw(method.as_ptr()),
                            PCWSTR::from_raw(parameters.as_ptr()),
                            &handler,
                        )
                    }
                })();
                if let Err(error) = result {
                    eprintln!("清空网页缓存并硬刷新失败：{error}");
                }
            })
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    match action.as_str() {
        "back" => webview.eval("history.back()"),
        "forward" => webview.eval("history.forward()"),
        "reload" => webview.reload(),
        "reload-hard" => webview.eval("location.reload()"),
        #[cfg(not(windows))]
        "reload-clear-cache" => webview.reload(),
        action if action.starts_with("history-go:") => {
            let offset = action
                .trim_start_matches("history-go:")
                .parse::<i32>()
                .map_err(|_| "后退历史偏移量无效".to_string())?;
            webview.eval(&format!("history.go({offset})"))
        }
        "stop" => webview.eval("window.stop()"),
        _ => return Err(format!("未知网页操作：{action}")),
    }
    .map_err(|error| error.to_string())
}

#[cfg(windows)]
#[tauri::command]
fn get_default_download_directory(app: AppHandle) -> Result<String, String> {
    app.path()
        .download_dir()
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|error| format!("无法获取系统下载目录：{error}"))
}

#[cfg(windows)]
#[tauri::command]
fn set_download_preferences(
    state: tauri::State<'_, DownloadRuntimeState>,
    directory: String,
    ask_before_download: bool,
) -> Result<(), String> {
    let directory = PathBuf::from(directory);
    if !directory.as_os_str().is_empty() {
        std::fs::create_dir_all(&directory)
            .map_err(|error| format!("无法创建下载目录 {}：{error}", directory.display()))?;
    }
    let mut preferences = state
        .preferences
        .lock()
        .map_err(|_| "无法更新下载设置".to_string())?;
    preferences.directory = directory;
    preferences.ask_before_download = ask_before_download;
    Ok(())
}

#[cfg(windows)]
#[tauri::command]
async fn choose_download_directory(current: String) -> Result<Option<String>, String> {
    let mut dialog = rfd::AsyncFileDialog::new().set_title("选择下载文件夹");
    let current = PathBuf::from(current);
    if current.is_dir() {
        dialog = dialog.set_directory(current);
    }
    Ok(dialog
        .pick_folder()
        .await
        .map(|folder| folder.path().to_string_lossy().into_owned()))
}

#[cfg(windows)]
#[tauri::command]
async fn resolve_pending_download(
    app: AppHandle,
    state: tauri::State<'_, DownloadRuntimeState>,
    id: String,
    choice: String,
) -> Result<bool, String> {
    let metadata = state
        .pending
        .lock()
        .map_err(|_| "无法读取待处理下载".to_string())?
        .get(&id)
        .cloned()
        .ok_or_else(|| "找不到待处理的下载任务".to_string())?;
    let preferences = state
        .preferences
        .lock()
        .map_err(|_| "无法读取下载设置".to_string())?
        .clone();

    let target_path = match choice.as_str() {
        "cancel" => None,
        "open" => {
            let directory = std::env::temp_dir().join("SiaBrowser").join("downloads");
            Some(unique_download_path(&directory, &metadata.file_name)?)
        }
        "save" => {
            let directory = if preferences.directory.as_os_str().is_empty() {
                app.path()
                    .download_dir()
                    .map_err(|error| format!("无法获取系统下载目录：{error}"))?
            } else {
                preferences.directory.clone()
            };
            Some(unique_download_path(&directory, &metadata.file_name)?)
        }
        "save-as" => {
            let mut dialog = rfd::AsyncFileDialog::new()
                .set_title("另存为")
                .set_file_name(&metadata.file_name);
            if preferences.directory.is_dir() {
                dialog = dialog.set_directory(&preferences.directory);
            }
            let Some(file) = dialog.save_file().await else {
                return Ok(false);
            };
            Some(file.path().to_path_buf())
        }
        _ => return Err(format!("未知的下载处理方式：{choice}")),
    };

    let should_open = choice == "open";
    let (sender, receiver) = tokio::sync::oneshot::channel::<Result<(), String>>();
    let callback_app = app.clone();
    let callback_id = id.clone();
    app.run_on_main_thread(move || {
        let result = PENDING_DOWNLOADS.with(|pending| {
            let Some(download) = pending.borrow_mut().remove(&callback_id) else {
                return Err("找不到待处理的 WebView2 下载任务".to_string());
            };
            let action_result = (|| -> windows::core::Result<()> {
                if choice == "cancel" {
                    unsafe {
                        download.args.SetCancel(true)?;
                    }
                } else if let Some(path) = target_path.as_deref() {
                    set_download_result_path(&download.args, path)?;
                    if should_open {
                        if let Ok(mut entries) = callback_app
                            .state::<DownloadRuntimeState>()
                            .open_after_completion
                            .lock()
                        {
                            entries.insert(callback_id.clone());
                        }
                    }
                    attach_download_operation(
                        &callback_app,
                        &download.tab_id,
                        &callback_id,
                        &download.operation,
                    )?;
                }
                Ok(())
            })();
            let complete_result = unsafe { download.deferral.Complete() };
            if choice == "cancel" {
                let _ = emit_download_event(&callback_app, &download.tab_id, &callback_id, "finished", &download.operation, Some(false));
            }
            action_result
                .and(complete_result)
                .map_err(|error| format!("无法继续下载：{error}"))
        });
        let _ = sender.send(result);
    })
    .map_err(|error| format!("无法切换到浏览器主线程：{error}"))?;

    receiver
        .await
        .map_err(|_| "下载处理流程意外中断".to_string())??;
    if let Ok(mut pending) = state.pending.lock() {
        pending.remove(&id);
    }
    Ok(true)
}

#[tauri::command]
fn open_download_file(path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(path);
    if !path.is_file() {
        return Err("下载文件不存在或已被移动".to_string());
    }
    #[cfg(windows)]
    {
        return shell_execute(
            path.as_os_str(),
            None,
            "Windows 无法使用默认应用打开该文件",
        );
    }
    #[cfg(not(windows))]
    {
        Err("当前平台暂不支持打开下载文件".to_string())
    }
}

#[tauri::command]
fn show_download_in_folder(path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(path);
    if !path.exists() {
        return Err("下载文件不存在或已被移动".to_string());
    }
    #[cfg(windows)]
    {
        let mut parameters = OsString::from("/select,\"");
        parameters.push(path.as_os_str());
        parameters.push("\"");
        return shell_execute(
            OsStr::new("explorer.exe"),
            Some(parameters.as_os_str()),
            "Windows 无法在文件夹中定位该下载文件",
        );
    }
    #[cfg(not(windows))]
    {
        Err("当前平台暂不支持在文件夹中显示下载文件".to_string())
    }
}

#[tauri::command]
fn delete_download_file(path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(path);
    if !path.exists() {
        return Err("下载文件不存在或已被移动".to_string());
    }
    if !path.is_file() {
        return Err("只能删除下载记录对应的文件".to_string());
    }
    std::fs::remove_file(&path).map_err(|error| format!("无法删除下载文件：{error}"))
}

#[tauri::command]
fn open_default_browser_settings() -> Result<(), String> {
    std::process::Command::new("explorer.exe")
        .arg("ms-settings:defaultapps")
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("无法打开 Windows 默认应用设置：{error}"))
}

#[tauri::command]
fn browser_window_action(app: AppHandle, action: String) -> Result<(), String> {
    eprintln!("[window-action] {action}");
    let window = app
        .get_window("main")
        .ok_or_else(|| "找不到浏览器主窗口".to_string())?;

    if matches!(action.as_str(), "minimize" | "toggle-maximize" | "close") {
        floating_windows::close_browser_menu(app.clone())?;
    }

    match action.as_str() {
        "start-dragging" => window.start_dragging(),
        "minimize" => window.minimize(),
        "toggle-maximize" => {
            if window.is_maximized().map_err(|error| error.to_string())? {
                window.unmaximize()
            } else {
                window.maximize()
            }
        }
        "close" => window.close(),
        _ => return Err(format!("未知窗口操作：{action}")),
    }
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn current_window_label(window: tauri::Window) -> String {
    window.label().to_string()
}

/// 查询主窗口是否为活动窗口；网页子视图之间切换焦点不会误判为浏览器失活。
#[tauri::command]
fn is_browser_window_active(app: AppHandle) -> Result<bool, String> {
    let window = app.get_window("main").ok_or("找不到浏览器主窗口")?;
    #[cfg(windows)]
    {
        let hwnd = window.hwnd().map_err(|error| error.to_string())?;
        Ok(unsafe { windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow() } == hwnd)
    }
    #[cfg(not(windows))]
    window.is_focused().map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 只有显式诊断参数才切换到临时资料目录，正常启动保持原有数据路径。
    let mut context = tauri::generate_context!();
    startup_diagnostics::configure(&mut context).expect("配置启动诊断目录失败");
    // 主窗口在 tauri.conf.json 中关闭系统阴影，窗口边界由 Sia WindowFrame 的细边框呈现。
    tauri::Builder::default()
        .manage(browser_startup::BrowserStartup::default())
        .manage(browser_overlay::BrowserOverlayStore::default())
        .manage(floating_windows::TabPanelStore::default())
        .manage(floating_windows::BrowserMenuStore::default())
        .manage(floating_windows::TabTooltipStore::default())
        .manage(DownloadRuntimeState::default())
        .manage(BrowserProfileStore::default())
        .manage(browser_visibility::BrowserVisibility::default())
        .manage(browser_theme::BrowserThemeStore::default())
        .manage(extension_runtime::ExtensionOperationLock::default())
        .manage(extensions::ExtensionScopeStore::default())
        .manage(passwords::PasswordThemeStore::default())
        .setup(|app| {
            // 先建立原生缩放边缘，再创建可能覆盖窗口四边的标签和辅助 WebView。
            let main = app.get_window("main").ok_or("找不到浏览器主窗口")?;
            window_resize::initialize(&main)?;
            if let Ok(directory) = app.path().download_dir() {
                if let Ok(mut preferences) = app.state::<DownloadRuntimeState>().preferences.lock()
                {
                    preferences.directory = directory;
                }
            }
            // WebView2 初始化会泵送 IPC；辅助视图建好后才允许主界面启动。
            let result = browser_overlay::initialize(app.handle())
                .and_then(|()| floating_windows::initialize(app.handle()));
            app.state::<browser_startup::BrowserStartup>().finish(result);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            browser_startup::wait_browser_ready,
            open_browser_tab,
            switch_browser_tab,
            hide_browser_pages,
            close_browser_tab,
            open_browser_devtools,
            set_browser_tab_muted,
            show_browser_more_menu,
            show_browser_panel,
            show_browser_tab_menu,
            show_browser_tree_menu,
            clear_browser_tabs_data,
            load_browser_state,
            save_browser_state,
            set_browser_bounds,
            browser_page_action,
            get_default_download_directory,
            set_download_preferences,
            choose_download_directory,
            resolve_pending_download,
            open_download_file,
            show_download_in_folder,
            delete_download_file,
            open_default_browser_settings,
            browser_window_action,
            current_window_label,
            is_browser_window_active,
            browser_overlay::open_browser_overlay,
            browser_overlay::get_browser_overlay_state,
            browser_overlay::close_browser_overlay,
            browser_overlay::browser_overlay_action,
            floating_windows::open_floating_tab_panel,
            floating_windows::update_floating_tab_panel,
            floating_windows::get_floating_tab_panel_state,
            floating_windows::close_floating_tab_panel,
            floating_windows::close_floating_tab_panel_if_pointer_outside,
            floating_windows::floating_tab_panel_action,
            floating_windows::get_browser_menu_state,
            // 菜单透明留白不参与原生命中，范围由可见面板和子菜单同步。
            floating_windows::update_browser_menu_regions,
            floating_windows::show_browser_tab_tooltip,
            floating_windows::present_browser_tab_tooltip,
            floating_windows::close_browser_tab_tooltip,
            floating_windows::get_browser_tab_tooltip_state,
            floating_windows::close_browser_menu,
            floating_windows::browser_menu_action,
            passwords::list_browser_passwords,
            passwords::set_browser_password_theme,
            browser_theme::set_browser_theme,
            passwords::get_browser_password,
            passwords::save_browser_password,
            passwords::delete_browser_password,
            passwords::import_browser_passwords,
            extensions::list_browser_extensions,
            extensions::set_browser_extension_pinned,
            extensions::set_browser_extension_scopes,
            extensions::update_browser_extension_context,
            extensions::scan_browser_extensions,
            extensions::pick_browser_extension_folder,
            extensions::install_browser_extension,
            extensions::set_browser_extension_enabled,
            extensions::resolve_browser_extension_id,
            extensions::remove_browser_extension,
        ])
        .run(context)
        .expect("启动 西娅浏览器 失败");
}
