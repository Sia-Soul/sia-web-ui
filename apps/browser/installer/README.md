# 西娅浏览器 Windows 安装包

参考鼠标指针项目的 Inno Setup 安装流程，使用原生简体中文向导。

- 当前用户安装，无需管理员权限；默认目录 `%LOCALAPPDATA%\Programs\SiaBrowser`，向导允许修改目录。
- 自动添加开始菜单入口和卸载入口；桌面快捷方式可选，默认不勾选。
- 完成页可启动西娅浏览器；静默安装不会自动启动。
- 固定安装身份 `com.sia.browser` 支持后续覆盖升级，沿用之前选择的安装目录。
- 程序运行时通过 `Local\SiaBrowser.Installation` 互斥体保护安装、升级和卸载。交互安装先显示欢迎向导，再进入独立的“检测浏览器运行状态”步骤，底部提供“重新检测”“强制关闭并继续”“取消”；启动时不弹出前置拦截对话框。仅点击强制关闭才结束当前 Windows 会话中产品身份匹配的浏览器，可能丢失尚未保存的网页输入。手动关闭后重新检测可继续下一步，关闭失败在当前页显示原因；实际安装前复查运行状态，中途重启浏览器会阻止写入。静默安装不会强制结束进程，卸载仍要求先正常关闭。
- 已有 WebView2 Runtime 时直接安装；缺失时联网下载微软 Evergreen Bootstrapper 并安装，失败则停止并提示。
- 只打包 `sia-browser.exe` 和独立图标 `app.ico`。前端资源内嵌于 EXE，不附带完整 Chromium。
- 卸载只删除安装器管理的文件，不删除 `%LOCALAPPDATA%\com.sia.browser`、`%APPDATA%\com.sia.browser` 下的密码、标签树、历史、小分组 Cookie 等数据，也不删除安装目录中额外放入的文件。
- 安装时登记当前用户的 HTTP/HTTPS 浏览器候选能力，卸载时移除本应用登记；不修改用户已经选择的默认程序，也不修改开机启动设置。
- “设为默认浏览器”会先修复旧安装缺失的登记，再使用 `ms-settings:defaultapps?registeredAppUser=SiaBrowser` 定位西娅浏览器详情，由用户在系统中确认。Windows 11 21H2/22H2 需安装 2023 年 4 月累积更新，23H2 及更新版本直接支持；旧系统退回默认浏览器选择入口并显示提示。
- 系统通过 `--open-url` 传入 HTTP/HTTPS 链接，通过 `--open-file` 传入 `.html`/`.htm` 文件；未运行时启动并恢复会话，已运行时把请求交给现有窗口、新建根级标签并恢复窗口到前台，不另开浏览器进程。启动期间收到的请求暂存到会话恢复完成后处理。开发版、不同诊断目录与正式版分别管理实例。安装器和默认浏览器按钮均登记 HTML 的“打开方式”候选，不抢占现有默认关联。
- 外部链接或 HTML 文件拖入标题栏、侧栏和网页区域时，新建根级标签。HTML 文件使用 WebView2 原生 File 对象获取真实路径并直接加载，保留相对资源目录；Tree 内部排序、当前文档内部拖动和可编辑控件继续使用原有拖放行为。

## 构建

安装 Inno Setup 6 后，在仓库根目录运行：

```powershell
pnpm browser:bundle
```

命令会重新构建桌面 EXE，再编译安装包。也可直接运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File apps/browser/build-installer.ps1
```

`-Compiler` 指定其他 `ISCC.exe` 路径。`-SkipBuild` 仅用于刚完成构建、明确要复用现有 EXE 的情况，脚本仍校验版本、名称与架构，但不会检查源文件是否比 EXE 更新。

输出在 Cargo 有效构建目录的 `release/bundle/inno/`，当前默认是 `D:/SiaBuild/SiaWebUI/target/release/bundle/inno/`。仓库 `.cargo/config.toml` 管理默认目录，`CARGO_TARGET_DIR` 可临时覆盖。脚本通过 `cargo metadata` 定位 EXE，打包暂存和临时文件也写入该构建目录：

- `Sia-Browser-Setup-<版本>-x64.exe`
- 同名 `.sha256` 校验文件
- 同名 `.manifest.json` 运行文件及哈希清单

## 首次从旧安装器转换

新向导会自动迁移旧版 `Sia Browser`、`西娅浏览器` 和 `栖页浏览器`，无需前往 Windows 设置手动卸载。准备安装页说明迁移行为；点击“安装”后，先确认 WebView2 可用，再检查全部旧版登记及运行状态，逐个调用旧 NSIS 卸载器，最后继续安装新版。

旧卸载器以 `/S /UPDATE` 运行，升级模式明确跳过浏览数据删除；迁移脚本只清理仍指向旧程序的品牌快捷方式和启动项。脚本在临时目录执行卸载器副本，并通过末尾的 `_?=` 参数指定原安装目录，确保等待实际卸载结束。卸载退出码、残留登记或程序文件异常时中止安装并显示错误，支持重试。提供运行互斥体的版本可通过向导强制关闭；更早的版本仍由迁移预检查阻止运行中卸载。机器级旧安装会请求 Windows 管理员授权。

旧版卸载器缺失、登记路径不匹配时，不会删除目录或伪造卸载成功，会提示修复旧安装后重试。以后使用 Inno 安装的版本可直接覆盖升级。

## 验证

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File apps/browser/build-installer.ps1 -SkipBuild -ValidationBuild
powershell -NoProfile -ExecutionPolicy Bypass -File apps/browser/installer/test-installer.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File apps/browser/installer/test-force-close.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File apps/browser/installer/test-migration.ps1
```

验证包使用单独的 AppId、快捷方式名称、临时安装路径，以及专属旧版检测名称，避免触及已有正式安装。`test-installer.ps1` 测试安装、文件一致性、快捷方式、覆盖升级、运行中保护和卸载保留额外文件。`test-migration.ps1` 从本机已生成的 Tauri NSIS 模板构建两个隔离旧版，再通过完整验证向导迁移，检查损坏登记的预检查、旧版登记与快捷方式清理，以及 AppData/LocalAppData 测试数据保留。测试不启动浏览器或修改真实用户浏览数据。

中文语言文件复用参考项目的 [Inno Setup 简体中文翻译](https://github.com/kira-96/Inno-Setup-Chinese-Simplified-Translation)，保留文件头原作者署名。WebView2 使用微软官方下载地址。安装包未配置代码签名证书。

`test-force-close.ps1` 创建独立互斥体和测试进程，验证运行中先出现欢迎向导、下一步进入检测页、动作按钮位于底部同一行；实际点击取消、重新检测和强制关闭，并检查手动关闭后能继续安装。另验证静默保护及同名异产品进程不被关闭。测试只操作自己创建的进程，不触及正式浏览器；验证包使用 `Local\SiaBrowser.Installation.Validation` 互斥体。
