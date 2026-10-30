//! 网页菜单沿用内核命令，用框架浮层绘制；COM 请求只在窗口线程保留到选择或取消。
use crate::{floating_windows::{self, BrowserMenuStore, FloatingWindowBounds}, window_context::BrowserContext};
use serde_json::{json, Value};
use std::{cell::RefCell, collections::{HashMap, HashSet}, rc::Rc, sync::atomic::{AtomicU64, Ordering}};
use tauri::Manager;
use webview2_com::{CoTaskMemPWSTR, Microsoft::Web::WebView2::Win32::*};
use windows::core::{BOOL, PWSTR};

static NEXT_REQUEST: AtomicU64 = AtomicU64::new(1);
struct Session {
    id: u64,
    view_label: String,
    args: ICoreWebView2ContextMenuRequestedEventArgs,
    deferral: ICoreWebView2Deferral,
    commands: HashSet<i32>,
}
impl Drop for Session {
    fn drop(&mut self) {
        // 无选择时同样结束延迟，不能让内核一直等待已关闭的浮层。
        unsafe { let _ = self.deferral.Complete(); }
    }
}
thread_local! {
    static SESSIONS: RefCell<HashMap<String, Session>> = RefCell::new(HashMap::new());
}

/// 取消当前窗口的网页菜单；调用可以来自 IPC 线程，COM 释放统一投递到 UI 线程。
pub fn cancel(app: &BrowserContext, request: Option<u64>) {
    let Some(request) = request else { return; };
    let owner = app.owner().to_string();
    let _ = app.run_on_main_thread(move || {
        let removed = SESSIONS.with(|sessions| {
            let mut sessions = sessions.borrow_mut();
            if sessions.get(&owner).is_some_and(|s| s.id == request) { sessions.remove(&owner) } else { None }
        });
        drop(removed);
    });
}

/// 导航或关闭网页时撤销它的菜单，旧菜单不能操作新文档或延长已关闭网页的生命周期。
pub fn dismiss_view(app: &tauri::AppHandle, label: String) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        let owners = SESSIONS.with(|sessions| sessions.borrow().iter()
            .filter(|(_, session)| session.view_label == label).map(|(owner, _)| owner.clone()).collect::<Vec<_>>());
        for owner in owners {
            let _ = floating_windows::close_browser_menu(BrowserContext::new(&handle, &owner));
        }
    });
}

/// 移除 Windows 助记符标记，双 && 仍表示一个可见的 &。
fn display_label(label: &str) -> String {
    // 中文原生标签常带“(&R)”后缀；自绘菜单不显示原生助记符提示。
    let mut label = label.to_owned();
    for key in ('A'..='Z').chain('a'..='z') { label = label.replace(&format!("(&{key})"), ""); }
    let mut chars = label.chars().peekable();
    let mut result = String::new();
    while let Some(ch) = chars.next() {
        if ch != '&' { result.push(ch); }
        else if chars.peek() == Some(&'&') { result.push('&'); chars.next(); }
    }
    result
}

/// 递归保留链接、图片、编辑、扩展及框架菜单；只允许实际可用的叶子命令被执行。
unsafe fn items(collection: ICoreWebView2ContextMenuItemCollection, request: u64, commands: &mut HashSet<i32>, depth: usize) -> windows::core::Result<Vec<Value>> {
    if depth > 16 { return Ok(Vec::new()); }
    let mut count = 0;
    collection.Count(&mut count)?;
    let mut result = Vec::new();
    for index in 0..count {
        let item = collection.GetValueAtIndex(index)?;
        let mut kind = COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_COMMAND;
        item.Kind(&mut kind)?;
        if kind == COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_SEPARATOR {
            result.push(json!({"type":"divider"})); continue;
        }
        let (mut id, mut enabled, mut checked) = (0, BOOL(0), BOOL(0));
        item.CommandId(&mut id)?;
        item.IsEnabled(&mut enabled)?;
        item.IsChecked(&mut checked)?;
        let mut text = PWSTR::null();
        item.Label(&mut text)?;
        let label = display_label(&CoTaskMemPWSTR::from(text).to_string());
        let mut shortcut = PWSTR::null();
        item.ShortcutKeyDescription(&mut shortcut)?;
        let shortcut = CoTaskMemPWSTR::from(shortcut).to_string();
        let mut value = json!({"key":format!("web-context|{request}|{id}"),"label":label,"disabled":!enabled.as_bool(),"shortcut":shortcut});
        if kind == COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_SUBMENU {
            let mut children_commands = HashSet::new();
            value["children"] = json!(items(item.Children()?, request, &mut children_commands, depth + 1)?);
            if enabled.as_bool() { commands.extend(children_commands); }
        } else if enabled.as_bool() { commands.insert(id); }
        if kind == COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_CHECK_BOX || kind == COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_RADIO {
            value["checked"] = json!(checked.as_bool());
        }
        // 图标流来自内核，不请求扩展或站点 URL；只接受有大小限制的 PNG。
        if let Ok(icon) = crate::browser_favicon::png_data_url(item.Icon().ok()) {
            if !icon.is_empty() { value["iconDataUrl"] = json!(icon); }
        }
        result.push(value);
    }
    Ok(result)
}

/// 在事件发生的 UI 线程创建展示回调；每次重新解析标签归属，支持跨窗口迁移。
pub fn presenter(app: tauri::AppHandle, label: String) -> crate::browser_frame_menu::MenuPresenter {
    Rc::new(move |args, deferral| {
        let id = NEXT_REQUEST.fetch_add(1, Ordering::Relaxed);
        let mut session = Session { id, view_label: label.clone(), args, deferral, commands: HashSet::new() };
        let result: Result<(), String> = (|| unsafe {
            let view = app.get_webview(&label).ok_or("网页已关闭")?;
            let context = BrowserContext::new(&app, view.window().label());
            let entries = items(session.args.MenuItems().map_err(|e| e.to_string())?, id, &mut session.commands, 0).map_err(|e| e.to_string())?;
            let mut point = windows::Win32::Foundation::POINT::default();
            session.args.Location(&mut point).map_err(|e| e.to_string())?;
            let scale = view.window().scale_factor().map_err(|e| e.to_string())?;
            // Location 是 WebView 客户区坐标；按窗口缩放转为浮层使用的逻辑像素。
            let height = (14.0 + entries.iter().map(|item| if item["type"] == "divider" { 9.0 } else { 40.0 }).sum::<f64>()).min(640.0);
            let bounds = FloatingWindowBounds { x: point.x as f64 / scale, y: point.y as f64 / scale, width: 286.0, height };
            session.args.SetHandled(true).map_err(|e| e.to_string())?;
            floating_windows::show_menu(&context, &context.window_state::<BrowserMenuStore>(),
                json!({"kind":"web-context","nativeRequestId":id,"darkMode":crate::browser_theme::is_dark(&app),"items":entries}), label.clone(), bounds)?;
            // show_menu 先取消旧会话，再登记本次；完成句柄在浮层关闭或命令选择时释放。
            let old = SESSIONS.with(|sessions| sessions.borrow_mut().insert(context.owner().to_string(), session));
            drop(old);
            Ok(())
        })();
        if let Err(error) = result { eprintln!("无法显示网页右键菜单：{error}"); }
    })
}

/// 选择校验过的当前命令后交回内核，保留内核和扩展原有的执行语义。
pub fn select(app: &BrowserContext, action: &str) -> bool {
    let Some(rest) = action.strip_prefix("web-context|") else { return false; };
    let Some((request, command)) = rest.split_once('|') else { return true; };
    let (Ok(request), Ok(command)) = (request.parse::<u64>(), command.parse::<i32>()) else { return true; };
    let context = app.clone();
    let _ = app.run_on_main_thread(move || {
        let session = SESSIONS.with(|sessions| {
            let mut sessions = sessions.borrow_mut();
            if sessions.get(context.owner()).is_some_and(|s| s.id == request && s.commands.contains(&command)) {
                sessions.remove(context.owner())
            } else { None }
        });
        if let Some(session) = session {
            let _ = floating_windows::close_browser_menu(context);
            unsafe { let _ = session.args.SetSelectedCommandId(command); }
            drop(session);
        }
    });
    true
}

#[cfg(test)]
mod tests {
    #[test]
    fn native_mnemonic_preserves_literal_ampersand() {
        assert_eq!(super::display_label("复制(&C)"), "复制");
        assert_eq!(super::display_label("Save && &copy"), "Save & copy");
    }
}
