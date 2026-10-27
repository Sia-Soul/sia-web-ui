//! 正常释放空闲隔离空间，并隔离 WebView2 退出清理中的输入窗口和超时进程。
use std::{
    os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle},
    path::PathBuf,
    time::Duration,
};
use tauri::Manager;
use windows::{
    core::BOOL,
    Win32::{
        Foundation::{HANDLE, HWND, LPARAM, WAIT_OBJECT_0, WPARAM},
        System::Threading::{
            OpenProcess, TerminateProcess, WaitForSingleObject, PROCESS_SYNCHRONIZE,
            PROCESS_TERMINATE,
        },
        UI::WindowsAndMessaging::*,
    },
};

/// 正常 Close 后给予内核落盘及退出的时间；后台轮询不占用主窗口消息线程。
const EXIT_GRACE: Duration = Duration::from_secs(30);

/// 固定的进程句柄防止 PID 重用；只保存本应用即将关闭的隔离空间内核。
pub struct RetiringProcess {
    process: OwnedHandle,
    process_id: u32,
    input_windows: Vec<isize>,
}

/// 收集本内核的顶层输入窗口，并解除它们对本应用窗口的所有权；不得处理子窗口。
unsafe fn detach_input_windows(process_id: u32) -> Result<Vec<isize>, String> {
    struct Search {
        process_id: u32,
        windows: Vec<isize>,
        failed: bool,
    }
    unsafe extern "system" fn visit(window: HWND, data: LPARAM) -> BOOL {
        let search = &mut *(data.0 as *mut Search);
        let mut pid = 0;
        GetWindowThreadProcessId(window, Some(&mut pid));
        if pid != search.process_id || GetWindowLongW(window, GWL_STYLE) as u32 & WS_CHILD.0 != 0 {
            return BOOL(1);
        }
        let mut class = [0u16; 128];
        let length = GetClassNameW(window, &mut class);
        let name = String::from_utf16_lossy(&class[..length.max(0) as usize]);
        if name != "IME" && name != "MSCTFIME UI" {
            return BOOL(1);
        }
        search.windows.push(window.0 as isize);
        let owner = HWND(GetWindowLongPtrW(window, GWLP_HWNDPARENT) as *mut _);
        let mut owner_pid = 0;
        GetWindowThreadProcessId(owner, Some(&mut owner_pid));
        if owner_pid == std::process::id() {
            // 内核退出可能停在 OneAuth；断开其输入窗口与主窗体的关系后，主消息循环无需等待它。
            SetWindowLongPtrW(window, GWLP_HWNDPARENT, 0);
            if GetWindowLongPtrW(window, GWLP_HWNDPARENT) != 0 {
                search.failed = true;
            }
        }
        BOOL(1)
    }
    let mut search = Search {
        process_id,
        windows: Vec::new(),
        failed: false,
    };
    EnumWindows(Some(visit), LPARAM(&mut search as *mut _ as isize))
        .map_err(|error| error.to_string())?;
    if search.failed {
        return Err("无法解除退出内核的输入窗口关联".into());
    }
    Ok(search.windows)
}

/// 仅在隔离空间最后一个实际网页关闭且没有下载任务时调用；在 UI 线程正常 Close 后返回退出凭据。
/// 不保留空白控制器，不删除资料目录；准备失败时保留原控制器，避免未经隔离的内核退出。
pub async fn close_last_view(view: &tauri::Webview) -> Result<RetiringProcess, String> {
    let (send, receive) = tokio::sync::oneshot::channel();
    view.with_webview(move |view| unsafe {
        let result = (|| -> Result<RetiringProcess, String> {
            let controller = view.controller();
            let core = controller
                .CoreWebView2()
                .map_err(|error| error.to_string())?;
            let mut process_id = 0;
            core.BrowserProcessId(&mut process_id)
                .map_err(|error| error.to_string())?;
            let handle = OpenProcess(PROCESS_SYNCHRONIZE | PROCESS_TERMINATE, false, process_id)
                .map_err(|error| error.to_string())?;
            let process = OwnedHandle::from_raw_handle(handle.0);
            let input_windows = detach_input_windows(process_id)?;
            // 等待 Close 确认释放业务控制器后才允许后台超时回收；Tauri 随后移除外层窗口与注册记录。
            controller.Close().map_err(|error| error.to_string())?;
            Ok(RetiringProcess {
                process,
                process_id,
                input_windows,
            })
        })();
        let _ = send.send(result);
    })
    .map_err(|error| error.to_string())?;
    receive
        .await
        .map_err(|_| "准备隔离空间释放已中断".to_string())?
}

impl RetiringProcess {
    /// 输入窗口全部销毁或已停止响应，说明不能再为网页提供输入；消息探测仅在后台执行。
    fn input_has_retired(&self) -> bool {
        unsafe {
            let windows = self
                .input_windows
                .iter()
                .filter_map(|raw| {
                    let window = HWND(*raw as *mut _);
                    let mut pid = 0;
                    GetWindowThreadProcessId(window, Some(&mut pid));
                    (pid == self.process_id).then_some(window)
                })
                .collect::<Vec<_>>();
            // 某些运行时先销毁所有输入窗口再卡在 OneAuth；此时也不能无限保留已 Close 的进程。
            windows.is_empty()
                || windows.iter().any(|window| {
                    SendMessageTimeoutW(
                        *window,
                        WM_NULL,
                        WPARAM(0),
                        LPARAM(0),
                        SMTO_ABORTIFHUNG | SMTO_BLOCK,
                        500,
                        None,
                    )
                    .0 == 0
                })
        }
    }
}

/// 正常退出优先；只有已 Close、没有重新使用且输入窗口已退出或挂起的内核，才在宽限期后结束。
/// 生命周期锁覆盖最后一次使用检查和结束操作，防止新网页恰好复用正在回收的内核。
pub fn watch_exit(app: tauri::AppHandle, profile: PathBuf, mut retiring: RetiringProcess) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(EXIT_GRACE).await;
            if unsafe { WaitForSingleObject(HANDLE(retiring.process.as_raw_handle()), 0) }
                == WAIT_OBJECT_0
            {
                return;
            }
            // 消息探测移至后台，避免 500ms 的系统超时占用 UI 或异步运行时工作线程。
            let checked = tauri::async_runtime::spawn_blocking(move || {
                let stalled = retiring.input_has_retired();
                (retiring, stalled)
            })
            .await;
            let Ok((next, stalled)) = checked else {
                return;
            };
            let lifecycle = app.state::<crate::extension_runtime::ExtensionOperationLock>();
            let _guard = lifecycle.0.lock().await;
            let in_use = app
                .state::<crate::BrowserProfileStore>()
                .0
                .lock()
                .map(|profiles| profiles.values().any(|current| current == &profile))
                .unwrap_or(true);
            if !in_use && stalled {
                // 不按名称杀进程；句柄绑定旧内核，且宽限期已允许正常关闭和保存资料。
                if unsafe { TerminateProcess(HANDLE(next.process.as_raw_handle()), 0) }.is_err() {
                    eprintln!(
                        "[browser-profile] 无法回收退出超时的内核 pid={}",
                        next.process_id
                    );
                } else {
                    eprintln!(
                        "[browser-profile] 已回收退出超时的空闲内核 pid={}",
                        next.process_id
                    );
                }
                return;
            }
            retiring = next;
        }
    });
}
