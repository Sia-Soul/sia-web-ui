//! 将后续启动请求交给已有窗口；队列在界面恢复完成前保留请求，避免启动阶段丢失网页。

use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

fn receiver_window(app: &AppHandle) -> Option<tauri::Window> {
    app.get_window("main").or_else(|| {
        let mut windows: Vec<_> = app.windows().into_iter().filter(|(label, _)| label.starts_with("sia-window-") && !label.contains("--")).collect();
        windows.sort_by(|a,b|a.0.cmp(&b.0));
        windows.into_iter().next().map(|(_, window)|window)
    })
}

/// 每次外部打开都有独立编号，相同网址连续打开也保留为两次操作。
#[derive(Clone, serde::Serialize)]
pub struct OpenRequest {
    /// 当前进程内递增的请求编号，用于界面确认接收。
    id: u64,
    /// 已通过系统打开入口校验的网址或本地 HTML 文件地址。
    url: String,
}

/// 主界面确认前不删除请求；事件只负责通知，不承担保存请求的责任。
#[derive(Default)]
pub struct BrowserInstance(Mutex<PendingRequests>);

#[derive(Default)]
struct PendingRequests {
    next_id: u64,
    requests: Vec<OpenRequest>,
}

impl PendingRequests {
    /// 保持每次打开的独立身份，允许相同网页再次打开。
    fn push(&mut self, url: String) {
        self.next_id += 1;
        self.requests.push(OpenRequest { id: self.next_id, url });
    }

    /// 只清除已接收的编号，不影响读取之后新到达的请求。
    fn acknowledge(&mut self, ids: &[u64]) {
        self.requests.retain(|request| !ids.contains(&request.id));
    }
}

/// 单实例回调不阻塞 Windows 消息处理；文件校验与窗口唤醒交给异步任务执行。
pub fn forward(app: &AppHandle, args: Vec<String>, cwd: String) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Some(url) = crate::default_browser::launch_url_from(&args, std::path::Path::new(&cwd)) {
            if let Ok(mut pending) = app.state::<BrowserInstance>().0.lock() {
                pending.push(url);
            }
            if let Some(window) = receiver_window(&app) { let _ = app.emit_to(tauri::EventTarget::webview(window.label()), "sia://external-open-pending", ()); }
        }
        // 即使再次点击快捷方式没有携带网址，也恢复并激活已有窗口。
        if let Some(window) = receiver_window(&app) {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
    });
}

/// 界面完成会话恢复并注册通知后读取待办；读取本身不删除数据。
#[tauri::command]
pub fn pending_browser_opens(app: crate::window_context::BrowserContext, state: State<'_, BrowserInstance>) -> Result<Vec<OpenRequest>, String> {
    if !receiver_window(app.raw()).is_some_and(|window| window.label() == app.owner()) { return Ok(Vec::new()); }
    state.0.lock().map(|pending| pending.requests.clone()).map_err(|error| error.to_string())
}

/// 界面已创建标签后确认编号，防止异步监听取消时吞掉启动请求。
#[tauri::command]
pub fn acknowledge_browser_opens(state: State<'_, BrowserInstance>, ids: Vec<u64>) -> Result<(), String> {
    state.0.lock().map(|mut pending| pending.acknowledge(&ids)).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 检查初始化期间积压、重复网址及读取后新增请求都不会被误删。
    #[test]
    fn pending_requests_survive_reads_and_acknowledge_only_received_ids() {
        let mut pending = PendingRequests::default();
        pending.push("https://example.com/".into());
        pending.push("https://example.com/".into());
        let batch = pending.requests.clone();
        assert_eq!(pending.requests.len(), 2);
        assert_ne!(batch[0].id, batch[1].id);
        pending.push("https://example.com/new".into());
        pending.acknowledge(&batch.iter().map(|request| request.id).collect::<Vec<_>>());
        assert_eq!(pending.requests.len(), 1);
        assert_eq!(pending.requests[0].url, "https://example.com/new");
        pending.acknowledge(&[batch[0].id]);
        assert_eq!(pending.requests.len(), 1);
    }
}
