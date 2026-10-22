using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Media;

namespace SiaWebUI.Windows.Effects;

// 圆孔、圆环和背景在同一固定窗口内原子提交，避免多个 HWND 与 WPF 旧帧互相错位。
internal readonly record struct LocatorFrame(Point Center,double Radius,double Dim,Color Color,double Fade,bool Ring);
internal sealed unsafe class LocatorLayer : IDisposable
{
    [StructLayout(LayoutKind.Sequential)] struct Pair { public int X,Y; }
    [StructLayout(LayoutKind.Sequential)] struct Box { public int Left,Top,Right,Bottom; }
    [StructLayout(LayoutKind.Sequential,Pack=1)] struct Blend { public byte Operation,Flags,Alpha,Format; }
    [StructLayout(LayoutKind.Sequential)] struct Header { public uint Size;public int Width,Height;public ushort Planes,Bits;public uint Compression,ImageSize;public int XPixels,YPixels;public uint Colors,Important; }
    [StructLayout(LayoutKind.Sequential)] struct Update { public uint Size;public IntPtr Destination;public Pair* Position;public Pair* Extent;public IntPtr Source;public Pair* Origin;public uint Key;public Blend* Blend;public uint Flags;public Box* Dirty; }
    [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr source);
    [DllImport("gdi32.dll")] static extern IntPtr CreateDIBSection(IntPtr dc,ref Header info,uint usage,out IntPtr pixels,IntPtr section,uint offset);
    [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc,IntPtr value);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr value);
    [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr dc);
    [DllImport("user32.dll",SetLastError=true)] static extern bool UpdateLayeredWindowIndirect(IntPtr window,ref Update info);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr window,int command);
    [DllImport("user32.dll")] static extern bool DestroyWindow(IntPtr window);
    IntPtr hwnd,dc,bitmap,original,pixels;
    Int32Rect bounds;
    Box previous;
    int lastAlpha=-1;
    LocatorFrame? lastFrame;
    double lastScale;
    internal bool Visible { get; private set; }
    internal long UpdatedPixels { get; private set; }
    internal void Sync(LocatorFrame? frame,Int32Rect desktop,double scale)
    {
        if(frame is not LocatorFrame value) { Hide();return; }
        if(hwnd==IntPtr.Zero||desktop!=bounds) { Dispose();Create(desktop); }
        if(Visible&&lastFrame==frame&&lastScale==scale) return;
        double cx=value.Center.X-bounds.X,cy=value.Center.Y-bounds.Y,r=value.Radius;
        int padding=(int)Math.Ceiling(r+12*scale);
        var next=Clip(new Box { Left=(int)Math.Floor(cx)-padding,Top=(int)Math.Floor(cy)-padding,Right=(int)Math.Ceiling(cx)+padding+1,Bottom=(int)Math.Ceiling(cy)+padding+1 });
        int alpha=ParticleCanvas.DimmingAlpha(value.Dim);
        bool full=lastAlpha!=alpha||!Visible;
        var dirty=full?new Box { Right=bounds.Width,Bottom=bounds.Height }:new Box { Left=Math.Min(previous.Left,next.Left),Top=Math.Min(previous.Top,next.Top),Right=Math.Max(previous.Right,next.Right),Bottom=Math.Max(previous.Bottom,next.Bottom) };
        // 复用整张 DIB，平时只恢复旧圆孔与新圆孔的包围区域；桌面其他像素保持不变。
        int background=alpha<<24;
        for(int y=dirty.Top;y<dirty.Bottom;y++) new Span<int>((int*)pixels+y*bounds.Width+dirty.Left,dirty.Right-dirty.Left).Fill(background);
        for(int y=next.Top;y<next.Bottom;y++) for(int x=next.Left;x<next.Right;x++)
        {
            double distance=Math.Sqrt((x+.5-cx)*(x+.5-cx)+(y+.5-cy)*(y+.5-cy));
            double outside=Math.Clamp(distance-r+.5,0,1),a=alpha*outside;
            // 圆环与镂空共用物理像素中心；一像素覆盖率平滑边缘，不单独移动环窗口。
            double ring=value.Ring?Math.Max(Math.Clamp(2*scale+.5-Math.Abs(distance-r),0,1),Math.Clamp(.75*scale+.5-Math.Abs(distance-r-8*scale),0,1))*value.Fade:0;
            int oa=(int)Math.Round(255*ring+a*(1-ring));
            int red=(int)Math.Round(value.Color.R*ring),green=(int)Math.Round(value.Color.G*ring),blue=(int)Math.Round(value.Color.B*ring);
            ((int*)pixels)[y*bounds.Width+x]=(oa<<24)|(red<<16)|(green<<8)|blue;
        }
        var position=new Pair { X=bounds.X,Y=bounds.Y };var extent=new Pair { X=bounds.Width,Y=bounds.Height };var origin=new Pair();var blend=new Blend { Alpha=255,Format=1 };
        var update=new Update { Size=(uint)Marshal.SizeOf<Update>(),Position=&position,Extent=&extent,Source=dc,Origin=&origin,Blend=&blend,Flags=2,Dirty=&dirty };
        // 一次提交同时改变遮罩、镂空和圈；没有分块窗口的中间状态。
        if(!UpdateLayeredWindowIndirect(hwnd,ref update)) throw new Win32Exception(Marshal.GetLastWin32Error(),"无法提交定位遮罩。");
        if(!Visible) ShowWindow(hwnd,4);
        Visible=true;previous=next;lastAlpha=alpha;lastFrame=frame;lastScale=scale;
        UpdatedPixels=(long)(dirty.Right-dirty.Left)*(dirty.Bottom-dirty.Top);
    }
    Box Clip(Box value)=>new() { Left=Math.Clamp(value.Left,0,bounds.Width),Top=Math.Clamp(value.Top,0,bounds.Height),Right=Math.Clamp(value.Right,0,bounds.Width),Bottom=Math.Clamp(value.Bottom,0,bounds.Height) };
    void Create(Int32Rect desktop)
    {
        bounds=desktop;
        try
        {
            hwnd=DimmingPane.Create();dc=CreateCompatibleDC(IntPtr.Zero);
            var header=new Header { Size=(uint)Marshal.SizeOf<Header>(),Width=bounds.Width,Height=-bounds.Height,Planes=1,Bits=32 };
            bitmap=CreateDIBSection(dc,ref header,0,out pixels,IntPtr.Zero,0);
            if(dc==IntPtr.Zero||bitmap==IntPtr.Zero||pixels==IntPtr.Zero) throw new InvalidOperationException("无法创建定位遮罩位图。");
            original=SelectObject(dc,bitmap);
        }
        catch { Dispose();throw; }
    }
    internal void Hide() { if(Visible) ShowWindow(hwnd,0);Visible=false;lastFrame=null; }
    public void Dispose()
    {
        Hide();
        if(hwnd!=IntPtr.Zero) { DestroyWindow(hwnd);hwnd=IntPtr.Zero; }
        if(original!=IntPtr.Zero&&dc!=IntPtr.Zero) SelectObject(dc,original);
        if(bitmap!=IntPtr.Zero) DeleteObject(bitmap);
        if(dc!=IntPtr.Zero) DeleteDC(dc);
        bitmap=dc=original=pixels=IntPtr.Zero;lastAlpha=-1;
    }
}
