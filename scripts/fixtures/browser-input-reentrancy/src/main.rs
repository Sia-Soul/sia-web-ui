//! 在独立隐藏窗口内交错键盘与跨线程焦点消息；窗口心跳超时即判定死锁。
//! 不加载网页、不读写用户数据、不向用户浏览器发送消息。
use std::{
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    thread,
    time::{Duration, Instant},
};
use tao::{
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoop},
    platform::windows::WindowExtWindows,
    window::WindowBuilder,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    PostMessageW, SendMessageTimeoutW, SMTO_ABORTIFHUNG, WM_CHAR, WM_KEYDOWN, WM_KEYUP,
    WM_KILLFOCUS, WM_NULL, WM_SETFOCUS,
};

fn main() {
    let event_loop = EventLoop::new();
    let window = WindowBuilder::new()
        .with_title("Sia input regression")
        .with_visible(false)
        .build(&event_loop)
        .unwrap();
    let hwnd = window.hwnd() as isize;
    let events = Arc::new(AtomicUsize::new(0));
    thread::spawn(move || loop {
        // 字符序列与焦点消息在 PeekMessage 中交叉，覆盖原先持锁重入的路径。
        unsafe {
            PostMessageW(hwnd as _, WM_KEYDOWN, 0x41, 0x001E_0001);
            PostMessageW(hwnd as _, WM_CHAR, 0x61, 0x001E_0001);
            PostMessageW(hwnd as _, WM_KEYUP, 0x41, 0xC01E_0001u32 as isize);
        }
        thread::sleep(Duration::from_micros(200));
    });
    for _ in 0..2 {
        thread::spawn(move || loop {
            let mut result = 0;
            unsafe {
                SendMessageTimeoutW(
                    hwnd as _,
                    WM_KILLFOCUS,
                    0,
                    0,
                    SMTO_ABORTIFHUNG,
                    50,
                    &mut result,
                );
                SendMessageTimeoutW(
                    hwnd as _,
                    WM_SETFOCUS,
                    0,
                    0,
                    SMTO_ABORTIFHUNG,
                    50,
                    &mut result,
                );
            }
            thread::sleep(Duration::from_micros(100));
        });
    }
    let observed = events.clone();
    thread::spawn(move || {
        let start = Instant::now();
        let seconds = std::env::var("SIA_INPUT_CHECK_SECONDS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(10);
        let mut misses = 0;
        loop {
            thread::sleep(Duration::from_millis(100));
            let mut result = 0;
            let ok = unsafe {
                SendMessageTimeoutW(hwnd as _, WM_NULL, 0, 0, SMTO_ABORTIFHUNG, 500, &mut result)
            } != 0;
            misses = if ok { 0 } else { misses + 1 };
            if misses >= 3 {
                eprintln!(
                    "FAIL: native event loop unresponsive after {:.2}s",
                    start.elapsed().as_secs_f64()
                );
                std::process::exit(1);
            }
            if start.elapsed() >= Duration::from_secs(seconds) {
                let count = observed.load(Ordering::Relaxed);
                if count == 0 {
                    eprintln!("FAIL: window responded but delivered no keyboard events");
                    std::process::exit(2);
                }
                println!("PASS: responsive for {seconds}s; delivered {count} keyboard events");
                std::process::exit(0);
            }
        }
    });
    event_loop.run(move |event, _, flow| {
        let _keep_window_alive = &window;
        *flow = ControlFlow::Wait;
        if matches!(
            event,
            Event::WindowEvent {
                event: WindowEvent::KeyboardInput { .. },
                ..
            }
        ) {
            events.fetch_add(1, Ordering::Relaxed);
        }
    });
}
