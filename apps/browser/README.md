# 西娅浏览器 · Sia Browser

西娅浏览器 是基于 Sia WebUI 与 Tauri 2 的桌面浏览器，Windows 版本使用系统 WebView2 运行时。

Windows 版本使用 Tauri 2.12 / Tao 0.37 的输入处理实现，避免键盘与焦点消息重入造成主线程死锁。原生压力测试运行 `pnpm --filter @sia-ui/browser test:input-reentrancy`；诊断依据和复现方式见 [Windows 未响应说明](docs/windows-input-hang.md)。

## 名称与图标

程序显示名为“西娅浏览器”（Sia Browser），Windows 主进程为 `sia-browser.exe`，安装包为 `Sia-Browser-Setup-0.1.0-x64.exe`。品牌采用 A 版蓝青飞鸟与 S1-E 连笔 Sia 签名：蓝色、青色及浅冰蓝羽翼围成盘旋造型；前景签名使用珍珠白填充与深蓝细描边，保留圆点与下方收笔线。所有图标均为透明背景；标题栏和新标签页使用横向字标，桌面、安装器与标签的小尺寸图标使用透明方形画布，按原比例居中显示签名。网页与原生图标均使用图稿本身的亮色，不依赖主题滤镜。

图标源文件为 `branding/sia-browser-source.png`，通过 `cargo tauri icon` 生成桌面图标；`public/brand` 保存网页图标和透明字标。运行 `node branding/build-signature-assets.cjs <sharp 模块路径>` 可从正式图稿重新导出网页尺寸与 1024px 桌面源图，再运行 `cargo tauri icon branding/sia-browser-source.png --output src-tauri/icons` 更新平台图标。应用标识 `com.sia.browser`、内部 `sia://` 地址和数据文件名保持稳定，不会另建用户数据空间。

正式图稿与生成提示词见 [S1-E 品牌记录](branding/signature-s1e.md)。此前的图标源图保留在 `branding/sia-browser-source-before-s1e.png`；旧版抠图脚本不用于新字标。

Windows 安装完成后会更新已有品牌任务栏快捷方式，将已知旧安装目录及开发构建目录迁移到当前安装目录，并使用 `app-s1e-blue-bird.ico` 避免沿用旧图标缓存。迁移保留固定项目和启动参数，不操作其他软件的链接；隔离验证包跳过真实任务栏迁移。打包会核对 EXE 内嵌的全部图标帧与正式 ICO 是否一致。

## 左侧树状标签与单行导航

- 仅支持左侧“环境分组 → 小分组 → 标签页”树形布局；旧会话的顶部标签布局偏好自动忽略，已有标签、分组与当前页面继续恢复。
- 环境名称使用分组颜色，小分组显示文件夹图标；两级分组均支持折叠、新建标签和“更多”菜单，菜单也可通过右键打开。小分组菜单依次为“新建标签页、重命名、分割线、删除小分组”；浏览数据清理仅在一级分组菜单提供。顶部新增入口统一显示“新建标签页”。
- 活动标签显示左侧色条，未激活的休眠标签显示“休眠”；支持关闭标签、收起为紧凑列表及拖动调整宽度。收缩面板不会因鼠标悬停自动展开，只能点击面板内的展开按钮恢复。
- 展开的标签树支持拖动页面到其他小分组、大分组标题或底部“移出分组”区域。目标高亮，悬停折叠分组约 650ms 后展开；拖到列表边缘可以滚动。移动后保持当前选中页，目标分组展开并保存归属。同一分组内投放不触发重载；跨数据空间会关闭旧 WebView，当前网页按目标分组重新加载，后台网页继续休眠，原分组 Cookie 不会复制过去。网页内尚未提交的临时状态不会随重载保留。
- 左侧面板固定展开时，复制标签等右键菜单操作及鼠标移出均不会隐藏标签列表；未固定的浮动面板仍会在菜单关闭且鼠标位于面板外时收起。
- 顶部按“后退、前进、刷新/停止、地址栏、收藏夹、历史、扩展、下载、菜单、窗口控制”排列。首次启动隐藏书签栏，已保存的书签栏偏好继续生效。
- 开启收藏夹栏后，完整标题区底部增加一行 32px 高的全宽收藏栏，地址栏和窗口按钮保持原高度；左侧标签面板与网页区域同步下移，关闭后恢复。收藏以站点图标和名称横向排列，可横向滚动或从右侧“更多收藏”打开全部收藏；设置页也保留收藏栏。
- 浏览器外壳获得键盘焦点时，F4 或 Ctrl+L 聚焦并选中地址栏；输入网址或搜索词后按 Enter 打开。收藏夹按钮右键可添加或移除当前网页。
- 交互控件使用 Sia 的 Button、Icon、Input、Tooltip、WindowFrame 和 WindowTitleBar，树状标签由这些自有组件组合。

## 轻量运行

Windows 网页使用 WebView2，无需应用自带完整 Chromium。恢复会话时后台网页保持休眠，点击后才加载；未使用的已加载标签在 1 小时后关闭对应 WebView 并保留标题、地址及分组，重新选择时从地址恢复。休眠会重新加载页面，页面内尚未提交的临时状态不会保留。实际内存用量取决于网站和当前运行的 WebView 数量。

网页内核主题跟随浏览器浅色/深色设置，覆盖系统颜色偏好和分组 Profile 以前保存的主题。切换主题会同步已打开网页；新建和休眠恢复的网页在导航前同步，包含 WebView2 内置错误页。窗口拖动贴靠或调整尺寸后，独立标签树重新布局时使用最新主题、标签和分组状态，不回退到初次挂载的快照。网站自行指定的配色仍由网站控制，不强制注入样式。主题回归使用 `scripts/test-browser-theme.cjs` 和隐藏原生探针 `cargo run --manifest-path scripts/fixtures/browser-extension-scopes/Cargo.toml --bin browser-theme-probe --target-dir <测试构建目录>`。

## 结构

- React 与 `@sia.soul/sia-react-ui` 负责无边框窗体、标签栏、地址栏、书签栏和新标签页。
- Tauri 主窗口关闭系统标题栏和系统阴影，由标签栏承担拖动和双击最大化；窗口边界使用 Sia WindowFrame 的细边框。
- 活动窗口的 1px 边框在浅色主题下为灰色（`#9ca3af`），深色主题下为蓝色（`#4096ff`）；失活后恢复默认边框。活动状态按原生主窗口判断，网页子视图获得焦点不会让活动边框消失。
- 主窗口四周保留 4px（1px 外框和 3px 内边距），网页、标签树和模态覆盖层均避开该区域，防止原生子视图遮住外框。鼠标命中缩放边缘时，该边显示 3px 橙色（`#fa8c16`）强调线；角落同时强调相邻两边，移开后恢复普通边框，悬停不改变内容布局。左侧标签树的宽度拖动线也使用同样的 3px 橙色。
- 普通窗口可从四条边及四个角拖动调整宽高，最小尺寸为 960×640；最大化时需先还原。Windows 多 WebView 模式在启动时显式创建 Tauri 原生缩放边缘，并在标签、侧栏或覆盖层改变层级后保持边缘可点击，中央区域镂空以保留网页交互。隐藏原生回归：`cargo run --manifest-path scripts/fixtures/browser-extension-scopes/Cargo.toml --bin browser-resize-probe --target-dir <测试构建目录>`。
- 每个真实网页标签使用独立的 Tauri 子 WebView，避免普通 `iframe` 的跨域和 `X-Frame-Options` 限制。
- 远程网页不在 capability 中，不能调用浏览器外壳的 Tauri IPC。

## 运行

```powershell
pnpm browser:dev
```

仅查看界面：

```powershell
pnpm browser:web
```

## 首版能力

- 无边框窗口和自绘最小化、最大化、关闭按钮
- 多标签页创建、切换与关闭
- 左侧“分组 / 小分组 / 标签”树形结构，支持固定展开及收起为紧凑列表
- 收缩列表停留 180ms 显示 Sia 气泡：标签页提供标题、网址和休眠/声音状态，分组提供完整名称及标签数量；移出、点击、滚动、Escape 或窗口失焦立即收起。桌面版使用不获取焦点且鼠标穿透的独立提示窗口，避免被网页子 WebView 遮挡。
- 小分组级 WebView2 数据目录：同一小分组内共享 Cookie、缓存和本地存储，不同小分组隔离；大分组直属标签使用独立的默认空间
- 地址识别、Bing 搜索、后退、前进、刷新、停止和主页
- 地址栏关闭原生表单保存信息提示和快捷键角标；在末尾键入网址时，按最近历史、收藏、已打开标签的顺序匹配并选中补全后缀，Tab 接受补全并保留焦点，Enter 导航且保留原始协议。无候选或按 Shift+Tab 时正常切换焦点；删除、粘贴、中间编辑及输入法组词不触发补全。F4 / Ctrl+L 仍可聚焦地址栏。
- 标题及地址随网页导航同步
- 标签图标优先使用网页内核实际加载的站点图标，支持自定义路径、分组登录 Cookie 和动态换图标；转成不超过 256 KiB 的 PNG 数据地址后交给展开/收缩标签树显示，并随会话保存供休眠标签使用。导航到其他文档时不沿用旧图标；旧会话尚无原生图标时兼容根目录 `/favicon.ico` 回退，加载完成后允许重试。回归使用 `scripts/test-browser-favicon.cjs` 和隐藏原生探针 `browser-favicon-probe`。
- `window.open` 请求转为新标签页
- 书签栏、亮暗主题和 Web 预览占位
- 密码设置使用 Sia 表格展示网站、账号、密码和更新时间；密码默认隐藏，可逐行显示/隐藏或直接复制，支持搜索、CSV 导入和删除。
- 网页登录输入框中的密码候选面板跟随浏览器当前 Sia 主题，背景、文字、边框、主色及滚动条同步更新，不单独跟随 Windows 深浅色设置。

分组菜单提供新增小分组、重命名等操作；顶部提供收藏、历史、下载和扩展列表面板。同一按钮再次点击关闭面板，点击其他按钮切换面板，切到其他应用或在面板外按下鼠标立即关闭。面板无开关动画及额外等待；收藏、历史、下载宽 360px，扩展宽 340px，更多菜单宽 240px（均为逻辑像素，不含阴影）。

Windows 菜单、工具栏面板和悬停提示使用普通附属窗口，不设置系统置顶。关闭时仅隐藏，不激活或重新排列主窗口；点击其他应用后，该应用保持在浏览器前面。原生层级回归使用 `browser-popup-order-probe`（同一探针 Cargo 工程），在不切换显示的独立测试桌面运行。

扩展采用“统一安装，按分组启用”：在设置 → 扩展程序 → 生效分组中选择所有分组、父分组或单独子分组。父分组覆盖其直属标签以及现有和以后新增的子分组；空选择保留安装但不在任何分组运行。旧记录默认所有分组，重装保留既有范围、总开关和固定状态。范围使用稳定 ID，重命名不改变授权；删除后重新创建的同名分组不会继承旧 ID 的授权。

工具栏面板和固定入口随当前标签的分组过滤。总开关仍为全局开关；不同隔离空间中的扩展本地数据独立。保存范围前，原生端校准所有被撤销授权的已有 Profile（包含休眠空间），成功后再保存新范围；失败保留旧配置。新网页在空白视图中完成扩展同步后才导航，防止旧安装接触目标页面。切换范围会关闭受影响网页，恢复时按新范围加载，其他分组保持原状。

范围回归：`node scripts/test-browser-extension-scopes.cjs <包含 playwright 的 node_modules 目录>`，使用独立无头浏览器。原生回归：`cargo run --offline --manifest-path scripts/fixtures/browser-extension-scopes/Cargo.toml --target-dir <测试构建目录>`，使用隐藏窗口、临时 Profile 和本地测试扩展，验证内容脚本、后台脚本及撤销后恢复，不访问用户浏览数据。

扩展面板显示图标、名称、启停状态及固定/更多操作。固定状态持久化，工具栏快捷入口打开扩展选项页，没有选项页时打开扩展管理。更多菜单支持全局启停、扩展选项、固定、管理和确认移除；底部提供管理及 Edge 扩展商店入口。扩展列表提前加载以缩短首次点击等待。当前未提供站点级权限切换或扩展 action 弹出窗口，界面不将全局启停标成网站权限。隐私模式、完整网站权限管理、崩溃恢复和自动更新仍需进一步完善。

## 小分组隔离升级

浏览数据保存在 `browser-profiles-v2` 下，目录由大分组和小分组的稳定 ID 决定，重命名不改变登录状态。新建、会话恢复、休眠唤醒和地址导航均使用对应的小分组目录；标签跨数据空间移动时重建 WebView。

旧版 `browser-profiles` 中混合的大分组数据予以保留，不复制到各小分组，也不自动删除。升级后网页需要重新登录；标签树、网址、书签和已保存的密码不受此目录变更影响。

## 验证与构建

### 收藏夹导入与快捷键

收藏夹面板右上角的“导入收藏夹”入口检测当前 Windows 用户标准配置目录中的 Edge、Chrome、Firefox、Brave、Vivaldi、Opera、Chromium、QQ 和 360 浏览器数据。多个用户配置分别显示；非标准位置或尚未创建收藏数据的配置不保证自动发现。导入前选择根目录或任意已有文件夹，也可填写一个新子文件夹名称。导入仅追加，保留来源目录、同级顺序和中文名称，不覆盖已有收藏，不修改来源文件；重复导入会追加另一份。文件夹和收藏链接一并持久化，兼容旧版平面收藏列表。

前端和 WebView2 原生快捷键共用 `src/browserShortcuts.json`：Ctrl+J 下载、Ctrl+H 历史、Ctrl+Shift+O 收藏夹、Ctrl+D 收藏当前页、Ctrl+Shift+D 收藏全部网页、Ctrl+Shift+B 收藏栏；Ctrl+T 新建、Ctrl+Shift+T 恢复、Ctrl+W/Ctrl+F4 关闭、Ctrl+Shift+K 复制、Ctrl+M 静音；Ctrl+Tab/Ctrl+Shift+Tab 和 Ctrl+PageDown/Ctrl+PageUp 切换标签，Ctrl+1～8 定位、Ctrl+9 最后一个；Ctrl+L、Alt+D、F4、Ctrl+E、Ctrl+K 聚焦地址栏。独立 Tree 和工具面板转发到同一外壳入口，长按不重复触发。WebView2 中的查找、打印、缩放和文本编辑继续由内核处理，不全局关闭浏览器加速键。

`scripts/test-browser-bookmark-import.cjs` 和 `scripts/test-browser-download-shortcut.cjs` 使用虚构来源与原生桥验证导入和快捷键，需要本机 1440 端口开发服务与 `NODE_PATH` 中的 Playwright；原生 `cargo test --lib` 覆盖 Chromium/Firefox 解析、配置检测和快捷键映射。

桌面启动使用异步就绪屏障：原生壳层及辅助视图预加载完成后，才挂载主界面并恢复页签。`test:startup` 使用真实发布 EXE 和独立临时资料目录检查首次启动、恢复网页和原生线程响应；运行环境需要 Playwright。输入消息压力测试使用 `test:input-reentrancy`，两类检查不能相互替代，详见 [Windows 未响应诊断](docs/windows-input-hang.md)。

收缩页签的气泡使用独立只读原生窗口覆盖网页，显示时不激活窗口，移出时立即关闭。`node scripts/test-browser-native-tooltip.cjs [EXE路径]` 使用独立资料、本地网页和系统鼠标验证首次及重复悬停、窗口层级和焦点；需要通过 `NODE_PATH` 提供 Playwright。测试会短暂激活诊断窗口并移动鼠标，结束后还原指针，只关闭自己创建的测试进程。

```powershell
pnpm --filter @sia-ui/browser typecheck
pnpm check:api-docs
cargo test --release --lib --manifest-path apps/browser/src-tauri/Cargo.toml
pnpm browser:build
```

`browser:build` 生成桌面可执行文件，不发布框架包。仓库 `.cargo/config.toml` 将原生构建目录设为 `D:/SiaBuild/SiaWebUI/target`，默认 EXE 为 `D:/SiaBuild/SiaWebUI/target/release/sia-browser.exe`。其他机器可修改此配置或通过 `CARGO_TARGET_DIR` 覆盖；打包和回归脚本读取 Cargo 的有效目录。

前端构建输出位于 `D:/SiaBuild/SiaWebUI/frontend-dist/browser`，Vite 配置与 Tauri 的 `frontendDist` 必须同步修改。`frontendDist` 使用路径数组以强制内嵌资源：Windows 盘符绝对路径写成单个字符串会被 Tauri 解析成 URL，导致安装版无法加载界面。Vite 预打包缓存位于 `D:/SiaBuild/SiaWebUI/vite-cache/browser`，TypeScript 增量缓存位于 `D:/SiaBuild/SiaWebUI/typescript/browser.tsbuildinfo`。Cargo 子进程的 `TEMP`/`TMP` 指向 `D:/SiaBuild/SiaWebUI/target/tmp`，首次在其他机器使用时需先创建该目录。以上设置迁移本应用构建产物与缓存，不迁移 C 盘源码、已安装工具链或包管理器的全局依赖缓存。

`pnpm browser:bundle` 重新构建 EXE 并生成 Inno Setup 中文安装版：可选择安装目录、创建桌面快捷方式，按需安装 WebView2，支持后续覆盖升级及卸载保留数据。产物和 SHA-256 校验文件位于有效构建目录的 `release/bundle/inno`，默认是 `D:/SiaBuild/SiaWebUI/target/release/bundle/inno`；打包临时文件也写入该构建目录。首次从旧 NSIS 安装版转换时，向导自动卸载旧程序并保留浏览数据，无需手动操作，详见 [安装包说明](installer/README.md)。

`browser:web` 可预览树状标签、新增/切换/关闭标签、面板收起/展开和地址输入；网页内容、分组管理弹窗及收藏/历史/下载原生菜单需要桌面版。Web 预览不会使用 iframe 代替真实网页内核。
