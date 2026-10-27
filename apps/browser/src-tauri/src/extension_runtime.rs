//! 在导航前按隔离配置同步扩展，避免全局目录自动加载绕过分组限制。
use std::{collections::HashMap, path::Path};

/// 串行化扩展配置修改、网页初始化与销毁，防止旧策略回写及 WebView2 消息泵重入上下文锁。
/// 只能在异步任务中等待；已持锁的内部操作不得再次获取该锁。
#[derive(Default)]
pub struct ExtensionOperationLock(pub tokio::sync::Mutex<()>);

/// 每个隔离目录记录受管安装 ID 与真实运行 ID；不依赖可能重名的扩展名称。
pub fn read_runtime_ids(directory: &Path) -> Result<HashMap<String, String>, String> {
    let path = directory.join("sia-extension-ids.json");
    if !path.exists() {
        return Ok(HashMap::new());
    }
    serde_json::from_slice(&std::fs::read(path).map_err(|error| error.to_string())?)
        .map_err(|error| format!("扩展运行标识配置损坏：{error}"))
}

/// 先完整写入同目录临时文件再替换，防止中断留下截断的扩展授权或运行 ID。
pub fn write_json_atomic(path: &Path, value: &impl serde::Serialize) -> Result<(), String> {
    use std::io::Write;
    let temporary = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?;
    let mut file = std::fs::File::create(&temporary).map_err(|error| error.to_string())?;
    file.write_all(&bytes).map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())?;
    drop(file);
    std::fs::rename(&temporary, path).map_err(|error| error.to_string())
}

/// 将期望策略转为最少的 Profile 操作；未知旧版扩展停用保留数据，已删除的受管扩展卸载。
fn reconcile_changes(
    ids: &HashMap<String, String>,
    existing: &HashMap<String, bool>,
    desired: &[(String, std::path::PathBuf, bool)],
) -> Vec<(String, Option<bool>)> {
    existing
        .iter()
        .filter_map(|(runtime, enabled)| {
            let owner = ids.iter().find(|(_, value)| *value == runtime);
            let target = owner.and_then(|(id, _)| desired.iter().find(|(key, _, _)| key == id));
            match (owner, target) {
                (Some(_), None) => Some((runtime.clone(), None)),
                (_, Some((_, _, allowed))) if enabled != allowed => {
                    Some((runtime.clone(), Some(*allowed)))
                }
                (None, None) if *enabled => Some((runtime.clone(), Some(false))),
                _ => None,
            }
        })
        .collect()
}

#[cfg(windows)]
mod windows_runtime {
    use super::*;
    use std::sync::{Arc, Mutex};
    use webview2_com::{
        BrowserExtensionEnableCompletedHandler, BrowserExtensionRemoveCompletedHandler,
        CoTaskMemPWSTR,
        Microsoft::Web::WebView2::Win32::{ICoreWebView2Profile7, ICoreWebView2_13},
        ProfileAddBrowserExtensionCompletedHandler, ProfileGetBrowserExtensionsCompletedHandler,
    };
    use windows::core::{Interface, HSTRING, PWSTR};

    type Reply<T> = Arc<Mutex<Option<tokio::sync::oneshot::Sender<Result<T, String>>>>>;

    /// COM 回调和同步调用失败共用一次性回复，不能阻塞 WebView2 的 UI 线程。
    fn finish<T>(reply: &Reply<T>, value: Result<T, String>) {
        if let Ok(mut sender) = reply.lock() {
            if let Some(sender) = sender.take() {
                let _ = sender.send(value);
            }
        }
    }

    async fn with_profile<T: Send + 'static>(
        webview: &tauri::Webview,
        action: impl FnOnce(ICoreWebView2Profile7, Reply<T>) -> windows::core::Result<()>
            + Send
            + 'static,
    ) -> Result<T, String> {
        let (sender, receiver) = tokio::sync::oneshot::channel();
        let reply = Arc::new(Mutex::new(Some(sender)));
        webview
            .with_webview(move |view| {
                let result = (|| unsafe {
                    let profile = view
                        .controller()
                        .CoreWebView2()?
                        .cast::<ICoreWebView2_13>()?
                        .Profile()?
                        .cast::<ICoreWebView2Profile7>()?;
                    action(profile, reply.clone())
                })();
                if let Err(error) = result {
                    finish(&reply, Err(format!("无法同步分组扩展：{error}")));
                }
            })
            .map_err(|error| error.to_string())?;
        tokio::time::timeout(std::time::Duration::from_secs(30), receiver)
            .await
            .map_err(|_| "扩展同步超时".to_string())?
            .map_err(|_| "扩展同步已中断".to_string())?
    }

    /// 只把 ID 和启用状态传回工作线程，COM 对象始终留在创建它的 UI 线程。
    async fn list(webview: &tauri::Webview) -> Result<HashMap<String, bool>, String> {
        with_profile(webview, |profile, reply| unsafe {
            profile.GetBrowserExtensions(&ProfileGetBrowserExtensionsCompletedHandler::create(
                Box::new(move |status, collection| {
                    let result = (|| -> windows::core::Result<_> {
                        status?;
                        let collection = collection.ok_or_else(windows::core::Error::empty)?;
                        let mut count = 0;
                        collection.Count(&mut count)?;
                        let mut records = HashMap::new();
                        for index in 0..count {
                            let extension = collection.GetValueAtIndex(index)?;
                            let mut id = PWSTR::null();
                            extension.Id(&mut id)?;
                            let mut enabled = windows::core::BOOL::default();
                            extension.IsEnabled(&mut enabled)?;
                            records.insert(CoTaskMemPWSTR::from(id).to_string(), enabled.as_bool());
                        }
                        Ok(records)
                    })();
                    finish(&reply, result.map_err(|error| error.to_string()));
                    Ok(())
                }),
            ))
        })
        .await
    }

    /// None 表示卸载；Some 表示切换启用状态并保留该扩展的本地数据。
    async fn change(
        webview: &tauri::Webview,
        id: String,
        enabled: Option<bool>,
    ) -> Result<(), String> {
        with_profile(webview, move |profile, reply| unsafe {
            profile.GetBrowserExtensions(&ProfileGetBrowserExtensionsCompletedHandler::create(
                Box::new(move |status, collection| {
                    let result = (|| -> windows::core::Result<()> {
                        status?;
                        let collection = collection.ok_or_else(windows::core::Error::empty)?;
                        let mut count = 0;
                        collection.Count(&mut count)?;
                        for index in 0..count {
                            let extension = collection.GetValueAtIndex(index)?;
                            let mut raw = PWSTR::null();
                            extension.Id(&mut raw)?;
                            if CoTaskMemPWSTR::from(raw).to_string() != id {
                                continue;
                            }
                            let callback_reply = reply.clone();
                            return match enabled {
                                Some(value) => extension.Enable(
                                    value,
                                    &BrowserExtensionEnableCompletedHandler::create(Box::new(
                                        move |status| {
                                            finish(
                                                &callback_reply,
                                                status.map_err(|error| error.to_string()),
                                            );
                                            Ok(())
                                        },
                                    )),
                                ),
                                None => extension.Remove(
                                    &BrowserExtensionRemoveCompletedHandler::create(Box::new(
                                        move |status| {
                                            finish(
                                                &callback_reply,
                                                status.map_err(|error| error.to_string()),
                                            );
                                            Ok(())
                                        },
                                    )),
                                ),
                            };
                        }
                        finish(&reply, Ok(()));
                        Ok(())
                    })();
                    if let Err(error) = result {
                        finish(&reply, Err(error.to_string()));
                    }
                    Ok(())
                }),
            ))
        })
        .await
    }

    async fn add(webview: &tauri::Webview, path: std::path::PathBuf) -> Result<String, String> {
        with_profile(webview, move |profile, reply| unsafe {
            profile.AddBrowserExtension(
                &HSTRING::from(path.as_os_str()),
                &ProfileAddBrowserExtensionCompletedHandler::create(Box::new(
                    move |status, extension| {
                        let result = (|| -> windows::core::Result<_> {
                            status?;
                            let extension = extension.ok_or_else(windows::core::Error::empty)?;
                            let mut id = PWSTR::null();
                            extension.Id(&mut id)?;
                            Ok(CoTaskMemPWSTR::from(id).to_string())
                        })();
                        finish(&reply, result.map_err(|error| error.to_string()));
                        Ok(())
                    },
                )),
            )
        })
        .await
    }

    /// 先清理旧版全局安装和关闭未授权扩展，再安装当前范围允许的扩展；失败时调用方关闭空白视图。
    pub async fn synchronize(
        webview: &tauri::Webview,
        directory: &Path,
        desired: Vec<(String, std::path::PathBuf, bool)>,
    ) -> Result<(), String> {
        let mut ids = read_runtime_ids(directory)?;
        let previous_ids = ids.clone();
        let existing = list(webview).await?;
        for (runtime_id, enabled) in reconcile_changes(&ids, &existing, &desired) {
            change(webview, runtime_id, enabled).await?;
        }
        ids.retain(|id, runtime| {
            desired.iter().any(|(key, _, _)| key == id) && existing.contains_key(runtime)
        });
        for (id, path, allowed) in desired {
            if allowed && !ids.contains_key(&id) {
                ids.insert(id, add(webview, path).await?);
            }
        }
        // 状态未变化时避免每个新标签重复写入同一份映射。
        if ids == previous_ids {
            return Ok(());
        }
        write_json_atomic(&directory.join("sia-extension-ids.json"), &ids)
    }
}

#[cfg(windows)]
pub use windows_runtime::synchronize;

#[cfg(test)]
mod tests {
    use super::*;

    /// 撤销后台授权、重新启用、旧版迁移和卸载必须产生不同的原生操作。
    #[test]
    fn plans_revocation_migration_and_removal() {
        let ids = HashMap::from([
            ("a".into(), "runtime-a".into()),
            ("b".into(), "runtime-b".into()),
            ("removed".into(), "runtime-removed".into()),
        ]);
        let existing = HashMap::from([
            ("runtime-a".into(), true),
            ("runtime-b".into(), false),
            ("runtime-removed".into(), true),
            ("legacy".into(), true),
        ]);
        let desired = vec![
            ("a".into(), "a".into(), false),
            ("b".into(), "b".into(), true),
        ];
        let actions: HashMap<_, _> = reconcile_changes(&ids, &existing, &desired)
            .into_iter()
            .collect();
        assert_eq!(actions.get("runtime-a"), Some(&Some(false)));
        assert_eq!(actions.get("runtime-b"), Some(&Some(true)));
        assert_eq!(actions.get("runtime-removed"), Some(&None));
        assert_eq!(actions.get("legacy"), Some(&Some(false)));
    }

    /// 已符合范围的实例不重复安装或切换，保留扩展自身状态。
    #[test]
    fn unchanged_policy_needs_no_operations() {
        let ids = HashMap::from([("a".into(), "runtime-a".into())]);
        let existing = HashMap::from([("runtime-a".into(), true), ("legacy".into(), false)]);
        assert!(reconcile_changes(&ids, &existing, &[("a".into(), "a".into(), true)]).is_empty());
    }
}
