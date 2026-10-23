# Windows 窗口未响应诊断

2026-10-23 对实际未响应的安装版进行只读采样：`WM_NULL` 在 1500ms 内没有响应，主线程阻塞在 `parking_lot::RawMutex::lock_slow`。外层 `KeyEventBuilder::process_message` 调用 `PeekMessageW` 时重入 `public_window_callback`，内层键盘回调再次等待同一把不可重入锁。

安装版没有对应的旧 PDB，诊断通过旧 EXE 与本地带 PDB 的 EXE 匹配多个连续机器码片段定位函数，并与原始调用栈核对。与 [Tao #1379](https://github.com/tauri-apps/tao/issues/1379) 的死锁路径一致；不能据此推断用户当时具体进行了哪一种焦点切换。

Tao 0.35.3 的键盘构建器在持有全局输入锁时查询消息队列，Windows 可能在查询期间派发其他线程发送的焦点消息，从而使主线程等待自己。系统焦点变化也可能在用户没有操作浏览器时发生。后台标签的自动休眠不是本次调用栈指向的阻塞路径。

## 修复依赖

浏览器使用 Tauri 2.12 系列及其 Tao 0.37 系列输入实现，同时将显式使用的 WebView2 COM、Windows 类型升级为与 Tauri 一致的版本。参考 [上游升级说明](https://github.com/tauri-apps/tao/issues/1349)。不修改 Cargo 缓存源码，不通过丢弃键盘消息规避问题。

## 回归方式

运行 `pnpm --filter @sia-ui/browser test:input-reentrancy`。测试在独立隐藏窗口中交错派发按下、字符、释放及跨线程焦点消息，并持续检查窗口心跳和键盘事件交付；不打开网页，不访问浏览器数据。脚本先校验夹具与浏览器锁文件中的 Tao 版本相同。

默认运行 10 秒；可设置 `SIA_INPUT_CHECK_SECONDS=60` 延长压力测试。原版 Tao 0.35.3 在相同夹具中 1.82 秒后因连续三次心跳超时而失败。

本次验证：旧版连续两次失败（1.82 秒、1.83 秒）；Tao 0.37.1 的 10 秒测试交付 27,276 个键盘事件，60 秒测试交付 155,632 个键盘事件，均保持响应。该压力测试覆盖已定位的输入重入死锁，不等价于所有网站和长期运行场景的稳定性保证。

`scripts/inspect-browser-hang.ps1 -BrowserProcessId <PID>` 可检查实际进程的响应和等待链，窗口超时返回退出码 1。诊断不结束用户进程，也不输出锁名称或网页内容。

## 安装后恢复会话时未响应

同日升级后的安装版又在启动时未响应。匹配安装 EXE 的 SHA-256 与本地 PDB 后，主线程调用栈定位到另一条重入路径：主 WebView2 初始化消息泵派发前端 IPC，`open_floating_tab_panel` 同步调用 `Window::add_child`，重新进入 `tauri_runtime_wry::create_webview`，等待外层尚未释放的 `web_context` 互斥锁。在主线程调用 `run_on_main_thread` 会直接执行，无法作为这里的延迟屏障。

修复在 Builder 中注册异步就绪状态，`setup` 完成覆盖层、标签面板和菜单预加载后发布结果。主入口等待 `wait_browser_ready` 才挂载 React；创建标签面板、网页的命令也等待就绪。失败结果展示为框架 Alert，避免无说明地停留在连接占位。等待通过 Tokio watch 挂起任务，不阻塞原生消息线程，不依赖固定延时。

`pnpm --filter @sia-ui/browser test:startup` 启动真实发布 EXE，首次使用新目录，保存仅包含本地测试网站的会话后再次启动，并检查工具栏、标签面板、真实网页恢复和连续原生 IPC 响应。修复前测试在恢复会话时因标签面板/原生线程超时失败。测试通过 `--diagnostic-data-dir` 隔离应用和 WebView2 目录，仅接受新目录或带测试标记的目录；只结束自身创建的进程树，不接触用户会话。诊断参数不改变正常安装版的数据路径。

修复后，完整启动脚本连续两轮通过（共四次实际 EXE 启动）。最后一轮同时检查显示后的 Windows 消息心跳；每次启动额外执行 20 次持续原生 IPC 检查。恢复网页由本地 HTTP 请求和页签标题回传共同确认，因为隔离小分组的 WebView2 环境不一定与主壳层共用调试端口。键盘压力测试再次通过（10 秒、31,170 个事件），Rust 的 17 项测试和公开 API 注释检查通过。以上使用独立测试资料，不代表已经验证用户原始资料下所有网站及扩展的长期行为。
