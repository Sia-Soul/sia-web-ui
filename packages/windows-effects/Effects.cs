using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Threading;

namespace SiaWebUI.Windows.Effects;

/// <summary>桌面鼠标特效参数；默认关闭拖尾与点击特效。</summary>
public sealed partial class EffectOptions
{
    /// <summary>是否开启柔光拖尾，默认为 false。</summary>
    public bool Trail { get; set; }
    /// <summary>左键点击效果名称：无、水波纹、彩纸礼炮或礼炮 + 水波纹；默认为无。保留 Click 名称兼容旧配置。</summary>
    public string Click { get; set; } = "无";
    /// <summary>右键点击效果；未设置时沿用左键，兼容旧版双键共用配置；显式设置“无”可只关闭右键。</summary>
    public string? RightClick { get; set; }
    /// <summary>左键六位十六进制颜色；未设置时沿用 Color，兼容旧配置。</summary>
    public string? LeftColor { get; set; }
    /// <summary>右键六位十六进制颜色；未设置时沿用 Color，兼容旧配置。</summary>
    public string? RightColor { get; set; }
    /// <summary>六位十六进制拖尾颜色及旧配置点击颜色，默认为 #9878F0。</summary>
    public string Color { get; set; } = "#9878F0";
    /// <summary>特效强度，取 1～3，默认为 2。</summary>
    public int Intensity { get; set; } = 2;
    /// <summary>宿主记录的登录启动偏好；扩展自身不会注册系统自启动。</summary>
    public bool Startup { get; set; }
    /// <summary>读取物理按键的效果名称；right 为 true 时读取右键，否则读取左键。旧配置自动回退到共享效果。</summary>
    public string ClickFor(bool right) => right ? RightClick ?? Click : Click;
    /// <summary>读取物理按键的颜色；right 为 true 时读取右键，否则读取左键。旧配置自动回退到 Color。</summary>
    public string ColorFor(bool right) => (right ? RightColor : LeftColor) ?? Color;
    /// <summary>检查两键的效果、颜色及强度；无效时抛出 ArgumentException，不修改参数。</summary>
    public void Validate()
    {
        ValidateAdvanced();
        if (Extras == null) throw new ArgumentException("附加效果配置不能为 null。");
        Extras.Validate();
        if (Intensity < 1 || Intensity > 3 || new[] { Click, ClickFor(true) }.Any(value => !new[] { "无", "水波纹", "彩纸礼炮", "礼炮 + 水波纹" }.Contains(value)) || new[] { Color, ColorFor(false), ColorFor(true) }.Any(value => !System.Text.RegularExpressions.Regex.IsMatch(value ?? "", "^#[0-9a-fA-F]{6}$")))
            throw new ArgumentException("特效强度须为 1～3，颜色须为六位十六进制，并使用受支持的点击效果。");
    }
}

// 特效窗口仅绘制，不激活、不出现在任务栏、不拦截鼠标；所有钩子始终继续传递事件。
/// <summary>透明、不激活、点击穿透的 Windows 桌面鼠标特效窗口；使用完毕必须 Dispose。</summary>
public sealed partial class EffectsWindow : Window, IDisposable
{
    [StructLayout(LayoutKind.Sequential)] struct NativePoint { public int X, Y; }
    [DllImport("user32.dll")] static extern int GetSystemMetrics(int index);
    [DllImport("user32.dll")] static extern bool GetCursorPos(out NativePoint point);
    [DllImport("user32.dll")] static extern bool ScreenToClient(IntPtr window, ref NativePoint point);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr window, int index);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] static extern IntPtr SetWindowLongPtr(IntPtr window, int index, IntPtr value);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
    readonly ParticleCanvas canvas = new();
    readonly StationaryStarLayer starLayer = new();
    // 待机动画与鼠标移动窗口分离，退出时保留原屏幕位置。
    readonly IdleLayer idleLayer = new();
    // 辅助线使用独立细条图层，避免扩张已有粒子画布到整屏。
    readonly CrosshairLayer crosshairLayer = new();
    // 原生定位、待机与星光使用独立轻量时钟，避免依赖 WPF 空闲画布的刷新。
    readonly DispatcherTimer nativeTimer = new(DispatcherPriority.Render) { Interval = TimeSpan.FromMilliseconds(8) };
    readonly Stopwatch layoutClock = Stopwatch.StartNew();
    InputListener? input;
    IntPtr hwnd;
    Point? previous;
    bool rendering;
    TimeSpan lastRenderingTime = TimeSpan.MinValue;
    /// <summary>当前生效的特效参数；通过 Configure 更新。</summary>
    public EffectOptions Options { get; private set; } = new();
    /// <summary>是否暂停特效；暂停时取消逐帧绘制订阅、释放鼠标钩子并隐藏窗口。</summary>
    public bool Paused { get; private set; }
    /// <summary>逐帧绘制发生异常后触发，参数为说明；窗口已自动暂停。</summary>
    public event Action<string>? Failed;
    // 诊断只读属性供自动测试检查穿透样式和钩子释放，不操作用户输入。
    /// <summary>当前是否持有全局鼠标钩子；仅用于状态诊断。</summary>
    public bool Listening => input?.Listening == true;
    /// <summary>当前是否运行动画驱动；定位、聚光灯、十字辅助线、待机或星光启用时使用8ms目标间隔的原生图层时钟，其余使用WPF呈现事件。实际频率取决于系统调度；仅点击模式空闲时停止。</summary>
    public bool IsAnimating => rendering;
    /// <summary>窗口是否同时启用点击穿透与不激活样式。</summary>
    public bool IsClickThrough => hwnd != IntPtr.Zero && (GetWindowLongPtr(hwnd, -20).ToInt64() & 0x8000020) == 0x8000020;

    /// <summary>创建未显示的特效窗口，尚未安装全局钩子。</summary>
    public EffectsWindow()
    {
        WindowStyle = WindowStyle.None; AllowsTransparency = true; Background = Brushes.Transparent;
        ShowInTaskbar = false; ShowActivated = false; Topmost = true; IsHitTestVisible = false; Focusable = false;
        Left = -10000; Top = -10000; Width = 1; Height = 1; Content = canvas;
        nativeTimer.Tick += Tick;
        // 宿主的定位和聚光灯统一交给原生图层，主画布不再保留遮罩旧帧。
        canvas.ExternalLocatorRendering = true;
        // 星光在出生时固定物理屏幕坐标，与主窗口的后续重定位解耦。
        canvas.StarScreenCoordinates = point =>
        {
            var dpi = VisualTreeHelper.GetDpi(this);
            return (new Point(viewport.X+point.X*dpi.DpiScaleX,viewport.Y+point.Y*dpi.DpiScaleY),dpi.DpiScaleX);
        };
        // 绘制线程繁忙时，专用输入线程仍能立即放行系统鼠标和键盘事件。
        input = new InputListener((kind, x, y, delta) => Dispatcher.BeginInvoke(() => HandleClick(kind, new NativePoint { X = x, Y = y }, delta)),
            () => Dispatcher.BeginInvoke(() => { if (!Paused) Locate(); }), () => { if (Options.Extras.Idle.Enabled) Dispatcher.BeginInvoke(() => canvas.ResetIdle()); });
        SourceInitialized += (_, _) =>
        {
            hwnd = new WindowInteropHelper(this).Handle;
            SetWindowLongPtr(hwnd, -20, new IntPtr(GetWindowLongPtr(hwnd, -20).ToInt64() | 0x20 | 0x80000 | 0x8000000 | 0x80));
            ResizeDesktop();
        };
        // 点击产生粒子时唤醒逐帧绘制；空闲时不维持固定频率定时器。
        canvas.Activity += StartRendering;
    }
    void ResizeDesktop()
    {
        // 动态层只保留鼠标附近区域，外围压暗层独立保持静态。
        if (GetCursorPos(out var point)) EnsureViewport(point);
        layoutClock.Restart();
    }
    /// <summary>更新参数及暂停状态；无效参数抛出 ArgumentException，安装钩子失败抛出 Win32Exception。必须在所属 UI 线程调用。</summary>
    public void Configure(EffectOptions options, bool paused = false)
    {
        ArgumentNullException.ThrowIfNull(options);
        options.Validate();
        var enabled = !paused && (options.Trail || options.Click != "无" || options.ClickFor(true) != "无" || options.Charge.Enabled || options.ThemeParticles.Enabled || options.Locator.Enabled || options.Extras.Enabled);
        input!.Configure(enabled, !paused && (options.Locator.Enabled || options.Extras.Idle.Enabled), options.Locator.DoubleTapMs);
        // 参数切换可能改变动画驱动，先停旧时钟，再按新选项恢复。
        StopRendering();
        starLayer.Clear(); idleLayer.Dispose(); crosshairLayer.Dispose(); canvas.Clear(); previous = null;
        Options = options; Paused = paused; tail.Clear(); UpdateDimming();
        if (enabled)
        {
            Show(); ResizeDesktop();
            StartRendering();
        }
        else { StopRendering(); canvas.Clear(); previous = null; Hide(); }
    }
    void HandleClick(int kind, NativePoint point, int delta)
    {
        if (Paused || !IsVisible) return;
        bool down = kind is 0x201 or 0x204, right = kind is 0x204 or 0x205;
        EnsureViewport(point);
        var local = Local(point);
        if (kind is 0x20A or 0x20E) { canvas.ExtraWheel(TailPoint(local), delta, kind == 0x20E, Options.Extras); return; }
        if (down) { canvas.ExtraDown(local, TailPoint(local), Options.Extras, right); var emission = TailPoint(local); canvas.Click(local, Options, right, emission); canvas.BeginCharge(local, Options.Charge, right); canvas.EmitTheme(emission, Options.ThemeParticles); }
        else { canvas.EndCharge(local, right); canvas.ExtraUp(right); }
    }
    Point Local(NativePoint point)
    {
        ScreenToClient(hwnd, ref point);
        var source = PresentationSource.FromVisual(this);
        return source?.CompositionTarget?.TransformFromDevice.Transform(new Point(point.X, point.Y)) ?? new Point(point.X, point.Y);
    }
    void StartRendering()
    {
        if (rendering || Paused || !IsVisible) return;
        rendering = true; lastRenderingTime = TimeSpan.MinValue;
        if (Options.Extras.Stars.Enabled || Options.Locator.Enabled || Options.Extras.Spotlight.Enabled || Options.Extras.Crosshair.Enabled || Options.Extras.Idle.Enabled) nativeTimer.Start();
        else CompositionTarget.Rendering += Tick;
    }
    void StopRendering()
    {
        if (!rendering) return;
        CompositionTarget.Rendering -= Tick;
        nativeTimer.Stop();
        rendering = false;
    }
    void Tick(object? sender, EventArgs args)
    {
        try
        {
            // 跟随 WPF 绘制节奏，并跳过同一呈现时间的重复回调，避免定时器量化造成隔帧跳动。
            if (args is RenderingEventArgs frame)
            {
                if (frame.RenderingTime == lastRenderingTime) return;
                lastRenderingTime = frame.RenderingTime;
            }
            if (layoutClock.ElapsedMilliseconds >= 2000) ResizeDesktop();
            if ((Options.Trail || Options.ThemeMoves || Options.Extras.Tracking || canvas.HasAdvancedActivity) && GetCursorPos(out var screen))
            {
                EnsureViewport(screen);
                // 使用系统热点和当前显示器DPI，不能以贴图尾端或局部画布坐标定位。
                crosshairLayer.Sync(screen.X, screen.Y, Options.Extras.Crosshair);
                var point = Local(screen);
                var emission = TailPoint(point);
                if (previous is Point last && (emission - last).Length > 2)
                {
                    if (Options.Trail) canvas.Trail(last, emission, Options);
                    if (Options.ThemeMoves) canvas.EmitTheme(emission, Options.ThemeParticles, true);
                }
                canvas.UpdatePointer(point); canvas.TrackExtras(point, emission, Options.Extras);
                if ((GetAsyncKeyState(1) & 0x8000) == 0) canvas.ExtraUp(false);
                if ((GetAsyncKeyState(2) & 0x8000) == 0) canvas.ExtraUp(true);
                // 防止释放消息因窗口切换丢失而留下永久蓄力环。
                if (canvas.ChargeCount > 0)
                {
                    if ((GetAsyncKeyState(1) & 0x8000) == 0) canvas.EndCharge(point, false);
                    if ((GetAsyncKeyState(2) & 0x8000) == 0) canvas.EndCharge(point, true);
                }
                previous = emission;
            }
            canvas.Advance(); starLayer.Sync(canvas); idleLayer.Sync(canvas.CurrentIdleVisual); UpdateDimming();
            if (!Options.Trail && !Options.ThemeMoves && !Options.Extras.Tracking && !canvas.HasAdvancedActivity && canvas.Count == 0) StopRendering();
        }
        catch (Exception error) { Configure(Options, true); Failed?.Invoke("特效已暂停：" + error.Message); }
    }
    /// <summary>停止动画并释放全局鼠标钩子，关闭窗口；实例不能再次使用。</summary>
    public void Dispose() { StopRendering(); nativeTimer.Tick -= Tick; input?.Dispose(); input = null; starLayer.Dispose(); idleLayer.Dispose(); crosshairLayer.Dispose(); canvas.Clear(); canvas.Activity -= StartRendering; locatorLayer.Dispose(); Close(); }
}

// 粒子数量及存活时间都有上限，静止后停止重绘，避免常驻时持续消耗 CPU。
/// <summary>用于点击礼炮、水波纹和拖尾的透明绘图层；混合效果总上限240，其中流光最多48段。</summary>
public sealed partial class ParticleCanvas : FrameworkElement
{
    sealed record Particle(Point Position, Vector Velocity, double Born, double Life, Color Color, double Size, int Kind, double Rotation);
    readonly List<Particle> particles = [];
    readonly Stopwatch clock = Stopwatch.StartNew();
    readonly Random random = new();
    // 仅供同一框架内的覆盖层订阅，以便空闲后新粒子能恢复绘制。
    internal event Action? Activity;
    /// <summary>当前保留的粒子数量，包含尚未开始或等待清理的粒子。</summary>
    public int Count => particles.Count + sprites.Count + ribbons.Count + AccentCount;
    /// <summary>每次完成 WPF 绘图命令提交后触发，参数为画布创建以来的时间；用于采样绘图间隔，不代表显示器实际呈现帧率。回调在 UI 线程执行，应保持轻量。</summary>
    public event Action<TimeSpan>? FrameRendered;
    /// <summary>清空全部粒子并请求重绘。</summary>
    public void Clear() { particles.Clear(); ClearAdvanced(); InvalidateVisual(); }
    /// <summary>在起止尾端坐标间添加三层流光；DIP 单位，最多48段，340ms内收细淡出，超过220 DIP的跳跃不连线。</summary>
    public void Trail(Point from, Point to, EffectOptions options)
    {
        // 连续三层细线代替密集圆点，随年龄收细；长距离跳跃不拉出横跨屏幕的直线。
        if ((to - from).Length > 220) return;
        if (ribbons.Count >= 48) ribbons.RemoveAt(0);
        EnsureRoom(); ribbons.Add(new(from, to, clock.Elapsed.TotalSeconds, ParseColor(options.Color), 2 + options.Intensity));
        Activity?.Invoke();
    }
    /// <summary>在指定 DIP 坐标生成点击特效；right 默认为 false（物理左键），true 读取右键配置。单圈水波纹存活320ms，相邻圈延迟40ms；particleOrigin 可指定礼炮发射点（默认 point），水波纹始终留在点击位置。</summary>
    public void Click(Point point, EffectOptions options, bool right = false, Point? particleOrigin = null)
    {
        var now = clock.Elapsed.TotalSeconds;
        var color = ParseColor(options.ColorFor(right));
        var click = options.ClickFor(right);
        // 加快扩散与消退，连续点击时不堆积慢速光圈。
        if (click is "水波纹" or "礼炮 + 水波纹")
            for (int i = 0; i < options.Intensity; i++) Add(new(point, new Vector(), now + i * .04, .32, color, 32 + i * 11, 1, 0));
        if (click is "彩纸礼炮" or "礼炮 + 水波纹")
        {
            // 礼炮所有碎片使用当前按键的配色，透明度和旋转提供层次。
            Color[] colors = [color];
            for (int i = 0; i < 12 + options.Intensity * 10; i++)
            {
                double angle = random.NextDouble() * Math.PI * 2, speed = 55 + random.NextDouble() * 130;
                Add(new(particleOrigin ?? point, new Vector(Math.Cos(angle) * speed, Math.Sin(angle) * speed - 60), now, .6 + random.NextDouble() * .4, colors[i % colors.Length], 3 + random.NextDouble() * 4, 2, random.NextDouble() * 180));
            }
        }
    }
    void Add(Particle particle) { EnsureRoom(); particles.Add(particle); Activity?.Invoke(); }
    /// <summary>按实际经过时间移除过期粒子并请求绘制节拍；星光内容由固定原生图层提交，不随本画布移动。宿主负责安排调用频率。</summary>
    public void Advance()
    {
        if (Count == 0 && !HasAdvancedActivity) return;
        // 原生星光有独立时钟；只存在星光时无需重绘跟随鼠标的空 WPF 画布。
        bool repaint = HasAdvancedActivity || particles.Count > 0 || sprites.Count > 0 || ribbons.Count > 0 || streams.Count > 0 || accents.Any(value => value.Kind != 0 || StarScreenCoordinates == null);
        particles.RemoveAll(p => clock.Elapsed.TotalSeconds - p.Born > p.Life);
        AdvanceAdvanced(clock.Elapsed.TotalSeconds);
        if (repaint) InvalidateVisual();
    }
    /// <summary>按粒子年龄绘制当前透明效果，不改变鼠标输入。</summary>
    protected override void OnRender(DrawingContext drawing)
    {
        var now = clock.Elapsed.TotalSeconds;
        RenderExtras(drawing, now);
        RenderRibbon(drawing, now);
        RenderAdvanced(drawing, now);
        foreach (var p in particles)
        {
            double age = now - p.Born;
            if (age < 0) continue;
            double progress = Math.Clamp(age / p.Life, 0, 1);
            var brush = BrushFor(p.Color, (1 - progress) * .8);
            // 光圈线宽由 4 DIP 渐细到 1 DIP，增强可见度；沿用原有扩散速度和透明度。
            if (p.Kind == 1) { double radius = 4 + p.Size * progress; drawing.DrawEllipse(null, PenFor(brush, 3 * (1 - progress) + 1), p.Position, radius, radius); }
            else if (p.Kind == 0) drawing.DrawEllipse(brush, null, p.Position, p.Size * (1 - progress), p.Size * (1 - progress));
            else
            {
                var at = p.Position + p.Velocity * age + new Vector(0, 110 * age * age);
                drawing.PushTransform(new RotateTransform(p.Rotation + age * 270, at.X, at.Y));
                drawing.DrawRoundedRectangle(brush, null, new Rect(at.X - p.Size / 2, at.Y - p.Size, p.Size, p.Size * 1.6), 1, 1);
                drawing.Pop();
            }
        }
        FrameRendered?.Invoke(clock.Elapsed);
    }
}
