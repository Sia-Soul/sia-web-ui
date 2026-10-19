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
动画使用 `CompositionTarget.Rendering` 跟随 WPF 绘制节奏，跳过同一呈现时间的重复回调，不再使用 16ms 定时器驱动动画。只开启点击效果时，粒子清空后取消绘制订阅，新点击自动唤醒；暂停和退出同样取消订阅。动态覆盖层为512×512 DIP；指针靠近边界时重定位并平移现有粒子坐标。高速移动离开局部区域的旧粒子可能被裁掉，避免绘制面积随轨迹增长到整个桌面。
`EffectsWindow.IsAnimating` 只读返回当前是否订阅逐帧绘制；可用于检查空闲和暂停状态，系统自身触发的窗口重绘不算主动动画订阅。
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

定位圈外压暗拆成四块静态外围窗口及局部圆形镂空，只有局部画布逐帧更新。外围窗口仅在触发、区域移动、结束时更新，不做全屏逐帧蒙版。所有窗口不激活并穿透点击。`DynamicPixelArea` 返回局部动画窗口的物理像素面积，`CtrlListening` 返回键盘钩子状态。

`Configure` 每次成功更新都会清空当前动画。仅蓄力、点击粒子或定位启用时空闲取消逐帧订阅，下次事件唤醒；移动粒子与拖尾需要持续采样指针。`HasAdvancedActivity`、`ChargeCount`、`LocatorVisible` 提供画布只读诊断。

## 流光与尾端

`Trail` 生成外层柔光、彩色细线和细亮芯三层连续轨迹，340ms内逐渐收细淡出，超过220 DIP的瞬移不连线。点击水波纹和蓄力仍锚定热点，礼炮与主题贴图从尾端发射。

覆盖层通过 GetCursorInfo/GetIconInfo 读取实际指针，按可见底边与热点计算尾端，忽略透明留白。位图计算按句柄缓存，每两秒失效，支持系统复用句柄后更换大小。`ParticleCanvas.FindTailOffset(image, hotspot)` 返回物理像素偏移；绘制前按当前DPI转为DIP。无可见像素返回零；系统读取失败使用保守右下偏移。获取的GDI位图及时释放，不销毁系统拥有的指针句柄。

`ParticleCanvas.Click(point, options, right, particleOrigin)` 可单独指定礼炮发射点，省略时继续使用point；水波纹始终在point。宿主自驱动Trail时传入尾端坐标。
