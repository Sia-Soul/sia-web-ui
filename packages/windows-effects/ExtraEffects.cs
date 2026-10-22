using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace SiaWebUI.Windows.Effects;

/// <summary>附加效果的通用参数；仅对应效果使用相关字段，具体默认值见 ExtraEffectsOptions 各项。</summary>
public sealed class AccentOptions
{
    /// <summary>独立开关，默认false。</summary>
    public bool Enabled { get; set; }
    /// <summary>主色，默认#9878F0，须为六位十六进制；贴图表情保留原画颜色。</summary>
    public string Color { get; set; } = "#9878F0";
    /// <summary>丝带渐变末端色，默认#6EB7EE。</summary>
    public string SecondaryColor { get; set; } = "#6EB7EE";
    /// <summary>图案边长或环半径；丝带/速度拖尾表示线宽。DIP单位，2～180，默认24。</summary>
    public int Size { get; set; } = 24;
    /// <summary>动画持续时间或轨迹保留时间，150～4000ms，默认700；待机项表示动作循环周期。</summary>
    public int DurationMs { get; set; } = 700;
    /// <summary>星光/表情的生成最小间隔，或待机项的静止等待时间；30～30000ms，默认100。滚轮保留该字段兼容旧配置，不再限流或生成多个图案。</summary>
    public int IntervalMs { get; set; } = 100;
    /// <summary>弹性程度、丝带跟随速度或速度拖尾响应强度，0～100，默认50。</summary>
    public int Strength { get; set; } = 50;
    /// <summary>表情上浮距离、拖拽触发距离或滚轮相对尾端的偏移；0～160 DIP，默认24。</summary>
    public int Distance { get; set; } = 24;
    /// <summary>聚光灯背景压暗或十字辅助线不透明度，0～0.65，默认0.3；0完全透明。</summary>
    public double Opacity { get; set; } = .3;
    /// <summary>弹性光圈、拖拽提示或十字辅助线线宽，1～8 DIP，默认3。</summary>
    public int Thickness { get; set; } = 3;
    /// <summary>效果样式；表情为heart/exclaim/smile/theme/random，丝带为solid/gradient，拖拽为dashed/arrows，滚轮为arrow/chevron，其余使用default。</summary>
    public string Style { get; set; } = "default";
}

/// <summary>附加鼠标效果，默认全部关闭，可叠加；粒子共享全局绘制预算。</summary>
public sealed class ExtraEffectsOptions
{
    /// <summary>物理左键的弹性光圈；兼容旧共享字段。默认关闭，半径32、550ms、弹性60、线宽3。</summary>
    public AccentOptions Elastic { get; set; } = new() { Size = 32, DurationMs = 550, Strength = 60 };
    /// <summary>物理右键的独立弹性光圈；默认null沿用Elastic以兼容旧配置。显式设置后独立控制开关、颜色、半径、时长、弹性和线宽。</summary>
    public AccentOptions? RightElastic { get; set; }
    /// <summary>读取对应物理按键的弹性光圈参数；right=false为左键，true为右键，未配置右键时沿用Elastic。不修改配置。</summary>
    public AccentOptions ElasticFor(bool right) => right ? RightElastic ?? Elastic : Elastic;
    /// <summary>尾部星光：出生后固定在屏幕位置缩小淡出；大小10、存活650ms、间隔70ms、金色。</summary>
    public AccentOptions Stars { get; set; } = new() { Size = 10, DurationMs = 650, IntervalMs = 70, Color = "#F5C468" };
    /// <summary>柔软丝带：宽8、保留500ms、跟随速度70、双色渐变。</summary>
    public AccentOptions Ribbon { get; set; } = new() { Size = 8, DurationMs = 500, Strength = 70, Style = "gradient" };
    /// <summary>点击贴图表情：大小32、900ms、上浮45、间隔120ms，默认爱心。</summary>
    public AccentOptions Expression { get; set; } = new() { Size = 32, DurationMs = 900, Distance = 45, IntervalMs = 120, Style = "heart" };
    /// <summary>拖拽提示：半径28、触发距离8、线宽2，默认虚线环。</summary>
    public AccentOptions Drag { get; set; } = new() { Size = 28, Distance = 8, Thickness = 2, Style = "dashed" };
    /// <summary>单个滚轮方向反馈：大小18、停止滚动450ms后消失、偏移24；以600ms周期轻浮动，快速滚动仅续期和更新方向，默认箭头。</summary>
    public AccentOptions Wheel { get; set; } = new() { Size = 18, DurationMs = 450, IntervalMs = 60, Distance = 24, Style = "arrow" };
    /// <summary>持续鼠标聚光灯：半径120、背景压暗30%；通过Enabled或宿主托盘切换。</summary>
    public AccentOptions Spotlight { get; set; } = new() { Size = 120 };
    /// <summary>十字辅助线：默认关闭，青色#52C7FF、线宽2 DIP、不透明度60%；两线交于真实鼠标热点，仅覆盖鼠标所在显示器的完整屏幕，通过Configure更新。</summary>
    public AccentOptions Crosshair { get; set; } = new() { Color = "#52C7FF", Thickness = 2, Opacity = .6 };
    /// <summary>待机伙伴：大小40、静止5秒后出现、1.8秒一个眨眼/漂浮周期，移动或按键后隐藏。</summary>
    public AccentOptions Idle { get; set; } = new() { Size = 40, IntervalMs = 5000, DurationMs = 1800 };
    /// <summary>速度响应拖尾：最大宽6、最长700ms，响应强度60，速度提高时变长变亮。</summary>
    public AccentOptions Speed { get; set; } = new() { Size = 6, DurationMs = 700, Strength = 60, Color = "#61C9AA" };
    internal AccentOptions[] All => [Elastic, ElasticFor(true), Stars, Ribbon, Expression, Drag, Wheel, Spotlight, Crosshair, Idle, Speed];
    internal bool Enabled => All.Any(value => value.Enabled);
    internal bool Tracking => Stars.Enabled || Ribbon.Enabled || Drag.Enabled || Spotlight.Enabled || Crosshair.Enabled || Idle.Enabled || Speed.Enabled;
    internal void Validate()
    {
        foreach (var item in All)
            if (item == null || item.Size is < 2 or > 180 || item.DurationMs is < 150 or > 4000 || item.IntervalMs is < 30 or > 30000 || item.Strength is < 0 or > 100 || item.Distance is < 0 or > 160 || item.Thickness is < 1 or > 8 || !double.IsFinite(item.Opacity) || item.Opacity is < 0 or > .65 || new[] { item.Color, item.SecondaryColor }.Any(color => !System.Text.RegularExpressions.Regex.IsMatch(color ?? "", "^#[0-9a-fA-F]{6}$"))) throw new ArgumentException("附加效果参数超出允许范围。");
        if (!new[] { "solid", "gradient" }.Contains(Ribbon.Style) || !new[] { "heart", "exclaim", "smile", "theme", "random" }.Contains(Expression.Style) || !new[] { "dashed", "arrows" }.Contains(Drag.Style) || !new[] { "arrow", "chevron" }.Contains(Wheel.Style)) throw new ArgumentException("附加效果样式无效。");
    }
}

public sealed partial class EffectOptions
{
    /// <summary>附加效果的独立参数；旧配置中缺失的效果默认为关闭。</summary>
    public ExtraEffectsOptions Extras { get; set; } = new();
}

public sealed partial class EffectsWindow
{
    /// <summary>设置三个表情贴图（爱心、感叹号、笑脸）和当前主题两帧待机贴图；复制冻结后缓存，须在UI线程调用。</summary>
    public void SetAccentSprites(IEnumerable<BitmapSource> expressions, IEnumerable<BitmapSource> idle) => canvas.SetAccentSprites(expressions, idle);
}

public sealed partial class ParticleCanvas
{
    internal sealed record Accent(Point Position, double Born, AccentOptions Options, int Kind, int Direction = 0, BitmapSource? Image = null, double PixelScale = 1);
    // 桌面宿主将星光出生位置转换为物理屏幕坐标；独立画布继续使用自身坐标。
    internal Func<Point, (Point Position, double Scale)>? StarScreenCoordinates;
    internal IEnumerable<Accent> StationaryStars => accents.Where(value => value.Kind == 0);
    internal double StarTime => clock.Elapsed.TotalSeconds;
    // 超过固定网格预算时淘汰最早的远处星光，避免它们随鼠标回到旧网格时重新出现。
    internal void RetainStationaryStars(ISet<(int,int)> grids) => accents.RemoveAll(value => value.Kind == 0 && !grids.Contains(StationaryStarLayer.Grid(value.Position)));
    sealed record StreamSegment(Point From, Point To, double Born, double Life, double Width, Color Color, double Opacity);
    readonly List<Accent> accents = [];
    readonly List<StreamSegment> streams = [];
    readonly Dictionary<bool, Point> dragOrigins = [];
    BitmapSource[] expressions = [], idleFrames = [];
    ExtraEffectsOptions extraOptions = new();
    Point? extraPrevious, ribbonPrevious, idlePreviousHotspot;
    Point emissionPoint;
    double lastMotion, lastTrack, lastStar = -100, lastExpression = -100, wheelPhaseBorn = -100;
    bool dragging, idleVisible;
    Point idleAnchor;
    double idleBorn, idleScale=1, idleFadeBorn;
    IdleVisual? idleFade;
    internal sealed record IdleVisual(BitmapSource Image, Point Position, double Size, double Opacity);
    // 桌面宿主复用物理坐标转换；预览画布保持本地 DIP 坐标。
    internal IdleVisual? CurrentIdleVisual
    {
        get
        {
            double now=clock.Elapsed.TotalSeconds;
            if(idleFade is IdleVisual fading) return fading with { Opacity=Math.Clamp(1-(now-idleFadeBorn)/.18,0,1) };
            if(!idleVisible||idleFrames.Length==0) return null;
            double phase=(now-idleBorn)*1000/extraOptions.Idle.DurationMs%1;
            int frame=phase is >.12 and <.23 or >.3 and <.39 ? 1 : 0;
            return new(idleFrames[Math.Min(frame,idleFrames.Length-1)],idleAnchor+new Vector(0,Math.Sin(phase*Math.PI*2)*3*idleScale),extraOptions.Idle.Size*idleScale,1);
        }
    }
    void FadeIdle()
    {
        if(!idleVisible) return;
        // 捕获退出前的图案、位置与尺寸，渐隐期间只改变透明度。
        idleFade=CurrentIdleVisual;idleFadeBorn=clock.Elapsed.TotalSeconds;idleVisible=false;
        Activity?.Invoke();InvalidateVisual();
    }
    static readonly Geometry starGeometry = MakeStar();
    static Geometry MakeStar()
    {
        var shape = new StreamGeometry();
        using (var context = shape.Open())
        {
            context.BeginFigure(new Point(0, -1), true, true);
            context.PolyLineTo(new Point[] { new(.23, -.23), new(1, 0), new(.23, .23), new(0, 1), new(-.23, .23), new(-1, 0), new(-.23, -.23) }, true, false);
        }
        shape.Freeze(); return shape;
    }
    /// <summary>当前额外瞬时图案与轨迹段数；用于共享预算诊断。</summary>
    public int AccentCount => accents.Count + streams.Count;
    /// <summary>当前是否已达到拖拽阈值并显示提示。</summary>
    public bool DragVisible => dragging;
    /// <summary>当前是否处于待机动画状态；移动后立即为false，原位保留180ms渐隐残影。</summary>
    public bool IdleVisible => idleVisible;
    internal bool ExtraActivity => dragging || idleVisible || idleFade != null || extraOptions.Spotlight.Enabled;
    internal double BackgroundDim => locator?.Dim ?? (extraOptions.Spotlight.Enabled ? extraOptions.Spotlight.Opacity : 0);
    /// <summary>设置表情与待机帧，最多分别三张、两张；克隆冻结，不在逐帧循环中加载磁盘。</summary>
    public void SetAccentSprites(IEnumerable<BitmapSource> expressionImages, IEnumerable<BitmapSource> idleImages)
    {
        static BitmapSource Freeze(BitmapSource value) { var copy = value.Clone(); copy.Freeze(); return copy; }
        expressions = expressionImages.Take(3).Select(Freeze).ToArray(); idleFrames = idleImages.Take(2).Select(Freeze).ToArray();
    }
    /// <summary>更新附加效果的位置和移动状态；hotspot用于光圈，tail用于轨迹和粒子。坐标为DIP，宿主逐帧调用。</summary>
    public void TrackExtras(Point hotspot, Point tail, ExtraEffectsOptions options)
    {
        extraOptions = options; emissionPoint = tail;
        double now = clock.Elapsed.TotalSeconds, dt = Math.Clamp(now - lastTrack, .001, .1); lastTrack = now;
        // 待机退出不使用轨迹的1 DIP阈值，单个物理像素移动也立即渐隐。
        if(idlePreviousHotspot is Point idlePrevious && hotspot != idlePrevious) { FadeIdle();lastMotion=now; }
        idlePreviousHotspot=hotspot;
        if(!options.Idle.Enabled) { idleVisible=false;idleFade=null; }
        bool moved = extraPrevious is not Point previous || (hotspot - previous).Length > 1;
        if (moved)
        {
            FadeIdle();lastMotion = now;
            if (extraPrevious is Point old)
            {
                double distance = (hotspot - old).Length, speed = distance / dt;
                // 跨屏或瞬间跳转时重置平滑端点，避免下一帧连接出横跨画面的长线。
                if (distance >= 220) ribbonPrevious = tail;
                if (options.Stars.Enabled && now - lastStar >= options.Stars.IntervalMs / 1000d)
                {
                    var birth = StarScreenCoordinates?.Invoke(tail) ?? (tail, 1d);
                    AddAccent(new(birth.Item1, now, options.Stars, 0, PixelScale: birth.Item2)); lastStar = now;
                }
                if (ribbonPrevious is Point prior && distance < 220)
                {
                    if (options.Ribbon.Enabled)
                    {
                        var smooth = prior + (tail - prior) * (.25 + options.Ribbon.Strength / 135d);
                        var color = ParseColor(options.Ribbon.Color);
                        if (options.Ribbon.Style == "gradient")
                        {
                            var other = ParseColor(options.Ribbon.SecondaryColor); double mix = Math.Round((.5 + .5 * Math.Sin(now * 3))*7)/7;
                            color = Color.FromRgb((byte)(color.R * (1-mix) + other.R * mix), (byte)(color.G * (1-mix) + other.G * mix), (byte)(color.B * (1-mix) + other.B * mix));
                        }
                        AddStream(new(prior, smooth, now, options.Ribbon.DurationMs / 1000d, options.Ribbon.Size, color, .75)); ribbonPrevious = smooth;
                    }
                    if (options.Speed.Enabled)
                    {
                        double power = Math.Clamp(speed / (1800 - options.Speed.Strength * 14), 0, 1);
                        AddStream(new(prior, tail, now, options.Speed.DurationMs / 1000d * (.2 + .8 * power), options.Speed.Size * (.25 + .75 * power), ParseColor(options.Speed.Color), .2 + .7 * power));
                    }
                }
            }
            if (!options.Ribbon.Enabled || ribbonPrevious == null) ribbonPrevious = tail;
            dragging = options.Drag.Enabled && dragOrigins.Values.Any(origin => (hotspot - origin).Length >= options.Drag.Distance);
            extraPrevious = hotspot;
        }
        if (options.Idle.Enabled && !idleVisible && idleFade == null && idleFrames.Length > 0 && dragOrigins.Count == 0 && now - lastMotion >= options.Idle.IntervalMs / 1000d)
        {
            var origin=tail+new Vector(options.Idle.Size*.65,-options.Idle.Size*.6);
            var birth=StarScreenCoordinates?.Invoke(origin)??(origin,1d);
            idleAnchor=birth.Item1;idleScale=birth.Item2;idleBorn=now;idleVisible=true;
        }
    }
    /// <summary>处理附加点击效果及拖拽起点；图案在tail生成，弹性环在hotspot生成；right表示物理右键。</summary>
    public void ExtraDown(Point hotspot, Point tail, ExtraEffectsOptions options, bool right = false)
    {
        extraOptions = options; ResetIdle();
        // 待机模式也记录按住状态，防止长按鼠标期间冒出待机伙伴。
        if (options.Drag.Enabled || options.Idle.Enabled) dragOrigins[right] = hotspot;
        // 按物理左右键选择独立参数，右键单独开启时也由宿主启用监听。
        var elastic=options.ElasticFor(right);
        if (elastic.Enabled) AddAccent(new(hotspot, lastMotion, elastic, 1));
        if (options.Expression.Enabled && lastMotion - lastExpression >= options.Expression.IntervalMs / 1000d)
        {
            var style = options.Expression.Style; if (style == "random") style = new[] { "heart", "exclaim", "smile", "theme" }[random.Next(4)];
            BitmapSource? bitmap = style == "theme" ? themeSprites.FirstOrDefault() : expressions.ElementAtOrDefault(style == "exclaim" ? 1 : style == "smile" ? 2 : 0);
            if (bitmap != null) AddAccent(new(tail, lastMotion, options.Expression, 2, Image: bitmap)); lastExpression = lastMotion;
        }
    }
    /// <summary>结束某个物理按键的拖拽；松开后立即隐藏对应提示。</summary>
    public void ExtraUp(bool right = false)
    {
        if(!dragOrigins.Remove(right)) return;
        bool before=dragging;
        // 松开后重新检查剩余按键，并主动清空最后一帧；不能等待已停止的动画循环重画。
        dragging=extraOptions.Drag.Enabled && dragOrigins.Values.Any(origin=>((extraPrevious??advancedPoint)-origin).Length>=extraOptions.Drag.Distance);
        if(before!=dragging) InvalidateVisual();
    }
    /// <summary>更新唯一滚轮箭头；delta为原始有符号增量，horizontal表示横向。连续滚动续期且保留浮动相位，反向立即更新，不改变系统滚动。</summary>
    public void ExtraWheel(Point tail, int delta, bool horizontal, ExtraEffectsOptions options)
    {
        ResetIdle();
        if (!options.Wheel.Enabled || delta == 0) return;
        double now=clock.Elapsed.TotalSeconds;
        int index=accents.FindIndex(value=>value.Kind is 3 or 4);
        var arrow=new Accent(tail+new Vector(options.Wheel.Distance,0),now,options.Wheel,horizontal?4:3,Math.Sign(delta));
        // 横向和纵向共用一个图案；只更新位置、方向与到期时间，不累计图案或重置浮动相位。
        if(index>=0) { accents[index]=arrow;Activity?.Invoke(); }
        else { wheelPhaseBorn=now;AddAccent(arrow); }
        InvalidateVisual();
    }
    void AddAccent(Accent value) { if (accents.Count >= 64) accents.RemoveAt(0); EnsureRoom(); accents.Add(value); Activity?.Invoke(); }
    void AddStream(StreamSegment value) { if (streams.Count >= 64) streams.RemoveAt(0); EnsureRoom(); streams.Add(value); Activity?.Invoke(); }
    internal void ResetIdle() { FadeIdle();lastMotion = clock.Elapsed.TotalSeconds;InvalidateVisual(); }
    void ClearExtras() { accents.Clear(); streams.Clear(); dragOrigins.Clear(); dragging = idleVisible = false; idleFade=null; extraOptions = new(); extraPrevious = ribbonPrevious = idlePreviousHotspot = null; lastMotion = clock.Elapsed.TotalSeconds; lastStar = lastExpression = wheelPhaseBorn = -100; }
    void AdvanceExtras(double now) { if(idleFade!=null&&now-idleFadeBorn>=.18) idleFade=null; accents.RemoveAll(value => now - value.Born > value.Options.DurationMs / 1000d); streams.RemoveAll(value => now - value.Born > value.Life); }
    void ShiftExtras(Vector delta)
    {
        // 屏幕星光是不可变出生坐标，不参与跟随窗口的坐标补偿。
        for (int i = 0; i < accents.Count; i++)
            if (accents[i].Kind != 0 || StarScreenCoordinates == null) accents[i] = accents[i] with { Position = accents[i].Position + delta };
        for (int i = 0; i < streams.Count; i++) streams[i] = streams[i] with { From = streams[i].From + delta, To = streams[i].To + delta };
        foreach (bool key in dragOrigins.Keys.ToArray()) dragOrigins[key] += delta;
        if (extraPrevious is Point old) extraPrevious = old + delta;
        if (idlePreviousHotspot is Point idleOld) idlePreviousHotspot = idleOld + delta;
        if (ribbonPrevious is Point ribbon) ribbonPrevious = ribbon + delta;
        emissionPoint += delta;
        // 只有独立预览使用本地坐标补偿；桌面待机位置不受宿主窗口移动影响。
        if(StarScreenCoordinates==null) { idleAnchor+=delta;if(idleFade is IdleVisual fading) idleFade=fading with { Position=fading.Position+delta }; }
    }
    void RenderExtras(DrawingContext drawing, double now)
    {
        if (!ExternalLocatorRendering && locator == null && extraOptions.Spotlight.Enabled) DrawSpotlight(drawing, extraOptions.Spotlight.Size, extraOptions.Spotlight.Opacity);
        foreach (var stream in streams)
        {
            double fade = Math.Clamp(1 - (now-stream.Born) / stream.Life, 0, 1);
            drawing.DrawLine(PenFor(BrushFor(stream.Color, stream.Opacity * fade), Math.Max(.25, stream.Width * fade)), stream.From, stream.To);
            drawing.DrawLine(PenFor(BrushFor(Colors.White, .3 * fade), Math.Max(.25, stream.Width * fade * .18)), stream.From, stream.To);
        }
        // 平滑计算可稍落后于实时坐标，补上最后一段，保证丝带始终接在指针尾端。
        if (extraOptions.Ribbon.Enabled && streams.Count > 0 && ribbonPrevious is Point end && (emissionPoint-end).Length < 220)
            drawing.DrawLine(PenFor(BrushFor(ParseColor(extraOptions.Ribbon.Color), .75), extraOptions.Ribbon.Size), end, emissionPoint);
        foreach (var value in accents)
        {
            if (value.Kind == 0 && StarScreenCoordinates != null) continue;
            double progress = Math.Clamp((now-value.Born) * 1000 / value.Options.DurationMs, 0, 1), fade = 1-progress;
            // 快速滚动时保持清晰，停止后再在保留时长的末段淡出。
            var brush = BrushFor(ParseColor(value.Options.Color), value.Kind is 3 or 4 ? Math.Min(1,fade*3) : fade);
            if (value.Kind == 0)
            {
                double size = value.Options.Size * fade * .5;
                // 出生位置保持不变，只缩小淡出，不再额外上浮。
                drawing.PushTransform(new MatrixTransform(size, 0, 0, size, value.Position.X, value.Position.Y)); drawing.DrawGeometry(brush, null, starGeometry); drawing.Pop();
            }
            else if (value.Kind == 1)
            {
                double t = Math.Max(0, (progress-.2)/.8), radius = value.Options.Size * (progress < .2 ? .65 - progress * 1.5 : 1 - .65 * Math.Exp(-5*t) * Math.Cos((2 + value.Options.Strength*.02) * Math.PI*t));
                drawing.DrawEllipse(null, PenFor(brush, value.Options.Thickness), value.Position, radius, radius);
            }
            else if (value.Kind == 2 && value.Image != null)
            {
                drawing.PushOpacity(Math.Min(1, fade*3)); DrawSprite(drawing, value.Image, value.Position + new Vector(0, -progress * value.Options.Distance), value.Options.Size); drawing.Pop();
            }
            else
            {
                double size = value.Options.Size * .5; var axis = value.Kind == 4 ? new Vector(value.Direction, 0) : new Vector(0, -value.Direction); var side = new Vector(-axis.Y, axis.X);
                // 单个箭头围绕固定基准轻浮动；续期不重置相位，反向不改变浮动中心。
                var bobAxis=value.Kind==4?new Vector(1,0):new Vector(0,1);
                var at = value.Position + bobAxis * (Math.Sin((now-wheelPhaseBorn)*Math.PI*2/.6)*4); var tip = at + axis * size; var pen = PenFor(brush, 2);
                drawing.DrawLine(pen, tip, at + side*size); drawing.DrawLine(pen, tip, at-side*size);
                if (value.Options.Style == "arrow") drawing.DrawLine(pen, tip, at-axis*size);
            }
        }
        if (dragging)
        {
            var options = extraOptions.Drag; var pen = PenFor(BrushFor(ParseColor(options.Color), .8), options.Thickness);
            // 分段圆弧代替每帧构造 DashStyle；方向模式使用四个短线段。
            for (int i = 0; i < 12; i++)
            {
                if (options.Style == "arrows" && i % 3 != 0) continue;
                double a = i * Math.PI / 6, b = a + .28;
                var axis = new Vector(Math.Cos(a), Math.Sin(a));
                if (options.Style == "arrows")
                {
                    var side = new Vector(-axis.Y,axis.X); var tip = advancedPoint + axis * options.Size;
                    drawing.DrawLine(pen,tip,tip-axis*6+side*4); drawing.DrawLine(pen,tip,tip-axis*6-side*4);
                }
                else drawing.DrawLine(pen, advancedPoint + axis*options.Size, advancedPoint + new Vector(Math.Cos(b), Math.Sin(b))*options.Size);
            }
        }
        if (StarScreenCoordinates==null && CurrentIdleVisual is IdleVisual idle)
        {
            drawing.PushOpacity(idle.Opacity);DrawSprite(drawing,idle.Image,idle.Position,idle.Size);drawing.Pop();
        }
    }
    void DrawSpotlight(DrawingContext drawing, double radius, double dim)
    {
        if (dim <= 0) return;
        var mask = new GeometryGroup { FillRule = FillRule.EvenOdd };
        mask.Children.Add(new RectangleGeometry(new Rect(0,0,ActualWidth,ActualHeight))); mask.Children.Add(new EllipseGeometry(advancedPoint,radius,radius));
        // 持续聚光灯与临时定位共用遮罩透明度规则，保证局部边界无色差。
        drawing.DrawGeometry(DimmingBrush(dim),null,mask);
    }
    static void DrawSprite(DrawingContext drawing, BitmapSource image, Point point, double size)
    {
        double ratio = (double)image.PixelWidth/image.PixelHeight, width = ratio>=1 ? size : size*ratio, height = ratio>=1 ? size/ratio : size;
        drawing.DrawImage(image,new Rect(point.X-width/2,point.Y-height/2,width,height));
    }
}
