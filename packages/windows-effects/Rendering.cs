using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace SiaWebUI.Windows.Effects;

public sealed partial class EffectsWindow
{
    readonly List<IntPtr> dimPanes = [];
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern IntPtr CreateWindowEx(int exStyle, string name, string? text, uint style, int x, int y, int width, int height, IntPtr parent, IntPtr menu, IntPtr instance, IntPtr parameter);
    [DllImport("user32.dll")] static extern bool DestroyWindow(IntPtr window);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("user32.dll")] static extern bool SetLayeredWindowAttributes(IntPtr window, uint color, byte alpha, uint flags);
    readonly CursorTail tail = new();
    Int32Rect viewport;
    double lastDim = -1;
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
        UpdateDimming(true);
    }
    Point TailPoint(Point hotspot)
    {
        var offset = tail.Read();
        var scale = VisualTreeHelper.GetDpi(this);
        return hotspot + new Vector(offset.X / scale.DpiScaleX, offset.Y / scale.DpiScaleY);
    }
    void UpdateDimming(bool moved = false)
    {
        double dim = canvas.LocatorVisible ? Options.Locator.Dim : 0;
        if (!moved && dim == lastDim) return;
        lastDim = dim;
        if (dim == 0) { foreach (var pane in dimPanes) ShowWindow(pane, 0); return; }
        // 四块静态外围遮罩不订阅逐帧绘制；只有局部窗口中的圆形镂空跟随指针重绘。
        while (dimPanes.Count < 4)
        {
            // 原生纯色分层窗口由 DWM 合成，不创建全屏 WPF 渲染目标或参与逐帧回调。
            var pane = CreateWindowEx(0x80800A8, "STATIC", null, 0x80000004, -10000, -10000, 1, 1, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
            if (pane == IntPtr.Zero) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "无法创建定位遮罩。");
            dimPanes.Add(pane);
        }
        int left = GetSystemMetrics(76), top = GetSystemMetrics(77), right = left + GetSystemMetrics(78), bottom = top + GetSystemMetrics(79);
        int x1 = Math.Clamp(viewport.X, left, right), x2 = Math.Clamp(viewport.X + viewport.Width, left, right);
        int y1 = Math.Clamp(viewport.Y, top, bottom), y2 = Math.Clamp(viewport.Y + viewport.Height, top, bottom);
        var rects = new[] { new Int32Rect(left, top, right-left, y1-top), new Int32Rect(left, y2, right-left, bottom-y2), new Int32Rect(left, y1, x1-left, y2-y1), new Int32Rect(x2, y1, right-x2, y2-y1) };
        for (int i = 0; i < 4; i++)
        {
            var rect = rects[i]; var pane = dimPanes[i];
            if (rect.Width == 0 || rect.Height == 0) { ShowWindow(pane, 0); continue; }
            SetLayeredWindowAttributes(pane, 0, (byte)Math.Round(dim * 255), 2); ShowWindow(pane, 4);
            SetWindowPos(pane, new IntPtr(-1), rect.X, rect.Y, rect.Width, rect.Height, 0x0010);
        }
        SetWindowPos(hwnd, new IntPtr(-1), 0, 0, 0, 0, 0x0013);
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
        advancedPoint += delta;
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
