//! 前端 IPC 可能在 WebView2 的初始化消息泵中到达；异步屏障避免重入创建原生视图。

pub struct BrowserStartup(tokio::sync::watch::Sender<Option<Result<(), String>>>);

impl Default for BrowserStartup {
    fn default() -> Self {
        Self(tokio::sync::watch::channel(None).0)
    }
}

impl BrowserStartup {
    /// 预加载完成后发布结果，保留错误供之后到达的窗口读取。
    pub fn finish(&self, result: Result<(), String>) {
        self.0.send_replace(Some(result));
    }

    /// 等待原生初始化完成，不占用 UI 线程，也不持有 WebView 上下文锁。
    pub async fn wait(&self) -> Result<(), String> {
        let mut receiver = self.0.subscribe();
        loop {
            if let Some(result) = receiver.borrow_and_update().clone() {
                return result;
            }
            receiver.changed().await.map_err(|_| "浏览器初始化通道已关闭")?;
        }
    }
}

/// 前端挂载应用前调用；初始化失败会拒绝 Promise，由壳层呈现错误信息。
#[tauri::command]
pub async fn wait_browser_ready(state: crate::window_context::WindowState<BrowserStartup>) -> Result<(), String> {
    state.wait().await
}
