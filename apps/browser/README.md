# 西娅浏览器 · Sia Browser

西娅浏览器 是基于 Sia WebUI 与 Tauri 2 的桌面浏览器，Windows 版本使用系统 WebView2 运行时。

Windows 版本使用 Tauri 2.12 / Tao 0.37 的输入处理实现，避免键盘与焦点消息重入造成主线程死锁。原生压力测试运行 `pnpm --filter @sia-ui/browser test:input-reentrancy`；诊断依据和复现方式见 [Windows 未响应说明](docs/windows-input-hang.md)。

## 名称与图标

程序显示名为“西娅浏览器”（Sia Browser），Windows 主进程为 `sia-browser.exe`，安装包为 `Sia-Browser-Setup-0.1.0-x64.exe`。品牌采用 05 版圆环飞燕：蓝青色羽翼与鸟身围成紧凑的圆形轮廓，内部留白形成 S 曲线，不叠加独立文字。所有图标均为透明背景；标题栏和新标签页使用横向字标，桌面、安装器与标签的小尺寸图标使用透明方形画布，按原比例居中显示签名。网页与原生图标均使用图稿本身的亮色，不依赖主题滤镜。

图标源文件为 `branding/sia-browser-source.png`，通过 `cargo tauri icon` 生成桌面图标；`public/brand` 保存网页图标和透明字标。运行 `node branding/build-signature-assets.cjs <sharp 模块路径>` 可从正式图稿重新导出网页尺寸与 1024px 桌面源图，再运行 `cargo tauri icon branding/sia-browser-source.png --output src-tauri/icons` 更新平台图标。应用标识 `com.sia.browser`、内部 `sia://` 地址和数据文件名保持稳定，不会另建用户数据空间。

正式图稿与生成提示词见 [S1-E 品牌记录](branding/signature-s1e.md)。此前的图标源图保留在 `branding/sia-browser-source-before-s1e.png`；旧版抠图脚本不用于新字标。

Windows 安装完成后会更新已有品牌任务栏快捷方式，将已知旧安装目录及开发构建目录迁移到当前安装目录，并使用 `app-sia-swift-05.ico` 避免沿用旧图标缓存。迁移保留固定项目和启动参数，不操作其他软件的链接；隔离验证包跳过真实任务栏迁移。打包会核对 EXE 内嵌的全部图标帧与正式 ICO 是否一致。

## 左侧树状标签与单行导航

- 仅支持左侧“环境分组 → 小分组 → 标签页”树形布局；旧会话的顶部标签布局偏好自动忽略，已有标签、分组与当前页面继续恢复。
- 环境名称使用分组颜色，小分组显示文件夹图标；两级分组均支持折叠、新建标签和“更多”菜单，菜单也可通过右键打开。小分组菜单依次为“新建标签页、重命名、分割线、删除小分组”；浏览数据清理仅在一级分组菜单提供。顶部新增入口统一显示“新建标签页”。
- 活动标签显示左侧色条，未激活的休眠标签显示“休眠”；支持关闭标签、收起为紧凑列表及拖动调整宽度。收缩面板不会因鼠标悬停自动展开，只能点击面板内的展开按钮恢复。
- 展开的标签树支持拖动页面到其他小分组、大分组标题或底部“移出分组”区域。目标高亮，悬停折叠分组约 650ms 后展开；拖到列表边缘可以滚动。移动后保持当前选中页，目标分组展开并保存归属。同一分组内投放不触发重载；跨数据空间会关闭旧 WebView，当前网页按目标分组重新加载，后台网页继续休眠，原分组 Cookie 不会复制过去。网页内尚未提交的临时状态不会随重载保留。
- 展开和收缩面板均支持拖动大分组标题排序；小分组可以同级排序或整体移入其他大分组。拖动时显示插入线或目标描边，页签顺序与已打开的网页保持不变。小分组整体迁移保留其原数据空间和扩展权限，后续新建、复制页签继续使用该空间。
- 将单页签、大分组或小分组拖出浏览器后松开，可移入一个独立浏览器窗口；Escape 取消和窗口内的无效落点不会拆窗。新窗口与原窗口由同一进程管理，直接转移现有 WebView，不重新导航；保留页面内存、未提交表单、滚动位置、播放进度，以及分组名称、顺序和静音设置。网站自身对焦点、可见性和尺寸变化的响应仍会执行。新窗口确认接收后才移除原项，启动失败保留源树。移走所有页签时原窗口保留一个根级空白页。
- 独立窗口分别保存会话；主动关闭的窗口不再恢复，程序中断后下次启动会恢复尚存会话，冷启动恢复仍需重新加载网页。关闭原主窗口不会关闭其他浏览器窗口；系统打开网址或 HTML 文件优先交给主窗口，主窗口已关闭时交给仍存活的浏览器窗口。
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

下载列表按下载开始时间倒序排列，进度更新和完成顺序不参与排序。Windows 内核在创建下载时固定开始时间并生成跨重启唯一的身份；主窗口、下载浮层及跨窗口事件重放使用相同时间，保存和恢复后保持排序。同一毫秒内的连续下载使用递增毫秒区分先后。旧版没有开始时间的记录仍按原保存顺序兼容恢复，不根据文件名中的数字猜测时间。`scripts/test-browser-download-time.cjs` 验证原生时间优先、乱序事件和浮层实际列表顺序；`cargo test --lib download_identity::tests` 检查身份与时间生成。

从资源管理器拖入 `.html` / `.htm` 文件时，左侧标签树沿用页签拖动的目标分组高亮和 4px 插入线，支持小分组、大分组直属区域、空分组与根级区域。松手后在指示位置新建标签；移出侧栏或结束拖动会清除反馈。文件路径仍通过原生 File 对象读取，外部网页不能指定分组；拖到网页区域仍按原有规则在根级新建。`scripts/test-browser-file-drop-position.cjs` 使用虚构文件和原生桥检查显示位置、创建顺序及提示清理，可通过 `BROWSER_TEST_URL` 指定开发服务地址。

### 收藏夹导入与快捷键

收藏夹栏的目录使用 Sia Dropdown 和 link 模式触发按钮，普通收藏使用 link Button。点击目录在按钮下方显示该目录的紧凑菜单，网站项显示图标，子目录悬停时侧向级联展开，长列表可滚动；空目录显示提示。桌面版将菜单内容交给原生浮层呈现，避免被网页 WebView 遮挡，原生关闭及切换入口会回传 Dropdown 展开状态。工具栏收藏按钮和 Ctrl+Shift+O 仍打开完整收藏管理面板。`scripts/test-browser-bookmark-folder.cjs` 验证定位、组件模式、目录范围、悬停、键盘触发、空目录及完整入口。

收藏夹面板右上角的“导入收藏夹”入口检测当前 Windows 用户标准配置目录中的 Edge、Chrome、Firefox、Brave、Vivaldi、Opera、Chromium、QQ 和 360 浏览器数据。多个用户配置分别显示；非标准位置或尚未创建收藏数据的配置不保证自动发现。导入前选择根目录或任意已有文件夹，也可填写一个新子文件夹名称。导入仅追加，保留来源目录、同级顺序和中文名称，不覆盖已有收藏，不修改来源文件；重复导入会追加另一份。文件夹和收藏链接一并持久化，兼容旧版平面收藏列表。

前端和 WebView2 原生快捷键共用 `src/browserShortcuts.json`：Ctrl+J 下载、Ctrl+H 历史、Ctrl+Shift+O 收藏夹、Ctrl+D 收藏当前页、Ctrl+Shift+D 收藏全部网页、Ctrl+Shift+B 收藏栏；Ctrl+T 新建、Ctrl+Shift+T 恢复、Ctrl+W/Ctrl+F4 关闭、Ctrl+Shift+K 复制、Ctrl+M 静音；Ctrl+Tab/Ctrl+Shift+Tab 和 Ctrl+PageDown/Ctrl+PageUp 切换标签，Ctrl+1～8 定位、Ctrl+9 最后一个；Ctrl+L、Alt+D、F4、Ctrl+E、Ctrl+K 聚焦地址栏。独立 Tree 和工具面板转发到同一外壳入口，长按不重复触发。WebView2 中的查找、打印、缩放和文本编辑继续由内核处理，不全局关闭浏览器加速键。

`scripts/test-browser-bookmark-import.cjs` 和 `scripts/test-browser-download-shortcut.cjs` 使用虚构来源与原生桥验证导入和快捷键，需要本机 1440 端口开发服务与 `NODE_PATH` 中的 Playwright；原生 `cargo test --lib` 覆盖 Chromium/Firefox 解析、配置检测和快捷键映射。

分组拖动回归运行 `node scripts/test-browser-group-drag.cjs <Playwright 所在 node_modules 目录>`。原生原样迁移回归运行 `node scripts/test-browser-live-transfer.cjs <Playwright 所在 node_modules 目录> [EXE路径]`，检查同一 Document、中文表单、页面内存、滚动、媒体播放、后台页、失败回滚、跨窗事件隔离、原窗口关闭与再次拆窗。`node scripts/test-browser-detached-session.cjs [EXE路径]` 不启用调试端口，检查拆窗不重载及中断后的会话恢复。所有测试使用隔离资料目录和本地测试网页，只终止自己启动的进程。

桌面启动使用异步就绪屏障：原生壳层及辅助视图预加载完成后，才挂载主界面并恢复页签。`test:startup` 使用真实发布 EXE 和独立临时资料目录检查首次启动、恢复网页和原生线程响应；运行环境需要 Playwright。输入消息压力测试使用 `test:input-reentrancy`，两类检查不能相互替代，详见 [Windows 未响应诊断](docs/windows-input-hang.md)。

收缩页签的气泡使用独立只读原生窗口覆盖网页，显示时不激活窗口，移出时立即关闭。`node scripts/test-browser-native-tooltip.cjs [EXE路径]` 使用独立资料、本地网页和系统鼠标验证首次及重复悬停、窗口层级和焦点；需要通过 `NODE_PATH` 提供 Playwright。测试会短暂激活诊断窗口并移动鼠标，结束后还原指针，只关闭自己创建的测试进程。

### 统一交互浮层

收藏夹、下载、历史记录、右键菜单、更多和扩展面板共用 `browser-menu` 原生浮层及 `BrowserFloatingHost`。宿主统一处理主题、根面板尺寸、浮动滚动条、透明区域和关闭逻辑；各业务面板继续使用原有 Sia 组件及动作。该窗口可覆盖网页 WebView，同时支持搜索输入、按钮和子菜单。只读标签气泡保持不获取焦点，交互浮层允许输入获取焦点。

原生层先隐藏并清空旧形状，收到当前显示批次的首轮真实表面测量后再显示；同批次测量带递增序号，旧面板、关闭后或乱序的回传均被忽略。各根面板宽度独立于子菜单预留画布，扩展操作菜单在父面板侧边展开，下载右键菜单根据实际尺寸避让窗口边缘。子层没有全窗遮罩，点击父面板可直接继续原操作。浮动滚动条沿用框架组件，不新增常驻滚动条。

重复点击同一入口关闭面板，切换入口替换当前内容；Escape 优先关闭子层。点击外部、切换到其他程序、移动或调整主窗口时收起浮层；隐藏不重新激活或置顶主窗口。从面板内部开始的滚动条拖动不会因指针越界而误关。下载实时进度、收藏夹新标签打开、历史记录搜索、扩展分组过滤及固定、启停、移除确认保持现有逻辑。

`scripts/test-browser-floating-host.cjs` 通过虚构桥接和无头浏览器验证六类面板、旧快照与关闭竞态、子层左右避让、下载搜索和进度更新；`scripts/test-browser-menu-hit-regions.cjs` 验证可见表面回传。两者接受 `BROWSER_TEST_URL`，需要通过 `NODE_PATH` 提供 Playwright。原生 `cargo test --lib floating_windows::tests` 验证显示批次、关闭条件、画布和 DPI 区域，不操作桌面。无头测试不能替代真实 Windows 窗口之间的点击与遮挡验收。

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

### 开发者工具停靠（Windows）

网页或外壳获得焦点时，按 `F12` / `Ctrl+Shift+I` 默认将开发者工具放在网页下方。拖动 Sia Splitter 分隔条可调整大小，右键分隔条可选择底部、右侧、独立窗口或关闭；从独立窗口切回主界面按 F12 可重新停靠同一会话。每个标签保存自己的工具窗口，切到其他标签时隐藏后台工具，调试期间暂缓该标签的自动休眠，关闭工具后网页恢复全部区域。设置页、新标签页等没有原生网页视图的页面不会创建工具。

停靠时仅显示开发者工具内容，隐藏原生蓝色标题栏及四周窗框，不额外显示西娅标题工具栏。内容范围取自实际网页渲染子窗口，随 DPI 和面板尺寸同步，不使用固定像素高度遮盖；切换为独立窗口时恢复原来的标题栏及窗口区域。

网页尺寸按当前标签同步：从打开工具的标签切换到未打开工具的标签时，网页恢复全部可用空间；切回原标签则恢复停靠区域。原生网页异步创建或激活完成后会重新测量布局，避免旧标签的停靠尺寸覆盖当前页面。

WebView2 没有公开的停靠 API，此处使用 Windows 子窗口接入，未开启远程调试端口。仅接入当前网页内核进程中新出现、文档地址匹配且归属明确的工具窗口；切换标签会撤销未完成的认领。DPI 模式不兼容、窗口没有响应、同时出现多个候选或已有未登记的独立工具时保留独立窗口。原生右键“检查”及内核其他控制台入口仍可能打开独立工具；关闭该独立窗口后使用 F12 即可经过停靠流程。不要将这些入口的独立窗口视为停靠失败后必须强制接管的对象。

`scripts/test-browser-devtools.cjs` 覆盖底部/右侧布局、分隔拖动、标签切换、独立窗口、关闭与回退，并检查网页宿主不被重新挂载。真实 WebView2 回归使用 `cargo run --locked --release --manifest-path scripts/fixtures/browser-extension-scopes/Cargo.toml --bin browser-devtools-probe`，使用 D 盘临时资料检查两个共享进程的标签、父窗口、实际 DPI 坐标、后台隐藏、关闭重开及未知窗口回退；工具初始化期间可能短暂出现测试 DevTools，不读取现有浏览器资料。

### 网页框架刷新（Windows）

在 iframe 内容中右键，默认菜单的“刷新”下方显示“刷新框架”，只重新加载本次右键所在文档。普通“刷新”和 Ctrl+R 仍刷新整个标签页。该入口使用原生 WebView2 框架对象，支持同地址兄弟框架、跨域及嵌套框架，不按 URL 推测目标，也不阻止网页原有的右键事件。网页自己取消默认菜单时继续尊重网页行为。

打开菜单后框架发生导航或被移除时，旧命令不会刷新替代文档。定位异步完成，最多等待两秒；无法可靠定位时保留默认菜单，不回退到刷新整个页面。嵌套框架跟踪依赖支持 `ICoreWebView2Frame7` 的 WebView2 Runtime。

原生回归先运行 `cargo build --release --manifest-path scripts/fixtures/browser-extension-scopes/Cargo.toml --bin browser-frame-menu-probe`，再运行 `node scripts/test-browser-frame-menu.cjs`（需通过 `NODE_PATH` 提供 Playwright）。测试仅使用 D 盘独立资料目录，验证同地址框架、跨域嵌套、动态框架、网页取消菜单后的定位，以及主页面表单保留，不访问用户现有浏览资料。

### 下载进度与控制

下载面板的活动项显示已接收量、已知总量和实时速率，速率按实际接收字节与单调时钟每秒采样，停流后归零。已知总量时以框架 Progress 组件在整行背景绘制浅绿色进度，左边 0%、右边 100%；未知总量不显示虚假的百分比。暂停保留当前进度，取消或完成后移除进度背景。

准备确认及下载中的项提供暂停、继续和取消，控制操作不关闭面板。等待确认时暂停仅保持等待，不开始网络传输；实际下载通过 WebView2 Pause/Resume/Cancel 控制。用户暂停不会标记为失败或释放下载句柄；终态才释放句柄。取消显示“已取消”，重试按原始地址发起新的下载，保留原记录；下载开始时记录原分组与小分组，原网页关闭、切换分组后仍沿用原隔离环境；原分组已删除或旧记录无法确认来源时提示从原网站重新下载。服务器地址过期、需要重新登录或原请求依赖 POST 数据时，重新打开原始地址可能需要再次从网站发起下载。

`scripts/test-browser-download-retry-scope.cjs` 验证关闭原网页并切换分组后的重试隔离；`scripts/test-browser-download-controls.cjs` 验证实时速率、整行背景和按钮状态；`scripts/test-browser-download-native.cjs` 使用独立资料及支持 Range 的限速测试服务，验证暂停后字节停止、恢复完成、取消、原地址重试及等待确认阶段的控制。

下载终态通过事件即时更新，并在有未结束任务时每秒串行核对内核状态。内核快照确认完成后，列表显示“已完成 / 打开文件”，移除行背景和工具栏进度；字节达到 100% 不代表内核收尾完成。原生句柄释放后仍可补取终态快照，统计字段读取失败不会吞掉终态，旧进度不能覆盖完成状态。`scripts/test-browser-download-completion.cjs` 覆盖完成通知漏送、100% 但仍传输中、终态后迟到进度及工具栏同步。

Windows 网页导航使用 WebView2 的 NavigationStarting / NavigationCompleted 编号关联：发起请求即显示 loading，旧请求被新导航替代后的结束事件不覆盖地址；重定向保留同编号的最新目标，失败时保留本次输入地址，hash/history 同文档跳转单独同步地址。`scripts/test-browser-address-navigation-native.cjs` 使用本地慢响应、断开连接和重定向验证真实回车导航。


### 网页右键菜单外观

网页右键菜单使用 SiaWebUI Menu 与浏览器共用浮层展示，采用单层轻阴影，并随外壳切换浅色/深色主题。菜单内容递归读取 WebView2，包括链接、图片、编辑命令、禁用/勾选状态、快捷键、扩展 PNG 图标及子菜单；选中后将命令编号交回内核执行。框架定位完成后再补入“刷新框架”，不重载主页面。

菜单支持上下键选择、右键展开、左键返回和 Enter 执行。点击外部、Escape、导航或关闭网页都会结束对应内核菜单请求；请求编号按窗口校验，旧浮层的迟到操作不能执行新菜单命令。原生窗口关闭系统阴影，仅保留 CSS 阴影及已有的可见区域命中处理。

真实运行回归：先执行 `pnpm --filter @sia-ui/browser tauri:build:bin`，再执行 `node scripts/test-browser-web-context-native.cjs <包含 playwright 的 node_modules 绝对路径>`。测试使用独立资料和本地网页，验证框架菜单、轻阴影、普通刷新、iframe 精确刷新、链接菜单、悬停子菜单、取消重开、导航清理和主题。
