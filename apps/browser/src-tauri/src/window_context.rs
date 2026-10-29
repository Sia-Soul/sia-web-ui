//! 从 IPC 调用方解析浏览器窗口；辅助视图和状态按窗口隔离，网页实例保持全局唯一。
use serde::Serialize;
use std::{
    any::{Any, TypeId},
    collections::HashMap,
    ops::Deref,
    sync::{Arc, Mutex},
};
use tauri::{
    ipc::{CommandArg, CommandItem, InvokeError},
    AppHandle, Emitter, Manager, Webview, WebviewWindow, Window, Wry,
};

#[derive(Default)]
pub struct WindowStates(Mutex<HashMap<(String, TypeId), Arc<dyn Any + Send + Sync>>>);

/// 由原生调用来源确定窗口，不接受前端指定归属；克隆后可安全用于异步任务。
#[derive(Clone)]
pub struct BrowserContext {
    app: AppHandle,
    owner: String,
}

pub fn owner_label(label: &str) -> &str {
    match label {
        "browser-menu" | "sia-tab-tooltip-window" | "browser-overlay" | "sia-tab-panel-window" => {
            "main"
        }
        _ => label.split_once("--").map_or(label, |(owner, _)| owner),
    }
}

impl BrowserContext {
    pub fn new(app: &AppHandle, owner: &str) -> Self {
        Self {
            app: app.clone(),
            owner: owner_label(owner).to_string(),
        }
    }
    pub fn raw(&self) -> &AppHandle {
        &self.app
    }
    pub fn owner(&self) -> &str {
        &self.owner
    }
    pub fn label(&self, label: &str) -> String {
        if label == "main" {
            self.owner.clone()
        } else if self.owner == "main"
            || label.starts_with("browser-tab-")
            || label.contains("--")
            || label == self.owner
        {
            label.to_string()
        } else {
            format!("{}--{label}", self.owner)
        }
    }
    pub fn get_window(&self, label: &str) -> Option<Window> {
        self.app.get_window(&self.label(label))
    }
    pub fn get_webview_window(&self, label: &str) -> Option<WebviewWindow> {
        self.app.get_webview_window(&self.label(label))
    }
    pub fn get_webview(&self, label: &str) -> Option<Webview> {
        self.app
            .get_webview(&self.label(label))
            .filter(|view| owner_label(view.window().label()) == self.owner)
    }
    pub fn webviews(&self) -> HashMap<String, Webview> {
        self.app
            .webviews()
            .into_iter()
            .filter(|(_, view)| owner_label(view.window().label()) == self.owner)
            .collect()
    }
    /// 回调在迁移前安装，发送时重新查询当前父窗口，避免事件返回旧窗口。
    pub fn for_tab(&self, tab_id: &str) -> Self {
        self.app
            .get_webview(&crate::browser_label(tab_id))
            .map(|view| Self::new(&self.app, view.window().label()))
            .unwrap_or_else(|| self.clone())
    }
    pub fn emit<S: Serialize + Clone>(&self, event: &str, payload: S) -> tauri::Result<()> {
        for (label, _) in self.webviews() {
            if !label.starts_with("browser-tab-") {
                self.app
                    .emit_to(tauri::EventTarget::webview(label), event, payload.clone())?;
            }
        }
        Ok(())
    }
    pub fn window_state<T: Default + Send + Sync + 'static>(&self) -> Arc<T> {
        let states = self.app.state::<WindowStates>();
        let mut states = states.0.lock().unwrap_or_else(|error| error.into_inner());
        states
            .entry((self.owner.clone(), TypeId::of::<T>()))
            .or_insert_with(|| Arc::new(T::default()))
            .clone()
            .downcast::<T>()
            .unwrap_or_else(|_| unreachable!())
    }
}
impl Deref for BrowserContext {
    type Target = AppHandle;
    fn deref(&self) -> &AppHandle {
        &self.app
    }
}
impl<'de> CommandArg<'de, Wry> for BrowserContext {
    fn from_command(command: CommandItem<'de, Wry>) -> Result<Self, InvokeError> {
        let view = command.message.webview();
        Ok(Self::new(view.app_handle(), view.window().label()))
    }
}

/// 与 Tauri State 类似，但生命周期和存储范围属于当前浏览器窗口。
pub struct WindowState<T> {
    inner: Arc<T>,
}
impl<T> Deref for WindowState<T> {
    type Target = T;
    fn deref(&self) -> &T {
        &self.inner
    }
}
impl<'de, T: Default + Send + Sync + 'static> CommandArg<'de, Wry> for WindowState<T> {
    fn from_command(command: CommandItem<'de, Wry>) -> Result<Self, InvokeError> {
        Ok(Self {
            inner: BrowserContext::from_command(command)?.window_state::<T>(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn auxiliary_labels_resolve_to_their_browser_window() {
        assert_eq!(
            owner_label("sia-window-123--browser-menu"),
            "sia-window-123"
        );
        assert_eq!(owner_label("main"), "main");
    }
}
