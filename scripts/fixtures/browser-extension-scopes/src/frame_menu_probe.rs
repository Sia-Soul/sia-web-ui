//! 仅启动独立测试网页，记录原生右键菜单并模拟选中刷新框架命令。
use tauri::{WebviewUrl, WebviewWindowBuilder};
use webview2_com::{
    CoTaskMemPWSTR, ContextMenuRequestedEventHandler, Microsoft::Web::WebView2::Win32::*,
};
use windows::core::{Interface, PWSTR};
#[path = "../../../../apps/browser/src-tauri/src/browser_frame_menu.rs"]
mod browser_frame_menu;

// COM 参数只存取于 UI 线程，延时工作线程仅投递通知。
thread_local! {
    static PENDING: std::cell::RefCell<Option<(ICoreWebView2ContextMenuRequestedEventArgs, ICoreWebView2Deferral)>> = const { std::cell::RefCell::new(None) };
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let url = args[1].clone();
    let directory = std::path::PathBuf::from(&args[2]);
    tauri::Builder::default()
        .setup(move |app| {
            let view = WebviewWindowBuilder::new(
                app,
                "probe",
                WebviewUrl::External("about:blank".parse()?),
            )
            .visible(false)
            .inner_size(1100., 800.)
            .data_directory(directory.join("profile"))
            .build()?;
            let handle = app.handle().clone();
            view.with_webview(move |platform| unsafe {
                let core = platform.controller().CoreWebView2().unwrap();
                let install_app = handle.clone();
                // 延迟观察最终菜单，允许生产事件完成异步框架定位。
                let handler = ContextMenuRequestedEventHandler::create(Box::new(move |_, args| {
                    let Some(args) = args else {
                        return Ok(());
                    };
                    args.SetHandled(true)?;
                    let deferral = args.GetDeferral()?;
                    PENDING.with(|pending| *pending.borrow_mut() = Some((args, deferral)));
                    let handle = handle.clone();
                    let directory = directory.clone();
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                        let _ = handle.run_on_main_thread(move || {
                            let (args, deferral) =
                                PENDING.with(|pending| pending.borrow_mut().take()).unwrap();
                            let items = args.MenuItems().unwrap();
                            let mut count = 0;
                            items.Count(&mut count).unwrap();
                            let mut labels = Vec::new();
                            for i in 0..count {
                                let item = items.GetValueAtIndex(i).unwrap();
                                let mut label = PWSTR::null();
                                item.Label(&mut label).unwrap();
                                let label = CoTaskMemPWSTR::from(label).to_string();
                                if label == "刷新框架" {
                                    let mut id = 0;
                                    item.CommandId(&mut id).unwrap();
                                    args.SetSelectedCommandId(id).unwrap();
                                }
                                labels.push(label);
                            }
                            std::fs::write(
                                directory.join("menu.json"),
                                serde_json::to_vec(&labels).unwrap(),
                            )
                            .unwrap();
                            deferral.Complete().unwrap();
                        });
                    });
                    Ok(())
                }));
                let mut token = 0;
                core.cast::<ICoreWebView2_11>()
                    .unwrap()
                    .add_ContextMenuRequested(&handler, &mut token)
                    .unwrap();
                let navigate = core.clone();
                browser_frame_menu::install(
                    &core,
                    &platform.environment(),
                    install_app,
                    move |result| {
                        result.unwrap();
                        navigate
                            .Navigate(&windows::core::HSTRING::from(url.as_str()))
                            .unwrap();
                    },
                )
                .unwrap();
            })?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("启动框架菜单回归");
}
