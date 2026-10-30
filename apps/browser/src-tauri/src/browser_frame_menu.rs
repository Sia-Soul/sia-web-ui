//! 为内核菜单补充框架刷新，再交给展示方；直接定位文档对象，不按 URL 或跨进程坐标猜测。
use serde_json::{json, Value};
use std::{
    cell::{Cell, RefCell},
    collections::HashMap,
    rc::Rc,
    sync::atomic::{AtomicU64, Ordering},
};
use webview2_com::{
    AddScriptToExecuteOnDocumentCreatedCompletedHandler, CoTaskMemPWSTR,
    ContextMenuRequestedEventHandler, CustomItemSelectedEventHandler, NavigationStartingEventHandler,
    ExecuteScriptCompletedHandler, FrameChildFrameCreatedEventHandler, FrameCreatedEventHandler,
    FrameDestroyedEventHandler, Microsoft::Web::WebView2::Win32::*,
};
use windows::core::{Interface, BOOL, HSTRING, PWSTR};

static NEXT_ID: AtomicU64 = AtomicU64::new(1);
type Frames = Rc<RefCell<HashMap<u64, ICoreWebView2Frame2>>>;

/// 接收完整内核菜单与延迟句柄；展示方必须在选择或取消后完成句柄。
pub type MenuPresenter = Rc<dyn Fn(ICoreWebView2ContextMenuRequestedEventArgs, ICoreWebView2Deferral)>;

/// 菜单请求仅在 UI 线程持有 COM 对象；超时展示现有菜单，不等待网页进程。
struct Request {
    args: ICoreWebView2ContextMenuRequestedEventArgs,
    deferral: Option<ICoreWebView2Deferral>,
    presenter: Option<MenuPresenter>,
    generation: Rc<Cell<u64>>,
    expected_generation: u64,
    environment: ICoreWebView2Environment9,
    key: String,
    remaining: usize,
    matches: Vec<(ICoreWebView2Frame2, String, f64)>,
}
impl Drop for Request {
    fn drop(&mut self) {
        unsafe {
            if let Some(deferral) = self.deferral.take() {
                // 新右键请求到达后，旧框架查询不得重新弹出菜单。
                if self.generation.get() != self.expected_generation {
                    let _ = self.args.SetHandled(true);
                    let _ = deferral.Complete();
                } else if let Some(present) = &self.presenter {
                    present(self.args.clone(), deferral);
                } else {
                    let _ = deferral.Complete();
                }
            }
        }
    }
}
thread_local! {
    static REQUESTS: RefCell<HashMap<u64, Request>> = RefCell::new(HashMap::new());
}

/// 跟踪所有层级的框架，销毁时释放引用；事件只捕获弱引用，避免形成 COM 循环。
unsafe fn watch(frame: ICoreWebView2Frame, frames: &Frames) -> windows::core::Result<()> {
    let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);
    let frame2: ICoreWebView2Frame2 = frame.cast()?;
    let weak = Rc::downgrade(frames);
    let destroyed = FrameDestroyedEventHandler::create(Box::new(move |_, _| {
        if let Some(frames) = weak.upgrade() {
            frames.borrow_mut().remove(&id);
        }
        Ok(())
    }));
    let mut token = 0;
    frame.add_Destroyed(&destroyed, &mut token)?;
    if let Ok(frame7) = frame.cast::<ICoreWebView2Frame7>() {
        let weak = Rc::downgrade(frames);
        let created = FrameChildFrameCreatedEventHandler::create(Box::new(move |_, args| {
            if let (Some(frames), Some(args)) = (weak.upgrade(), args) {
                let _ = watch(args.Frame()?, &frames);
            }
            Ok(())
        }));
        frame7.add_FrameCreated(&created, &mut token)?;
    }
    frames.borrow_mut().insert(id, frame2);
    Ok(())
}

/// 将菜单命令绑定到文档令牌；菜单打开后发生导航时，旧命令不会刷新新文档。
unsafe fn append_reload(
    request: &Request,
    frame: ICoreWebView2Frame2,
    document: String,
) -> windows::core::Result<()> {
    let items = request.args.MenuItems()?;
    let item = request.environment.CreateContextMenuItem(
        &HSTRING::from("刷新框架"),
        None,
        COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_COMMAND,
    )?;
    let script = format!(
        "if(window[{}]?.token === {}) location.reload()",
        json!(request.key),
        json!(document)
    );
    let selected = CustomItemSelectedEventHandler::create(Box::new(move |_, _| {
        let done = ExecuteScriptCompletedHandler::create(Box::new(|_, _| Ok(())));
        // 已移除的框架直接忽略；不回退到刷新整个页面。
        let _ = frame.ExecuteScript(&HSTRING::from(script.as_str()), &done);
        Ok(())
    }));
    let mut token = 0;
    item.add_CustomItemSelected(&selected, &mut token)?;
    let mut count = 0;
    items.Count(&mut count)?;
    let mut position = count;
    for index in 0..count {
        let existing = items.GetValueAtIndex(index)?;
        let mut name = PWSTR::null();
        existing.Name(&mut name)?;
        if CoTaskMemPWSTR::from(name).to_string() == "reload" {
            position = index + 1;
            break;
        }
    }
    items.InsertValueAtIndex(position, &item)
}

/// 收齐框架标记后才显示命令；模糊命中或超时均保留原有菜单项。
fn answered(id: u64, frame: ICoreWebView2Frame2, value: Option<Value>) {
    let completed = REQUESTS.with(|requests| {
        let mut requests = requests.borrow_mut();
        let request = requests.get_mut(&id)?;
        if let Some(value) = value {
            if let (Some(token), Some(stamp)) = (value["token"].as_str(), value["stamp"].as_f64()) {
                request.matches.push((frame, token.to_owned(), stamp));
            }
        }
        request.remaining -= 1;
        if request.remaining == 0 {
            requests.remove(&id)
        } else {
            None
        }
    });
    if let Some(mut request) = completed {
        // 网页自己阻止默认菜单时也会留下标记，只采用最新的真实右键事件。
        request.matches.sort_by(|a, b| b.2.total_cmp(&a.2));
        if let Some((frame, token, stamp)) = request.matches.first() {
            if request.matches.get(1).is_none_or(|other| other.2 < *stamp) {
                unsafe {
                    let _ = append_reload(&request, frame.clone(), token.clone());
                }
            }
        }
    }
}

/// 首次导航前安装菜单扩展；presenter 接管最终菜单，省略时保留内核绘制。
/// ready 仅在文档监听脚本注册完成后回调，安装错误通过回调返回。
pub fn install(
    core: &ICoreWebView2,
    environment: &ICoreWebView2Environment,
    app: tauri::AppHandle,
    presenter: Option<MenuPresenter>,
    ready: impl FnOnce(windows::core::Result<()>) + 'static,
) -> windows::core::Result<()> {
    let environment: ICoreWebView2Environment9 = environment.cast()?;
    let frames: Frames = Rc::new(RefCell::new(HashMap::new()));
    let key = format!("__siaFrameMenu_{}", NEXT_ID.fetch_add(1, Ordering::Relaxed));
    let created_frames = frames.clone();
    let created = FrameCreatedEventHandler::create(Box::new(move |_, args| unsafe {
        if let Some(args) = args {
            let _ = watch(args.Frame()?, &created_frames);
        }
        Ok(())
    }));
    let menu_key = key.clone();
    let generation = Rc::new(Cell::new(0u64));
    let navigation_generation = generation.clone();
    let navigation = NavigationStartingEventHandler::create(Box::new(move |_, _| {
        navigation_generation.set(navigation_generation.get() + 1);
        Ok(())
    }));
    let handler = ContextMenuRequestedEventHandler::create(Box::new(move |_, args| unsafe {
        let Some(args) = args else {
            return Ok(());
        };
        generation.set(generation.get() + 1);
        let mut main = BOOL(0);
        args.ContextMenuTarget()?
            .IsRequestedForMainFrame(&mut main)?;
        let frames: Vec<_> = frames.borrow().values().cloned().collect();
        if main.as_bool() || frames.is_empty() {
            if let Some(present) = &presenter {
                let deferral = args.GetDeferral()?;
                present(args, deferral);
            }
            return Ok(());
        }
        let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);
        let request = Request {
            deferral: Some(args.GetDeferral()?),
            presenter: presenter.clone(),
            generation: generation.clone(),
            expected_generation: generation.get(),
            args,
            environment: environment.clone(),
            key: menu_key.clone(),
            remaining: frames.len(),
            matches: Vec::new(),
        };
        REQUESTS.with(|requests| requests.borrow_mut().insert(id, request));
        // 每次读取都消费标记，避免前一次右键留下的文档成为本次候选。
        let script = format!("(()=>{{const s=window[{}];if(!s)return null;const pending=s.pending;s.pending=false;return pending?{{token:s.token,stamp:pending}}:null}})()", json!(menu_key));
        for frame in frames {
            let target = frame.clone();
            let done = ExecuteScriptCompletedHandler::create(Box::new(move |result, value| {
                answered(
                    id,
                    target,
                    result.ok().and_then(|_| serde_json::from_str(&value).ok()),
                );
                Ok(())
            }));
            if frame
                .ExecuteScript(&HSTRING::from(script.as_str()), &done)
                .is_err()
            {
                answered(id, frame, None);
            }
        }
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            let _ = app.run_on_main_thread(move || {
                REQUESTS.with(|requests| requests.borrow_mut().remove(&id));
            });
        });
        Ok(())
    }));
    // 在网页自己的处理器之前记录真实右键；不阻止事件、不更改网页菜单行为。
    let script = format!(
        r#"(()=>{{if(window===top)return;const s={{token:Array.from(crypto.getRandomValues(new Uint32Array(4))).join("-"),pending:false}};Object.defineProperty(window,{},{{value:s}});window.addEventListener('contextmenu',event=>{{if(event.isTrusted)s.pending=performance.timeOrigin+performance.now()}},true)}})()"#,
        json!(key)
    );
    let done =
        AddScriptToExecuteOnDocumentCreatedCompletedHandler::create(Box::new(move |result, _| {
            ready(result);
            Ok(())
        }));
    let mut token = 0;
    unsafe {
        core.add_NavigationStarting(&navigation, &mut token)?;
        core.cast::<ICoreWebView2_4>()?
            .add_FrameCreated(&created, &mut token)?;
        core.cast::<ICoreWebView2_11>()?
            .add_ContextMenuRequested(&handler, &mut token)?;
        core.AddScriptToExecuteOnDocumentCreated(&HSTRING::from(script), &done)
    }
}

/// 安装失败或超过三秒仍未完成时返回错误，不阻塞标签页首次导航。
pub async fn attach(view: &tauri::Webview, presenter: impl FnOnce() -> MenuPresenter + Send + 'static) -> Result<(), String> {
    use tauri::Manager;
    let app = view.app_handle().clone();
    let (send, receive) = tokio::sync::oneshot::channel();
    view.with_webview(move |platform| {
        let send = Rc::new(RefCell::new(Some(send)));
        let completed = send.clone();
        let result = unsafe { platform.controller().CoreWebView2() }.and_then(|core| {
            install(&core, &platform.environment(), app, Some(presenter()), move |result| {
                if let Some(send) = completed.borrow_mut().take() {
                    let _ = send.send(result.map_err(|error| error.to_string()));
                }
            })
        });
        if let Err(error) = result {
            if let Some(send) = send.borrow_mut().take() {
                let _ = send.send(Err(error.to_string()));
            }
        }
    })
    .map_err(|error| error.to_string())?;
    tokio::time::timeout(std::time::Duration::from_secs(3), receive)
        .await
        .map_err(|_| "安装框架菜单超时".to_string())?
        .map_err(|error| error.to_string())?
}
