using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace SiaWebUI.Windows.Effects;

// 待机伙伴有独立的小型原生图层；鼠标移动后仅原位渐隐，不搬动主画布上的旧帧。
internal sealed class IdleLayer : IDisposable
{
    [StructLayout(LayoutKind.Sequential)] struct Pair { public int X,Y; }
    [StructLayout(LayoutKind.Sequential,Pack=1)] struct Blend { public byte Operation,Flags,Alpha,Format; }
    [StructLayout(LayoutKind.Sequential)] struct Header { public uint Size;public int Width,Height;public ushort Planes,Bits;public uint Compression,ImageSize;public int XPixels,YPixels;public uint Colors,Important; }
    [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr source);
    [DllImport("gdi32.dll")] static extern IntPtr CreateDIBSection(IntPtr dc,ref Header info,uint usage,out IntPtr pixels,IntPtr section,uint offset);
    [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc,IntPtr value);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr value);
    [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr dc);
    [DllImport("user32.dll",SetLastError=true)] static extern bool UpdateLayeredWindow(IntPtr window,IntPtr destination,ref Pair position,ref Pair size,IntPtr source,ref Pair origin,uint key,ref Blend blend,uint flags);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr window,int command);
    [DllImport("user32.dll")] static extern bool DestroyWindow(IntPtr window);
    readonly Dictionary<BitmapSource,byte[]> cache=[];
    IntPtr hwnd,dc,bitmap,original,pixels;
    int edge;
    BitmapSource? currentImage;
    ParticleCanvas.IdleVisual? previous;
    internal bool Visible { get; private set; }
    internal void Sync(ParticleCanvas.IdleVisual? frame)
    {
        if(frame is not {} value || value.Opacity<=0) { if(Visible) ShowWindow(hwnd,0);Visible=false;previous=null;return; }
        int size=(int)Math.Ceiling(value.Size)+4;
        if(hwnd==IntPtr.Zero||edge!=size) { Dispose();Create(size); }
        if(Visible&&previous==value) return;
        if(currentImage!=value.Image)
        {
            if(!cache.TryGetValue(value.Image,out var buffer))
            {
                // 两帧贴图按当前物理尺寸缓存，渐隐只改窗口alpha，不重新缩放贴图。
                var visual=new DrawingVisual();
                using(var drawing=visual.RenderOpen())
                {
                    double ratio=(double)value.Image.PixelWidth/value.Image.PixelHeight;
                    double width=ratio>=1?value.Size:value.Size*ratio,height=ratio>=1?value.Size/ratio:value.Size;
                    drawing.DrawImage(value.Image,new Rect((edge-width)/2,(edge-height)/2,width,height));
                }
                var image=new RenderTargetBitmap(edge,edge,96,96,PixelFormats.Pbgra32);image.Render(visual);
                buffer=new byte[edge*edge*4];image.CopyPixels(buffer,edge*4,0);
                if(cache.Count>=4) cache.Clear();cache[value.Image]=buffer;
            }
            Marshal.Copy(buffer,0,pixels,buffer.Length);currentImage=value.Image;
        }
        var position=new Pair { X=(int)Math.Round(value.Position.X-edge*.5),Y=(int)Math.Round(value.Position.Y-edge*.5) };
        var extent=new Pair { X=edge,Y=edge };var origin=new Pair();var blend=new Blend { Alpha=(byte)Math.Round(255*value.Opacity),Format=1 };
        if(!UpdateLayeredWindow(hwnd,IntPtr.Zero,ref position,ref extent,dc,ref origin,0,ref blend,2)) throw new Win32Exception(Marshal.GetLastWin32Error(),"无法提交待机动画。");
        if(!Visible) ShowWindow(hwnd,4);Visible=true;previous=value;
    }
    void Create(int size)
    {
        edge=size;
        try
        {
            hwnd=DimmingPane.Create();dc=CreateCompatibleDC(IntPtr.Zero);
            var header=new Header { Size=(uint)Marshal.SizeOf<Header>(),Width=edge,Height=-edge,Planes=1,Bits=32 };
            bitmap=CreateDIBSection(dc,ref header,0,out pixels,IntPtr.Zero,0);
            if(dc==IntPtr.Zero||bitmap==IntPtr.Zero||pixels==IntPtr.Zero) throw new InvalidOperationException("无法创建待机动画位图。");
            original=SelectObject(dc,bitmap);
        }
        catch { Dispose();throw; }
    }
    public void Dispose()
    {
        // 暂停、关闭和尺寸变化时及时释放原生资源；普通消退仅隐藏以供再次待机复用。
        if(hwnd!=IntPtr.Zero) DestroyWindow(hwnd);
        if(original!=IntPtr.Zero&&dc!=IntPtr.Zero) SelectObject(dc,original);
        if(bitmap!=IntPtr.Zero) DeleteObject(bitmap);
        if(dc!=IntPtr.Zero) DeleteDC(dc);
        hwnd=bitmap=dc=original=pixels=IntPtr.Zero;Visible=false;previous=null;currentImage=null;cache.Clear();
    }
}
