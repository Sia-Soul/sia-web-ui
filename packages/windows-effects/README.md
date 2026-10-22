# SiaWebUI Windows 鼠标特效扩展

为 Windows 桌面宿主提供可复用的鼠标可视层。业务项目通过 `ProjectReference` 引用，不复制组件源码。
需要 .NET 10 Windows Desktop，在 WPF UI 线程创建和调用。

```csharp
using SiaWebUI.Windows.Effects;

// 宿主负责生命周期；退出时必须释放以移除全局鼠标钩子。
using var effects = new EffectsWindow();
effects.Configure(new EffectOptions {
    Trail = true, Color = "#9878F0", Intensity = 2,
    Click = "水波纹", LeftColor = "#6EB7EE",
    RightClick = "彩纸礼炮", RightColor = "#F58FAE"
});
```

`Configure(options, paused: true)` 隐藏窗口、移除钩子并清空粒子；传入 false 恢复。
窗口不激活、穿透点击，不出现在任务栏，所有钩子事件继续传递。
坐标按虚拟桌面物理像素读取，再转换到窗口 DIP；绘制时每两秒检查显示器布局，空闲后首次点击也会补查。
混合粒子及流光段总数上限240，其中贴图最多96张、流光最多48段；没有存活效果时不请求画布重绘。
未开启星光、定位、聚光灯或待机时，动画使用 `CompositionTarget.Rendering` 跟随 WPF 绘制节奏，跳过同一呈现时间的重复回调，不再使用 16ms 定时器驱动动画。只开启点击效果时，粒子清空后取消绘制订阅，新点击自动唤醒；暂停和退出同样取消订阅。动态覆盖层为512×512 DIP；指针靠近边界时重定位并平移现有粒子坐标。高速移动离开局部区域的旧粒子可能被裁掉，避免绘制面积随轨迹增长到整个桌面。
`EffectsWindow.IsAnimating` 只读返回当前是否运行动画驱动；可用于检查空闲和暂停状态，系统自身触发的窗口重绘不算主动动画订阅。
`ParticleCanvas.FrameRendered` 是可选诊断事件，返回画布创建以来的时间，用来统计 WPF 绘图命令提交间隔；它不是显示器实际呈现帧率。回调在 UI 线程执行，应保持轻量。
`ParticleCanvas` 支持由宿主驱动 `Advance()`，内部按经过时间计算动画。
水波纹单圈 320ms，相邻圈错开 40ms，最多三圈。礼炮碎片使用对应按键颜色。
水波纹线宽从 4 DIP 随扩散渐细到 1 DIP，同时按原有透明度淡出。
`Click` / `LeftColor` 配置物理左键，`RightClick` / `RightColor` 配置物理右键；独立设置为“无”可关闭任一键。
`Color` 配置拖尾。为兼容旧配置，未指定右键类型时沿用 `Click`，未指定左右颜色时沿用 `Color`。宿主读取旧文件后可将这些回退值补齐保存，之后各自独立修改。
Windows 交换主按钮不交换这里的物理按键含义。`ParticleCanvas.Click(point, options, right: true)` 渲染右键效果，省略 right 则渲染左键。
`Startup` 仅是宿主偏好字段，扩展不写注册表，不设置登录启动。
安全桌面和部分独占全屏界面不支持覆盖绘图。

API 文档使用中文 XML 注释，构建时生成可供 .NET 编辑器悬停读取的 XML 文件。

## 进阶效果

`EffectOptions.Charge`、`ThemeParticles`、`Locator` 是独立配置，默认 `Enabled=false`，旧 JSON 缺省字段继续关闭。

| 配置 | 参数与默认值 |
| --- | --- |
| Charge | Button=left（left/right/both）；DelayMs=250（100～1000）；FillMs=700（200～2000）；Radius=32 DIP（16～64）；Color=#9878F0；Release=true |
| ThemeParticles | Trigger=click（click/move/both）；Theme=auto（宿主解释）；Amount=6（2～16）；Size=24 DIP（12～48）；LifeMs=900（300～1800） |
| Locator | DoubleTapMs=400（200～800）；Radius=80 DIP（40～180）；DurationMs=1200（600～3000）；Color=#6EB7EE；Dim=0（0～0.65） |

蓄力环在等待时间结束后填充，短按不会出现释放环；按键消息继续传递，缺失释放消息时通过按键状态收尾。`ParticleCanvas.BeginCharge/EndCharge` 可用于自定义宿主驱动，`UpdatePointer` 更新光环中心。

宿主调用 `SetThemeSprites(IEnumerable<BitmapSource>)` 提供透明位图，最多16张。框架克隆冻结并缓存，等比绘制；不在每帧解码。`Theme` 仅为宿主元数据，框架不读取业务主题目录。`EmitTheme` 根据触发模式筛选，点击间隔至少35ms、移动间隔至少45ms，移动每批为 Amount/4（最少1个）。原有粒子、贴图与流光共享240上限；移动每批最多2张，贴图最多96张。画笔与颜色按有限缓存复用，贴图绘制不逐帧创建旋转对象。

定位使用独立线程的 `WH_KEYBOARD_LL` 钩子识别两次 Ctrl 按下与松开。左右 Ctrl 均支持；其它按键参与、重叠双 Ctrl、350ms以上长按及自动重复不会触发。DoubleTapMs 控制两次松开之间的最大间隔。旧 JSON 的 Hotkey 字段忽略，迁移保留 Enabled、颜色、时长等偏好。关闭、暂停和 Dispose 释放钩子，不注册组合快捷键，也不吞掉系统事件。

`CtrlDoubleTap.Feed(key, down, milliseconds, interval)` 是可隔离测试的识别器，使用单调毫秒时间，只有第二次有效 Ctrl 松开返回true；`Reset` 清除状态。

鼠标与键盘钩子共享独立的消息泵线程；回调只复制事件并异步投递到绘图线程，始终继续传递。`Configure` 安装失败抛出Win32Exception。`Locate()` 读取当前坐标并重置定位时长，未启用或暂停时返回false，不产生输入。

定位与聚光灯使用一个固定在虚拟桌面上的原生分层窗口，黑色背景、透明圆孔和定位圈保存在同一张预乘透明DIB中，由 `UpdateLayeredWindowIndirect` 一次提交。移动时只更新旧圆孔和新圆孔的包围区域；静止且内容不变时不提交。窗口不随鼠标搬动，没有四块外围窗口与局部WPF画布的异步拼接。自然到期、暂停和关闭直接隐藏整个定位图层，避免退出时残留方块。只有尺寸或背景透明度改变以及重新显示时才初始化全幅像素。

定位、聚光灯、待机或星光启用时采用8ms目标间隔的轻量时钟，实际频率受系统调度影响；定位空闲时停止，双击Ctrl唤醒。所有窗口穿透点击且不激活。`DynamicPixelArea` 只统计粒子局部窗口，不包含原生定位位图；定位位图按虚拟桌面大小分配并复用，框架不截取桌面内容。独立使用 `ParticleCanvas` 的预览仍保留WPF定位绘制。

`Configure` 每次成功更新都会清空当前动画。仅蓄力、点击粒子或定位启用时空闲取消逐帧订阅，下次事件唤醒；移动粒子与拖尾需要持续采样指针。`HasAdvancedActivity`、`ChargeCount`、`LocatorVisible` 提供画布只读诊断。

## 流光与尾端

`Trail` 生成外层柔光、彩色细线和细亮芯三层连续轨迹，340ms内逐渐收细淡出，超过220 DIP的瞬移不连线。点击水波纹和蓄力仍锚定热点，礼炮与主题贴图从尾端发射。

覆盖层通过 GetCursorInfo/GetIconInfo 读取实际指针，按可见底边与热点计算尾端，忽略透明留白。位图计算按句柄缓存，每两秒失效，支持系统复用句柄后更换大小。`ParticleCanvas.FindTailOffset(image, hotspot)` 返回物理像素偏移；绘制前按当前DPI转为DIP。无可见像素返回零；系统读取失败使用保守右下偏移。获取的GDI位图及时释放，不销毁系统拥有的指针句柄。

`ParticleCanvas.Click(point, options, right, particleOrigin)` 可单独指定礼炮发射点，省略时继续使用point；水波纹始终在point。宿主自驱动Trail时传入尾端坐标。

## 附加效果

`EffectOptions.Extras` 提供 Elastic、RightElastic、Stars、Ribbon、Expression、Drag、Wheel、Spotlight、Crosshair、Idle、Speed，均为独立的 `AccentOptions`，默认关闭。字段含义、单位及每项默认值在源码XML注释中列出。UI只显示该效果实际使用的参数；验证拒绝空配置、越界数值及未知样式。

`Extras.Crosshair` 提供十字辅助线：水平线、垂直线在系统鼠标热点交叉，延伸到当前显示器的完整边缘（含任务栏区域），跨屏时切换显示器。默认关闭，颜色 `#52C7FF`、线宽 `Thickness=2` DIP、不透明度 `Opacity=0.6`，可设置1～8 DIP与0～0.65不透明度。通过 `EffectsWindow.Configure` 更新；旧JSON缺少该字段时保持关闭。宿主负责保存配置，单独使用 `ParticleCanvas` 不绘制此桌面效果。

辅助线通过两条细长原生分层窗口绘制，以物理屏幕坐标和当前显示器DPI定位，支持负坐标副屏；交点不重复混合透明度。绘制量与屏幕宽高之和成比例，不分配整屏位图。独立8ms目标时钟采样鼠标，静止时跳过重复提交；实际频率取决于系统调度。窗口不激活、穿透点击、不显示在任务栏；关闭、暂停或Dispose释放线条窗口与位图。

`TrackExtras(hotspot, tail, options)` 逐帧处理轨迹、拖拽阈值、聚光灯和待机计时；`ExtraDown/ExtraUp` 处理物理按键，`ExtraWheel` 接收原始有符号滚轮增量和横向标志。覆盖层自动接入这些事件，不吞掉点击、拖拽和滚动。待机开启时键盘输入会重新计时，不记录键入内容。

`SetAccentSprites` 需要三个表情位图和当前主题两帧待机位图，复制冻结后缓存。小伙伴出现于尾端旁，保持系统原指针可用；不会替换全局指针。弹性光圈仍位于热点；轨迹、星光与小表情位于尾端。

附加图案最多64个、轨迹最多64段，与原有粒子共享240总上限。星光、表情分别按IntervalMs限流；粒子、画笔与位图缓存均有数量上限。暂停和退出清空状态、释放钩子及原生遮罩窗口。聚光灯开启后持续显示；临时定位优先使用定位圈与暗度，结束时恢复聚光灯。

星光在出生时记录物理屏幕坐标及当时的DPI，不参与跟随窗口的重定位补偿；出生后只在原位缩小淡出。桌面宿主使用256物理像素网格和图案边距，最多8个可见固定透明窗口，不做全屏重绘。空闲网格隐藏，最多缓存16个位置，来回移动时复用；窗口存活期间不搬动。超过可见网格预算时淘汰最早的远处星光；星光仍属于64项附加效果和240项混合预算。星光网格采用原生分层窗口及预乘透明位图，不创建独立WPF渲染目标；四角星缓存64级缩小淡出纹理。暂停和退出释放窗口、位图与DC。开启星光、定位、聚光灯或待机时使用8ms目标间隔的DispatcherTimer驱动原生图层，实际间隔取决于系统调度；四者都关闭时恢复WPF呈现事件。只有星光时不重画空白主画布，避免空闲WPF呈现节流；`ParticleCanvas.FrameRendered` 仅统计该画布，不统计固定星光窗口。

业务项目可使用 `Extras.Spotlight.Enabled` 实现托盘快捷开关，避免额外占用全局快捷键。Windows扩展不自行写入用户偏好。

待机伙伴在出现时固定屏幕位置。检测到任何鼠标位移（包括高DPI下一个物理像素）后，冻结退出瞬间的图案、位置和尺寸，立即开始180ms原位渐隐；持续移动不会重启渐隐。点击、滚轮和键盘操作同样打断待机；停止操作并再次达到等待时长后重新出现。桌面宿主使用独立原生小图层与有限贴图缓存，暂停或退出立即清理。待机启用时也使用原生图层时钟。

拖动提示在物理按键释放时重新检查剩余按键，并主动请求透明帧，确保没有其他动画或鼠标移动时也立即消失。

滚轮反馈始终保留一个箭头或折线图案，横向和纵向输入共用该实例；每次输入立即更新方向、位置并续期，不叠加。图案以600ms周期围绕基准位置上下轻浮动（横向滚轮左右浮动），单侧幅度4 DIP，连续输入不重置浮动相位。停止后的存活时间由DurationMs决定，末段淡出；IntervalMs仅保留旧配置兼容，不参与滚轮反馈。

弹性光圈的 `Extras.Elastic` 为物理左键，`Extras.RightElastic` 为右键，开关、颜色、半径、时长、弹性、线宽均可独立配置。右键默认null表示兼容旧共享配置，`ElasticFor(right)`读取有效参数；显式配置右键后不再跟随左键。仅开启右键也安装鼠标监听。宿主编辑器应在加载旧配置时深复制左键为右键，使后续编辑独立；Windows交换主按钮不改变物理左右键含义。
