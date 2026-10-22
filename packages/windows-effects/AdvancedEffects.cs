using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace SiaWebUI.Windows.Effects;

/// <summary>长按蓄力环设置；默认关闭，仅绘图，不改变原始按键行为。</summary>
public sealed class ChargeOptions
{
    /// <summary>是否开启，默认 false。</summary>
    public bool Enabled { get; set; }
    /// <summary>触发按键：left、right 或 both，默认 left。</summary>
    public string Button { get; set; } = "left";
    /// <summary>出现光环前的长按等待时间，100～1000ms，默认 250ms。</summary>
    public int DelayMs { get; set; } = 250;
    /// <summary>光环出现后充满所需时间，200～2000ms，默认 700ms。</summary>
    public int FillMs { get; set; } = 700;
    /// <summary>光环半径，16～64 DIP，默认 32。</summary>
    public int Radius { get; set; } = 32;
    /// <summary>六位十六进制颜色，默认 #9878F0。</summary>
    public string Color { get; set; } = "#9878F0";
    /// <summary>松开时是否散开光环；只有达到等待时间才触发，默认 true。</summary>
    public bool Release { get; set; } = true;
}

/// <summary>透明贴图主题粒子参数；素材通过 EffectsWindow.SetThemeSprites 提供。</summary>
public sealed class ThemeParticleOptions
{
    /// <summary>是否开启，默认 false。</summary>
    public bool Enabled { get; set; }
    /// <summary>触发方式：click、move、both，默认 click。</summary>
    public string Trigger { get; set; } = "click";
    /// <summary>素材主题标识，由宿主解释；auto 表示跟随当前实际使用的主题。</summary>
    public string Theme { get; set; } = "auto";
    /// <summary>每次点击的数量，2～16，默认 6；移动时按该值发出少量粒子。</summary>
    public int Amount { get; set; } = 6;
    /// <summary>贴图最大边长，12～48 DIP，默认 24。</summary>
    public int Size { get; set; } = 24;
    /// <summary>粒子存活时间，300～1800ms，默认 900ms。</summary>
    public int LifeMs { get; set; } = 900;
}

/// <summary>双击 Ctrl 鼠标定位设置；默认关闭。</summary>
public sealed class LocatorOptions
{
    /// <summary>是否启用双击 Ctrl 监听，默认 false；关闭或暂停会释放键盘钩子。</summary>
    public bool Enabled { get; set; }
    /// <summary>两次独立 Ctrl 点击的最大间隔，200～800ms，默认 400ms；组合键及按住自动重复不触发。</summary>
    public int DoubleTapMs { get; set; } = 400;
    /// <summary>定位圈半径，40～180 DIP，默认 80。</summary>
    public int Radius { get; set; } = 80;
    /// <summary>显示时长，600～3000ms，默认 1200ms；重复触发重置时长。</summary>
    public int DurationMs { get; set; } = 1200;
    /// <summary>光圈六位十六进制颜色，默认 #6EB7EE。</summary>
    public string Color { get; set; } = "#6EB7EE";
    /// <summary>光圈外背景压暗比例，0～0.65，默认 0（不压暗）。</summary>
    public double Dim { get; set; }
}

public sealed partial class EffectOptions
{
    /// <summary>独立的长按蓄力环设置；旧配置缺省为关闭。</summary>
    public ChargeOptions Charge { get; set; } = new();
    /// <summary>独立的主题粒子设置；旧配置缺省为关闭。</summary>
    public ThemeParticleOptions ThemeParticles { get; set; } = new();
    /// <summary>独立的双击 Ctrl 定位设置；旧配置缺省为关闭。</summary>
    public LocatorOptions Locator { get; set; } = new();
    internal bool ThemeMoves => ThemeParticles.Enabled && ThemeParticles.Trigger is "move" or "both";
    internal void ValidateAdvanced()
    {
        static bool Hex(string? value) => System.Text.RegularExpressions.Regex.IsMatch(value ?? "", "^#[0-9a-fA-F]{6}$");
        if (Charge == null || ThemeParticles == null || Locator == null) throw new ArgumentException("特效配置不能为 null。");
        if (!new[] { "left", "right", "both" }.Contains(Charge.Button) || Charge.DelayMs is < 100 or > 1000 || Charge.FillMs is < 200 or > 2000 || Charge.Radius is < 16 or > 64 || !Hex(Charge.Color)) throw new ArgumentException("长按蓄力参数超出范围。");
        if (!new[] { "click", "move", "both" }.Contains(ThemeParticles.Trigger) || ThemeParticles.Amount is < 2 or > 16 || ThemeParticles.Size is < 12 or > 48 || ThemeParticles.LifeMs is < 300 or > 1800 || string.IsNullOrWhiteSpace(ThemeParticles.Theme)) throw new ArgumentException("主题粒子参数超出范围。");
        if (Locator.DoubleTapMs is < 200 or > 800 || Locator.Radius is < 40 or > 180 || Locator.DurationMs is < 600 or > 3000 || !double.IsFinite(Locator.Dim) || Locator.Dim is < 0 or > .65 || !Hex(Locator.Color)) throw new ArgumentException("鼠标定位参数超出范围。");
    }
}

public sealed partial class EffectsWindow
{
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    /// <summary>是否正在独立输入线程监听双击 Ctrl；关闭、暂停及释放后为 false。</summary>
    public bool CtrlListening => Options.Locator.Enabled && input?.KeyboardListening == true;
    /// <summary>立即定位当前鼠标；定位未开启或特效暂停时返回 false，否则重置定位时长并返回 true。不产生键盘或鼠标输入。</summary>
    public bool Locate()
    {
        if (Paused || !Options.Locator.Enabled || !GetCursorPos(out var point)) return false;
        EnsureViewport(point);
        canvas.ShowLocator(Local(point), Options.Locator); UpdateDimming(); return true;
    }
    /// <summary>替换后续主题粒子使用的透明位图；已有粒子保留原图，空集合停止生成。最多 16 张；须在所属 UI 线程调用。</summary>
    public void SetThemeSprites(IEnumerable<BitmapSource> images) => canvas.SetThemeSprites(images);
}

public sealed partial class ParticleCanvas
{
    sealed record ChargeState(double Born, ChargeOptions Options);
    sealed record Sprite(Point Position, Vector Velocity, double Born, double Life, double Size, double Rotation, BitmapSource Image);
    readonly Dictionary<bool, ChargeState> charges = [];
    readonly List<Sprite> sprites = [];
    BitmapSource[] themeSprites = [];
    Point advancedPoint;
    double locatorBorn = -100, lastEmission = -100;
    LocatorOptions? locator;
    // 独立 ParticleCanvas 仍可绘制预览；桌面宿主使用同一帧的完整遮罩快照。
    internal bool ExternalLocatorRendering;
    internal LocatorFrame? CurrentLocatorFrame => locator != null
        ? new(advancedPoint, locator.Radius, locator.Dim, ParseColor(locator.Color), Math.Clamp((1-(clock.Elapsed.TotalSeconds-locatorBorn)*1000/locator.DurationMs)*5,0,1), true)
        : extraOptions.Spotlight.Enabled ? new(advancedPoint, extraOptions.Spotlight.Size, extraOptions.Spotlight.Opacity, Colors.Transparent, 0, false) : null;
    /// <summary>是否存在长按或定位动画；用于宿主决定是否继续逐帧驱动。</summary>
    public bool HasAdvancedActivity => charges.Count > 0 || locator != null || ExtraActivity;
    /// <summary>当前正在追踪的长按按键数量，最多两个。</summary>
    public int ChargeCount => charges.Count;
    /// <summary>是否正在显示定位光圈。</summary>
    public bool LocatorVisible => locator != null;
    /// <summary>设置后续粒子的透明位图，最多 16 张；图片克隆冻结后缓存，不在每帧解码。</summary>
    public void SetThemeSprites(IEnumerable<BitmapSource> images)
    {
        themeSprites = images.Take(16).Select(image => { var copy = image.Clone(); copy.Freeze(); return copy; }).ToArray();
    }
    /// <summary>开始追踪指定按键的长按；right=true 为右键。未启用或按键不匹配时不产生动画。</summary>
    public void BeginCharge(Point point, ChargeOptions options, bool right = false)
    {
        if (!options.Enabled || (options.Button != "both" && options.Button != (right ? "right" : "left"))) return;
        advancedPoint = point; charges[right] = new(clock.Elapsed.TotalSeconds, options); Activity?.Invoke();
    }
    /// <summary>结束长按；达到等待时间后，按 Release 设置生成散开光环；短按不触发释放效果。</summary>
    public void EndCharge(Point point, bool right = false)
    {
        if (!charges.Remove(right, out var charge)) return;
        var elapsed = clock.Elapsed.TotalSeconds - charge.Born;
        if (elapsed * 1000 >= charge.Options.DelayMs && charge.Options.Release)
            Add(new(point, new Vector(), clock.Elapsed.TotalSeconds, .32, ParseColor(charge.Options.Color), charge.Options.Radius * 1.6, 1, 0));
        InvalidateVisual();
    }
    /// <summary>更新蓄力环和定位圈中心，坐标单位 DIP；不会产生鼠标输入。</summary>
    public void UpdatePointer(Point point) => advancedPoint = point;
    /// <summary>显示或重新开始定位动画，圈跟随 UpdatePointer；设置未启用时不执行。</summary>
    public void ShowLocator(Point point, LocatorOptions options)
    {
        if (!options.Enabled) return;
        locator = options; locatorBorn = clock.Elapsed.TotalSeconds; advancedPoint = point; Activity?.Invoke();
    }
    /// <summary>生成主题贴图粒子；moving=true 为移动触发，按 Trigger 筛选并限制为每 45ms 一批。混合粒子上限 240，贴图上限 96，移动每批最多两个。</summary>
    public void EmitTheme(Point point, ThemeParticleOptions options, bool moving = false)
    {
        if (!options.Enabled || themeSprites.Length == 0 || (options.Trigger != "both" && options.Trigger != (moving ? "move" : "click"))) return;
        var now = clock.Elapsed.TotalSeconds;
        if (now - lastEmission < (moving ? .045 : .035)) return;
        lastEmission = now;
        // 移动每批最多两个；贴图独立预算防止高密度拖尾耗尽帧时间。
        int count = moving ? Math.Min(2, Math.Max(1, options.Amount / 4)) : options.Amount;
        for (int i = 0; i < count; i++)
        {
            if (sprites.Count >= 96) sprites.RemoveAt(0);
            EnsureRoom();
            double angle = random.NextDouble() * Math.PI * 2, speed = moving ? 15 : 35 + random.NextDouble() * 65;
            sprites.Add(new(point, new Vector(Math.Cos(angle) * speed, Math.Sin(angle) * speed - 35), now, options.LifeMs / 1000d, options.Size * (.75 + random.NextDouble() * .25), random.NextDouble() * 50 - 25, themeSprites[random.Next(themeSprites.Length)]));
        }
        Activity?.Invoke();
    }
    void EnsureRoom() { if (Count >= 240) { if (particles.Count > 0) particles.RemoveAt(0); else if (sprites.Count > 0) sprites.RemoveAt(0); else if (ribbons.Count > 0) ribbons.RemoveAt(0); else if (accents.Count > 0) accents.RemoveAt(0); else streams.RemoveAt(0); } }
    void ClearAdvanced() { ClearExtras(); charges.Clear(); sprites.Clear(); ribbons.Clear(); locator = null; lastEmission = -100; }
    void AdvanceAdvanced(double now)
    {
        AdvanceExtras(now);
        ribbons.RemoveAll(segment => now - segment.Born > .34);
        sprites.RemoveAll(sprite => now - sprite.Born > sprite.Life);
        if (locator != null && (now - locatorBorn) * 1000 >= locator.DurationMs) locator = null;
    }
    void RenderAdvanced(DrawingContext drawing, double now)
    {
        if (locator != null && !ExternalLocatorRendering)
        {
            double age = now - locatorBorn, progress = Math.Clamp(age * 1000 / locator.DurationMs, 0, 1);
            double fade = Math.Min(1, (1 - progress) * 5), radius = locator.Radius;
            if (locator.Dim > 0)
            {
                var mask = new GeometryGroup { FillRule = FillRule.EvenOdd };
                mask.Children.Add(new RectangleGeometry(new Rect(0, 0, ActualWidth, ActualHeight)));
                mask.Children.Add(new EllipseGeometry(advancedPoint, radius, radius));
                // 定位孔外使用与原生外围窗口完全一致的黑色和 alpha。
                drawing.DrawGeometry(DimmingBrush(locator.Dim), null, mask);
            }
            var brush = BrushFor(ParseColor(locator.Color), fade);
            drawing.DrawEllipse(null, PenFor(brush, 4), advancedPoint, radius, radius);
            drawing.DrawEllipse(null, PenFor(brush, 1.5), advancedPoint, radius + 8, radius + 8);
        }
        foreach (var charge in charges.Values)
        {
            double held = (now - charge.Born) * 1000 - charge.Options.DelayMs;
            if (held < 0) continue;
            double progress = Math.Clamp(held / charge.Options.FillMs, 0, 1), radius = charge.Options.Radius;
            var color = ParseColor(charge.Options.Color);
            drawing.DrawEllipse(null, PenFor(BrushFor(color, .22), 4), advancedPoint, radius, radius);
            var pen = PenFor(BrushFor(color, .95), 4);
            if (progress >= .999) drawing.DrawEllipse(null, pen, advancedPoint, radius, radius);
            else if (progress > 0)
            {
                var arc = new StreamGeometry();
                using (var context = arc.Open())
                {
                    context.BeginFigure(advancedPoint + new Vector(0, -radius), false, false);
                    double angle = progress * Math.PI * 2 - Math.PI / 2;
                    context.ArcTo(advancedPoint + new Vector(Math.Cos(angle) * radius, Math.Sin(angle) * radius), new Size(radius, radius), 0, progress > .5, SweepDirection.Clockwise, true, false);
                }
                arc.Freeze(); drawing.DrawGeometry(null, pen, arc);
            }
        }
        foreach (var sprite in sprites)
        {
            double age = now - sprite.Born, progress = Math.Clamp(age / sprite.Life, 0, 1);
            var point = sprite.Position + sprite.Velocity * age + new Vector(0, 18 * age * age);
            double size = sprite.Size * (1 - progress * .25), ratio = (double)sprite.Image.PixelWidth / sprite.Image.PixelHeight;
            double width = ratio >= 1 ? size : size * ratio, height = ratio >= 1 ? size / ratio : size;
            drawing.PushOpacity(Math.Min(1, (1 - progress) * 3));
            drawing.DrawImage(sprite.Image, new Rect(point.X - width / 2, point.Y - height / 2, width, height));
            drawing.Pop();
        }
    }
}
