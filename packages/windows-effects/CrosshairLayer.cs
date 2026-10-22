using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Windows;

namespace SiaWebUI.Windows.Effects;

// 两条细长原生分层窗口只提交线条像素，不创建整屏透明位图；坐标始终使用物理像素。
internal sealed class CrosshairLayer : IDisposable
{
    [StructLayout(LayoutKind.Sequential)] internal struct Pair { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] struct Box { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] struct MonitorInfo { public int Size; public Box Monitor, Work; public uint Flags; }
    [DllImport("user32.dll")] static extern IntPtr MonitorFromPoint(Pair point, uint flags);
    [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);
    [DllImport("shcore.dll")] static extern int GetDpiForMonitor(IntPtr monitor, int kind, out uint x, out uint y);
    readonly Stripe horizontal = new(), vertical = new();
    // 只读诊断供宿主检查静止去重与细条绘制预算，不影响帧调度。
    internal long Submissions => horizontal.Submissions + vertical.Submissions;
    internal long PixelArea => horizontal.PixelArea + vertical.PixelArea;
    internal bool Visible => horizontal.Visible || vertical.Visible;

    internal void Sync(int x, int y, AccentOptions options)
    {
        if (!options.Enabled || options.Opacity == 0) { Hide(); return; }
        var monitor = MonitorFromPoint(new Pair { X = x, Y = y }, 2);
        var info = new MonitorInfo { Size = Marshal.SizeOf<MonitorInfo>() };
        if (!GetMonitorInfo(monitor, ref info)) { Hide(); return; }
        double scale = GetDpiForMonitor(monitor, 0, out uint dpi, out _) == 0 ? dpi / 96d : 1;
        SyncAt(x, y, new Int32Rect(info.Monitor.Left, info.Monitor.Top,
            info.Monitor.Right - info.Monitor.Left, info.Monitor.Bottom - info.Monitor.Top), scale, options);
    }
    internal void SyncAt(int x, int y, Int32Rect screen, double scale, AccentOptions options)
    {
        if (!options.Enabled || options.Opacity == 0) { Hide(); return; }
        var (h, v) = Layout(x, y, screen, Math.Max(1, (int)Math.Round(options.Thickness * scale)));
        horizontal.Sync(h, options, -1, 0);
        // 竖线在交点处留出横线厚度，避免半透明叠加导致中心变深。
        vertical.Sync(v, options, h.Y - screen.Y, h.Height);
    }
    internal static (Int32Rect Horizontal, Int32Rect Vertical) Layout(int x, int y, Int32Rect screen, int thickness)
    {
        int left = Math.Max(screen.X, x - thickness / 2), top = Math.Max(screen.Y, y - thickness / 2);
        int right = Math.Min(screen.X + screen.Width, x - thickness / 2 + thickness);
        int bottom = Math.Min(screen.Y + screen.Height, y - thickness / 2 + thickness);
        return (new(screen.X, top, screen.Width, Math.Max(0, bottom - top)),
            new(left, screen.Y, Math.Max(0, right - left), screen.Height));
    }
    internal void Hide() { horizontal.Hide(); vertical.Hide(); }
    public void Dispose() { horizontal.Dispose(); vertical.Dispose(); }

    // 位图仅在屏幕或线宽变化时重新分配；位置、颜色、透明度均不变时不重复提交。
    sealed unsafe class Stripe : IDisposable
    {
        [StructLayout(LayoutKind.Sequential, Pack = 1)] struct Blend { public byte Operation, Flags, Alpha, Format; }
        [StructLayout(LayoutKind.Sequential)] struct Header { public uint Size; public int Width, Height; public ushort Planes, Bits; public uint Compression, ImageSize; public int XPixels, YPixels; public uint Colors, Important; }
        [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr source);
        [DllImport("gdi32.dll")] static extern IntPtr CreateDIBSection(IntPtr dc, ref Header info, uint usage, out IntPtr pixels, IntPtr section, uint offset);
        [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc, IntPtr value);
        [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr value);
        [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr dc);
        [DllImport("user32.dll", SetLastError = true)] static extern bool UpdateLayeredWindow(IntPtr window, IntPtr destination, ref Pair position, ref Pair size, IntPtr source, ref Pair origin, uint key, ref Blend blend, uint flags);
        [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr window, int command);
        [DllImport("user32.dll")] static extern bool DestroyWindow(IntPtr window);
        IntPtr hwnd, dc, bitmap, original, pixels;
        Int32Rect bounds;
        (int Color, int Gap, int Height)? last;
        internal bool Visible { get; private set; }
        internal long Submissions { get; private set; }
        internal long PixelArea => Visible ? (long)bounds.Width * bounds.Height : 0;
        internal void Sync(Int32Rect next, AccentOptions options, int gap, int gapHeight)
        {
            if (next.Width == 0 || next.Height == 0) { Hide(); return; }
            int rgb = Convert.ToInt32(options.Color[1..], 16), alpha = (int)Math.Round(options.Opacity * 255);
            int color = (alpha << 24) | ((((rgb >> 16) & 255) * alpha / 255) << 16)
                | ((((rgb >> 8) & 255) * alpha / 255) << 8) | ((rgb & 255) * alpha / 255);
            var state = (color, gap, gapHeight);
            if (Visible && bounds == next && last == state) return;
            if (hwnd == IntPtr.Zero || bounds.Width != next.Width || bounds.Height != next.Height)
            {
                Dispose();
                try
                {
                    hwnd = DimmingPane.Create(); dc = CreateCompatibleDC(IntPtr.Zero);
                    var header = new Header { Size = (uint)Marshal.SizeOf<Header>(), Width = next.Width, Height = -next.Height, Planes = 1, Bits = 32 };
                    bitmap = CreateDIBSection(dc, ref header, 0, out pixels, IntPtr.Zero, 0);
                    if (dc == IntPtr.Zero || bitmap == IntPtr.Zero || pixels == IntPtr.Zero) throw new InvalidOperationException("无法创建十字辅助线位图。");
                    original = SelectObject(dc, bitmap);
                }
                catch { Dispose(); throw; }
            }
            new Span<int>((void*)pixels, next.Width * next.Height).Fill(color);
            if (gap >= 0 && gapHeight > 0)
                new Span<int>((int*)pixels + gap * next.Width, gapHeight * next.Width).Clear();
            var position = new Pair { X = next.X, Y = next.Y }; var size = new Pair { X = next.Width, Y = next.Height };
            var origin = new Pair(); var blend = new Blend { Alpha = 255, Format = 1 };
            if (!UpdateLayeredWindow(hwnd, IntPtr.Zero, ref position, ref size, dc, ref origin, 0, ref blend, 2))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "无法提交十字辅助线。");
            if (!Visible) ShowWindow(hwnd, 4);
            Visible = true; bounds = next; last = state; Submissions++;
        }
        internal void Hide() { if (Visible) ShowWindow(hwnd, 0); Visible = false; }
        public void Dispose()
        {
            Hide();
            if (hwnd != IntPtr.Zero) DestroyWindow(hwnd);
            if (original != IntPtr.Zero && dc != IntPtr.Zero) SelectObject(dc, original);
            if (bitmap != IntPtr.Zero) DeleteObject(bitmap);
            if (dc != IntPtr.Zero) DeleteDC(dc);
            hwnd = dc = bitmap = original = pixels = IntPtr.Zero; last = null;
        }
    }
}
