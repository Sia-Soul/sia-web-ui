//! 按 WebView2 导航编号关联开始和结束，防止旧请求取消事件覆盖新的地址与加载状态。
use crate::{emit_browser_event, AppHandle, BrowserEvent};
use tauri::Manager;
use std::{collections::HashMap, rc::Rc, sync::{Arc, Mutex}};
use webview2_com::{CoTaskMemPWSTR, NavigationStartingEventHandler, NavigationCompletedEventHandler, ContentLoadingEventHandler, SourceChangedEventHandler};
use windows::core::{BOOL, PWSTR};

/// 同一编号可因重定向更新目标地址；仅当前编号能够结束加载。
#[derive(Default)]
struct Navigation {
    current: Option<(u64, String)>,
    loading: bool,
    /// 只有收到 ContentLoading 才视为新文档，附件响应不会设置该标记。
    committed: bool,
    /// 外壳已提交替代请求，内核尚未发出该请求的开始事件。
    awaiting_start: bool,
}

impl Navigation {
    /// 在发起网络请求时立即登记目标，不能等待 ContentLoading 才显示加载状态。
    fn start(&mut self, id: u64, url: String) {
        if self.current.as_ref().map(|current| current.0) != Some(id) { self.committed = false; }
        self.current = Some((id, url));
        self.loading = true;
        self.awaiting_start = false;
    }

    /// 忽略已经被后续导航替代的结束事件，并保留失败导航的目标地址。
    fn finish(&mut self, id: u64) -> Option<String> {
        let (current, url) = self.current.as_ref()?;
        if self.awaiting_start || *current != id { return None; }
        self.loading = false;
        Some(url.clone())
    }
}

/// 仅保存导航元数据，不持有 COM 句柄；视图销毁后移除记录。
#[derive(Default)]
pub struct States(Mutex<HashMap<String, Arc<Mutex<Navigation>>>>);

/// 提交替代导航前屏蔽旧完成事件，覆盖旧取消先于新开始事件到达的顺序。
pub fn prepare(app: &AppHandle, tab_id: &str) {
    let state = app.state::<States>().0.lock().unwrap_or_else(|e| e.into_inner()).get(tab_id).cloned();
    if let Some(state) = state { state.lock().unwrap_or_else(|e| e.into_inner()).awaiting_start = true; }
}

/// 视图真正关闭后释放该标签的导航元数据。
pub fn forget(app: &AppHandle, tab_id: &str) {
    app.state::<States>().0.lock().unwrap_or_else(|e| e.into_inner()).remove(tab_id);
}

/// 首次导航前安装一次监听；回调只读事件参数，不同步等待或销毁 WebView。
pub async fn attach(app: &AppHandle, view: &tauri::Webview, tab_id: String, group_id: String) -> Result<(), String> {
    let (send, receive) = tokio::sync::oneshot::channel();
    let app = app.clone();
    view.with_webview(move |view| {
        let setup = (|| -> windows::core::Result<()> {
            let core = unsafe { view.controller().CoreWebView2()? };
            let navigation = Arc::new(Mutex::new(Navigation::default()));
            app.state::<States>().0.lock().unwrap_or_else(|e| e.into_inner()).insert(tab_id.clone(), navigation.clone());
            let emit = Rc::new(move |url: String, loading: Option<bool>, cancelled: bool| {
                emit_browser_event(&app, BrowserEvent {
                    tab_id: tab_id.clone(), group_id: group_id.clone(),
                    kind: if cancelled { "navigation-ended" } else if loading.is_some() { "load" } else { "location" },
                    url: Some(url), title: None, loading, audible: None, muted: None, message: None,
                });
            });
            let start_state = navigation.clone();
            let start_emit = emit.clone();
            let starting = NavigationStartingEventHandler::create(Box::new(move |_, args| {
                if let Some(args) = args {
                    let mut id = 0;
                    let mut raw = PWSTR::null();
                    let mut cancelled = BOOL(0);
                    unsafe { args.NavigationId(&mut id)?; args.Uri(&mut raw)?; args.Cancel(&mut cancelled)?; }
                    let url = CoTaskMemPWSTR::from(raw).to_string();
                    // 初始空白页与协议策略拒绝的导航不属于可展示的网页导航。
                    if url == "about:blank" || cancelled.as_bool() { return Ok(()); }
                    start_state.lock().unwrap_or_else(|e| e.into_inner()).start(id, url.clone());
                    start_emit(url, Some(true), false);
                }
                Ok(())
            }));
            let content_state = navigation.clone();
            let content = ContentLoadingEventHandler::create(Box::new(move |_, args| {
                if let Some(args) = args {
                    let mut id = 0;
                    unsafe { args.NavigationId(&mut id)?; }
                    let mut state = content_state.lock().unwrap_or_else(|e| e.into_inner());
                    if state.current.as_ref().map(|current| current.0) == Some(id) { state.committed = true; }
                }
                Ok(())
            }));
            let finish_state = navigation.clone();
            let finish_emit = emit.clone();
            let completed = NavigationCompletedEventHandler::create(Box::new(move |_, args| {
                if let Some(args) = args {
                    let mut id = 0;
                    unsafe { args.NavigationId(&mut id)?; }
                    let (url, committed) = {
                        let mut state = finish_state.lock().unwrap_or_else(|e| e.into_inner());
                        (state.finish(id), state.committed)
                    };
                    // 当前 Source 可能仍是旧文档，必须采用该编号在开始事件中记录的地址。
                    if let Some(url) = url {
                        // 附件也会先结束导航，不能用结束事件或错误码推断文档已加载。
                        finish_emit(url, Some(false), !committed);
                    }
                }
                Ok(())
            }));
            let changed = SourceChangedEventHandler::create(Box::new(move |sender, args| {
                if let (Some(core), Some(args)) = (sender, args) {
                    let mut new_document = BOOL(0);
                    unsafe { args.IsNewDocument(&mut new_document)?; }
                    // hash/history 同文档跳转没有新的导航编号，也不应显示网络加载动画。
                    if !new_document.as_bool() && !navigation.lock().unwrap_or_else(|e| e.into_inner()).loading {
                        let mut raw = PWSTR::null();
                        unsafe { core.Source(&mut raw)?; }
                        let url = CoTaskMemPWSTR::from(raw).to_string();
                        if url != "about:blank" { emit(url, None, false); }
                    }
                }
                Ok(())
            }));
            unsafe {
                let mut token = 0;
                core.add_NavigationStarting(&starting, &mut token)?;
                core.add_ContentLoading(&content, &mut token)?;
                core.add_NavigationCompleted(&completed, &mut token)?;
                core.add_SourceChanged(&changed, &mut token)?;
            }
            Ok(())
        })();
        let _ = send.send(setup.map_err(|error| error.to_string()));
    }).map_err(|error| error.to_string())?;
    receive.await.map_err(|_| "导航监听初始化中断".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn superseded_completion_cannot_reset_new_navigation() {
        let mut state = Navigation::default();
        state.start(1, "https://old.test/".into());
        state.start(2, "https://new.test/".into());
        assert_eq!(state.finish(1), None);
        assert!(state.loading);
        assert_eq!(state.finish(2).as_deref(), Some("https://new.test/"));
        assert!(!state.loading);
    }

    #[test]
    fn cancellation_before_replacement_start_is_ignored() {
        let mut state = Navigation::default();
        state.start(1, "https://old.test/".into());
        state.awaiting_start = true;
        assert_eq!(state.finish(1), None);
        state.start(2, "https://new.test/".into());
        assert!(state.loading);
        assert_eq!(state.finish(2).as_deref(), Some("https://new.test/"));
    }

    #[test]
    fn redirect_and_failed_navigation_keep_the_latest_target() {
        let mut state = Navigation::default();
        state.start(3, "https://start.test/".into());
        state.start(3, "https://redirect.test/".into());
        assert_eq!(state.finish(3).as_deref(), Some("https://redirect.test/"));
    }
}
