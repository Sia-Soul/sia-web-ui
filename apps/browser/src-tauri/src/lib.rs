mod browser_overlay;
mod floating_windows;
mod passwords;

use passwords::{attach_password_bridge, PASSWORD_AUTOFILL_SCRIPT};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{
    webview::{NewWindowResponse, PageLoadEvent, WebviewBuilder},
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Position, Rect, Size, WebviewUrl,
};
#[cfg(windows)]
use webview2_com::{
    IsDocumentPlayingAudioChangedEventHandler,
    Microsoft::Web::WebView2::Win32::{ICoreWebView2, ICoreWebView2_8},
};
#[cfg(windows)]
use windows::core::{Interface, BOOL};

const BROWSER_WEBVIEW_PREFIX: &str = "browser-tab-";
const BROWSER_STATE_FILE: &str = "browser-state.json";

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

fn browser_group_data_directory(
    app: &AppHandle,
    group_id: &str,
) -> Result<std::path::PathBuf, String> {
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?
        .join("browser-profiles")
        .join(sanitize_identifier(group_id));
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
        "http" | "https" => Ok(url),
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
                    core_webview
                        .Settings()?
                        .SetAreDefaultContextMenusEnabled(false)?;
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
    for (label, webview) in app.webviews() {
        if label.starts_with(BROWSER_WEBVIEW_PREFIX) && Some(label.as_str()) != except_label {
            eprintln!("[browser-view] hide label={label}");
            webview.hide().map_err(|error| error.to_string())?;
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
    url: String,
    bounds: BrowserBounds,
) -> Result<(), String> {
    let parsed_url = parse_browser_url(&url)?;
    let label = browser_label(&tab_id);
    eprintln!(
        "[browser-view] open tab={tab_id} label={label} bounds=({}, {}, {}, {})",
        bounds.x, bounds.y, bounds.width, bounds.height
    );
    hide_browser_webviews(&app, Some(&label))?;

    if let Some(webview) = app.get_webview(&label) {
        eprintln!("[browser-view] reuse label={label}");
        webview
            .set_bounds(logical_rect(bounds))
            .map_err(|error| error.to_string())?;
        webview
            .navigate(parsed_url)
            .map_err(|error| error.to_string())?;
        webview.show().map_err(|error| error.to_string())?;
        webview.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }

    let window = app
        .get_window("main")
        .ok_or_else(|| "找不到浏览器主窗口".to_string())?;
    let data_directory = browser_group_data_directory(&app, &group_id)?;

    let page_event_app = app.clone();
    let page_event_tab_id = tab_id.clone();
    let page_event_group_id = group_id.clone();
    let title_event_app = app.clone();
    let title_event_tab_id = tab_id.clone();
    let title_event_group_id = group_id.clone();
    let new_window_app = app.clone();
    let new_window_tab_id = tab_id.clone();
    let new_window_group_id = group_id.clone();

    let builder = WebviewBuilder::new(label, WebviewUrl::External(parsed_url))
        .data_directory(data_directory)
        .initialization_script(PASSWORD_AUTOFILL_SCRIPT)
        .zoom_hotkeys_enabled(true)
        .on_navigation(|next_url| {
            matches!(
                next_url.scheme(),
                "http" | "https" | "about" | "data" | "blob"
            )
        })
        .on_page_load(move |_webview, payload| {
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
    webview.set_focus().map_err(|error| error.to_string())?;

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
    bounds: BrowserBounds,
) -> Result<bool, String> {
    let label = browser_label(&tab_id);
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
        webview.show().map_err(|error| error.to_string())?;
        webview.set_focus().map_err(|error| error.to_string())?;
        Ok(true)
    } else {
        eprintln!("[browser-view] missing label={label}");
        Ok(false)
    }
}

#[tauri::command]
fn close_browser_tab(app: AppHandle, tab_id: String) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&browser_label(&tab_id)) {
        // 先隐藏再销毁，确保“主页”和关闭标签操作不会因 WebView2 延迟销毁而残留旧网页。
        webview.hide().map_err(|error| error.to_string())?;
        webview.close().map_err(|error| error.to_string())?;
    }
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
fn show_browser_more_menu(
    app: AppHandle,
    menu_store: tauri::State<'_, floating_windows::BrowserMenuStore>,
    tab_layout: String,
    show_bookmarks_bar: bool,
    dark_mode: bool,
    source_window: String,
    x: f64,
    y: f64,
) -> Result<(), String> {
    eprintln!("[browser-menu] show more x={x} y={y}");
    if floating_windows::menu_is_visible(&app) {
        return floating_windows::close_browser_menu(app);
    }
    let layout_label = if tab_layout == "vertical" {
        "切换到横向标签"
    } else {
        "切换到垂直标签"
    };
    let payload = json!({
        "darkMode": dark_mode,
        "items": [
            { "key": "more:tab-layout", "label": layout_label },
            { "type": "divider" },
            { "key": "more:bookmarks", "label": "书签" },
            {
                "key": "more:bookmark-bar",
                "label": "显示书签栏",
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
            width: 276.0,
            height: 354.0,
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
        json!({
            "key": format!("{prefix}|clear-data"),
            "label": if small_group_id.is_some() {
                "清除此小分组的浏览数据"
            } else {
                "清除此组的浏览数据"
            }
        }),
        json!({ "type": "divider" }),
        json!({
            "key": format!("{prefix}|delete"),
            "label": if small_group_id.is_some() {
                "删除小分组"
            } else {
                "删除标签组"
            },
            "danger": true
        }),
    ]);
    let height = if small_group_id.is_some() {
        214.0
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
    for tab_id in tab_ids {
        if let Some(webview) = app.get_webview(&browser_label(&tab_id)) {
            webview
                .clear_all_browsing_data()
                .map_err(|error| error.to_string())?;
            break;
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

    match action.as_str() {
        "back" => webview.eval("history.back()"),
        "forward" => webview.eval("history.forward()"),
        "reload" => webview.reload(),
        "stop" => webview.eval("window.stop()"),
        _ => return Err(format!("未知网页操作：{action}")),
    }
    .map_err(|error| error.to_string())
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(browser_overlay::BrowserOverlayStore::default())
        .manage(floating_windows::TabPanelStore::default())
        .manage(floating_windows::BrowserMenuStore::default())
        .setup(|app| {
            if let Err(error) = browser_overlay::initialize(app.handle()) {
                eprintln!("无法预加载浏览器模态窗口：{error}");
            }
            if let Err(error) = floating_windows::initialize(app.handle()) {
                eprintln!("无法预加载浏览器浮动窗口：{error}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_browser_tab,
            switch_browser_tab,
            hide_browser_pages,
            close_browser_tab,
            set_browser_tab_muted,
            show_browser_more_menu,
            show_browser_tab_menu,
            show_browser_tree_menu,
            clear_browser_tabs_data,
            load_browser_state,
            save_browser_state,
            set_browser_bounds,
            browser_page_action,
            browser_window_action,
            current_window_label,
            browser_overlay::open_browser_overlay,
            browser_overlay::get_browser_overlay_state,
            browser_overlay::close_browser_overlay,
            browser_overlay::browser_overlay_action,
            floating_windows::open_floating_tab_panel,
            floating_windows::update_floating_tab_panel,
            floating_windows::get_floating_tab_panel_state,
            floating_windows::close_floating_tab_panel,
            floating_windows::floating_tab_panel_action,
            floating_windows::get_browser_menu_state,
            floating_windows::close_browser_menu,
            floating_windows::browser_menu_action,
            passwords::list_browser_passwords,
            passwords::get_browser_password,
            passwords::save_browser_password,
            passwords::delete_browser_password,
            passwords::import_browser_passwords,
        ])
        .run(tauri::generate_context!())
        .expect("启动 Sia Browser 失败");
}
