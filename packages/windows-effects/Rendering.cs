using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace SiaWebUI.Windows.Effects;

public sealed partial class EffectsWindow
{
    readonly LocatorLayer locatorLayer = new();
    readonly CursorTail tail = new();
    Int32Rect viewport;
    /// <summary>动态覆盖层物理像素面积；只覆盖指针附近区域，用于性能诊断。</summary>
    public long DynamicPixelArea => (long)viewport.Width * viewport.Height;
    void EnsureViewport(NativePoint point, bool force = false)
    {
        if (hwnd == IntPtr.Zero) return;
        double scale = VisualTreeHelper.GetDpi(this).DpiScaleX;
        int edge = (int)Math.Ceiling(512 * scale), margin = (int)Math.Ceiling(192 * scale);
        if (!force && viewport.Width == edge && point.X >= viewport.X + margin && point.X <= viewport.X + edge - margin && point.Y >= viewport.Y + margin && point.Y <= viewport.Y + edge - margin) return;
        var next = new Int32Rect(point.X - edge / 2, point.Y - edge / 2, edge, edge);
        var delta = new Vector((viewport.X - next.X) / scale, (viewport.Y - next.Y) / scale);
        canvas.Shift(delta);
        if (previous is Point old) previous = old + delta;
        viewport = next;
        SetWindowPos(hwnd, new IntPtr(-1), next.X, next.Y, edge, edge, 0x0010);
    }
    Point TailPoint(Point hotspot)
    {
        var offset = tail.Read();
        var scale = VisualTreeHelper.GetDpi(this);
        return hotspot + new Vector(offset.X / scale.DpiScaleX, offset.Y / scale.DpiScaleY);
    }
    // 遮罩以屏幕物理坐标单次提交，与移动的粒子画布脱钩。
    void UpdateDimming(bool moved = false)
    {
        var scale = VisualTreeHelper.GetDpi(this);
        var frame = canvas.CurrentLocatorFrame;
        if (frame is LocatorFrame value)
            frame = value with { Center = new Point(viewport.X + value.Center.X * scale.DpiScaleX, viewport.Y + value.Center.Y * scale.DpiScaleY), Radius = value.Radius * scale.DpiScaleX };
        locatorLayer.Sync(frame, new Int32Rect(GetSystemMetrics(76), GetSystemMetrics(77), GetSystemMetrics(78), GetSystemMetrics(79)), scale.DpiScaleX);
    }

}

// 按实际指针的可见底边计算尾端；缓存句柄结果，不逐帧解码位图或反复获取 GDI 对象。
internal sealed class CursorTail
{
    [StructLayout(LayoutKind.Sequential)] struct CursorInfo { public int Size, Flags; public IntPtr Handle; public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] struct IconInfo { public int Icon; public uint X, Y; public IntPtr Mask, Color; }
    [DllImport("user32.dll")] static extern bool GetCursorInfo(ref CursorInfo info);
    [DllImport("user32.dll")] static extern bool GetIconInfo(IntPtr handle, out IconInfo info);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr handle);
    readonly Dictionary<IntPtr, Vector> cache = [];
    readonly System.Diagnostics.Stopwatch age = System.Diagnostics.Stopwatch.StartNew();
    internal Vector Read()
    {
        // 系统可能复用指针句柄，定时失效兼容外部修改方案和大小。
        if (age.ElapsedMilliseconds > 2000) { cache.Clear(); age.Restart(); }
        var info = new CursorInfo { Size = Marshal.SizeOf<CursorInfo>() };
        if (!GetCursorInfo(ref info) || info.Handle == IntPtr.Zero) return new(12, 24);
        if (cache.TryGetValue(info.Handle, out var offset)) return offset;
        if (!GetIconInfo(info.Handle, out var icon)) return new(12, 24);
        try
        {
            var image = Imaging.CreateBitmapSourceFromHIcon(info.Handle, Int32Rect.Empty, BitmapSizeOptions.FromEmptyOptions());
            offset = ParticleCanvas.FindTailOffset(image, new Point(icon.X, icon.Y));
            if (cache.Count >= 64) cache.Clear(); cache[info.Handle] = offset; return offset;
        }
        catch { return new(12, 24); }
        finally { if (icon.Mask != IntPtr.Zero) DeleteObject(icon.Mask); if (icon.Color != IntPtr.Zero) DeleteObject(icon.Color); }
    }
    internal void Clear() => cache.Clear();
}

public sealed partial class ParticleCanvas
{
    sealed record Ribbon(Point From, Point To, double Born, Color Color, double Width);
    readonly List<Ribbon> ribbons = [];
    static readonly Dictionary<string, Color> colors = [];
    static readonly Dictionary<(Color, int), SolidColorBrush> brushes = [];
    static readonly Dictionary<(Brush, int), Pen> pens = [];
    // 遮罩采用同一份 8 位 alpha；不使用粒子画笔的 32 档透明度量化，避免拼接亮度差。
    static readonly Dictionary<byte, SolidColorBrush> dimmingBrushes = [];
    internal static byte DimmingAlpha(double opacity) => (byte)Math.Round(Math.Clamp(opacity, 0, 1) * 255);
    static SolidColorBrush DimmingBrush(double opacity)
    {
        byte alpha = DimmingAlpha(opacity);
        if (!dimmingBrushes.TryGetValue(alpha, out var brush))
        {
            brush = new SolidColorBrush(Color.FromArgb(alpha,0,0,0)); brush.Freeze(); dimmingBrushes[alpha] = brush;
        }
        return brush;
    }
    static Color ParseColor(string hex)
    {
        if (colors.TryGetValue(hex, out var value)) return value;
        if (colors.Count >= 64) colors.Clear(); return colors[hex] = (Color)ColorConverter.ConvertFromString(hex);
    }
    internal static SolidColorBrush BrushFor(Color color, double opacity)
    {
        var key = (color, (int)Math.Round(Math.Clamp(opacity, 0, 1) * 32));
        if (brushes.TryGetValue(key, out var value)) return value;
        if (brushes.Count >= 1024) { brushes.Clear(); pens.Clear(); }
        value = new SolidColorBrush(color) { Opacity = key.Item2 / 32d }; value.Freeze(); brushes[key] = value; return value;
    }
    static Pen PenFor(Brush brush, double width)
    {
        var key = (brush, (int)Math.Round(width * 4));
        if (pens.TryGetValue(key, out var value)) return value;
        if (pens.Count >= 2048) pens.Clear();
        value = new Pen(brush, Math.Max(.25, key.Item2 / 4d)) { StartLineCap = PenLineCap.Round, EndLineCap = PenLineCap.Round }; value.Freeze(); pens[key] = value; return value;
    }
    internal void Shift(Vector delta)
    {
        for (int i = 0; i < particles.Count; i++) particles[i] = particles[i] with { Position = particles[i].Position + delta };
        for (int i = 0; i < sprites.Count; i++) sprites[i] = sprites[i] with { Position = sprites[i].Position + delta };
        for (int i = 0; i < ribbons.Count; i++) ribbons[i] = ribbons[i] with { From = ribbons[i].From + delta, To = ribbons[i].To + delta };
        advancedPoint += delta; ShiftExtras(delta);
    }
    /// <summary>从透明指针位图最底部可见像素计算尾端相对热点的物理像素偏移；忽略透明留白，空图返回零偏移。</summary>
    public static Vector FindTailOffset(BitmapSource image, Point hotspot)
    {
        var converted = new FormatConvertedBitmap(image, PixelFormats.Bgra32, null, 0);
        int width = converted.PixelWidth, height = converted.PixelHeight;
        var data = new byte[width * height * 4]; converted.CopyPixels(data, width * 4, 0);
        for (int y = height - 1; y >= 0; y--)
        {
            double total = 0, xSum = 0;
            for (int x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] >= 96) { total++; xSum += x; }
            if (total > 0) return new Vector(xSum / total - hotspot.X, y + 2 - hotspot.Y);
        }
        return new Vector();
    }
    void RenderRibbon(DrawingContext drawing, double now)
    {
        foreach (var segment in ribbons)
        {
            double fade = Math.Clamp(1 - (now - segment.Born) / .34, 0, 1);
            double width = segment.Width * fade;
            drawing.DrawLine(PenFor(BrushFor(segment.Color, fade * .12), width * 2.6), segment.From, segment.To);
            drawing.DrawLine(PenFor(BrushFor(segment.Color, fade * .65), width), segment.From, segment.To);
            drawing.DrawLine(PenFor(BrushFor(Colors.White, fade * .65), width * .28), segment.From, segment.To);
        }
    }
}
