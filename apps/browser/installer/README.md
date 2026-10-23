# 西娅浏览器 Windows 安装包

参考鼠标指针项目的 Inno Setup 安装流程，使用原生简体中文向导。

- 当前用户安装，无需管理员权限；默认目录 `%LOCALAPPDATA%\Programs\SiaBrowser`，向导允许修改目录。
- 自动添加开始菜单入口和卸载入口；桌面快捷方式可选，默认不勾选。
- 完成页可启动西娅浏览器；静默安装不会自动启动。
- 固定安装身份 `com.sia.browser` 支持后续覆盖升级，沿用之前选择的安装目录。
- 程序运行时通过 `Local\SiaBrowser.Installation` 互斥体保护安装、升级和卸载。交互安装提供“重新检测”“强制关闭并继续安装”“取消”；仅点击强制关闭才结束当前 Windows 会话中产品身份匹配的浏览器，可能丢失尚未保存的网页输入。关闭失败不会覆盖程序，静默安装不会强制结束进程，卸载仍要求先正常关闭。
- 已有 WebView2 Runtime 时直接安装；缺失时联网下载微软 Evergreen Bootstrapper 并安装，失败则停止并提示。
- 只打包 `sia-browser.exe` 和独立图标 `app.ico`。前端资源内嵌于 EXE，不附带完整 Chromium。
- 卸载只删除安装器管理的文件，不删除 `%LOCALAPPDATA%\com.sia.browser`、`%APPDATA%\com.sia.browser` 下的密码、标签树、历史、小分组 Cookie 等数据，也不删除安装目录中额外放入的文件。
- 不修改默认浏览器关联或开机启动设置。

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

`test-force-close.ps1` 创建独立互斥体和测试进程，实际点击验证安装器中的取消、重新检测、强制关闭按钮，检查关闭后进入向导，并验证静默保护及同名异产品进程不被关闭。测试只操作自己创建的进程，不触及正式浏览器；验证包使用 `Local\SiaBrowser.Installation.Validation` 互斥体。
