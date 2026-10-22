using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows;

namespace SiaWebUI.Windows.Effects;

// 星光写入固定小块原生分层窗口，不为每个网格创建独立的 WPF 渲染目标。
internal sealed class StationaryStarLayer : IDisposable
{
    const int Cell=256,Limit=8,CacheLimit=16;
    readonly Dictionary<(int X,int Y),Tile> tiles=[];
    readonly Dictionary<(int Size,string Color,int Fade),Sprite> sprites=[];
    // 可选诊断记录原生提交回调；正常运行不保存逐帧数据。
    internal Action<int,int,TimeSpan>? FrameDrawn=null;
    internal static (int X,int Y) Grid(Point point)=>((int)Math.Floor(point.X/Cell),(int)Math.Floor(point.Y/Cell));
    internal int TileCount=>tiles.Values.Count(tile=>tile.Visible);
    internal long PixelArea=>tiles.Values.Where(tile=>tile.Visible).Sum(tile=>(long)tile.Edge*tile.Edge);
    internal void Sync(ParticleCanvas source)
    {
        var stars=source.StationaryStars.ToArray();
        var active=stars.Reverse().Select(value=>Grid(value.Position)).Distinct().Take(Limit).ToHashSet();
        source.RetainStationaryStars(active);
        foreach(var pair in tiles) if(!active.Contains(pair.Key)) pair.Value.Hide();
        double now=source.StarTime;
        foreach(var key in active)
        {
            if(!tiles.TryGetValue(key,out var tile))
            {
                if(tiles.Count>=CacheLimit) { var old=tiles.Keys.First(value=>!active.Contains(value)); tiles[old].Dispose(); tiles.Remove(old); }
                int padding=Math.Max(32,(int)Math.Ceiling(stars.Where(value=>Grid(value.Position)==key).Max(value=>value.Options.Size*value.PixelScale*.5))+3);
                tile=new Tile(key.X*Cell-padding,key.Y*Cell-padding,Cell+2*padding); tiles.Add(key,tile);
            }
            tile.Clear();
            foreach(var star in stars)
            {
                if(Grid(star.Position)!=key) continue;
                int fade=(int)Math.Round(Math.Clamp(1-(now-star.Born)*1000/star.Options.DurationMs,0,1)*64);
                if(fade==0) continue;
                var spriteKey=((int)Math.Ceiling(star.Options.Size*star.PixelScale),star.Options.Color,fade);
                if(!sprites.TryGetValue(spriteKey,out var sprite))
                {
                    if(sprites.Count>=256) sprites.Clear();
                    sprites[spriteKey]=sprite=MakeSprite(spriteKey.Item1,spriteKey.Item2,fade);
                }
                tile.Blend(sprite,star.Position);
            }
            tile.Present();
            FrameDrawn?.Invoke(key.X,key.Y,TimeSpan.FromSeconds(Stopwatch.GetTimestamp()/(double)Stopwatch.Frequency));
        }
    }
    internal void Clear() { foreach(var tile in tiles.Values) tile.Dispose(); tiles.Clear(); }
    public void Dispose() { Clear(); sprites.Clear(); }
    sealed record Sprite(int Edge,byte[] Pixels);
    static Sprite MakeSprite(int size,string color,int step)
    {
        // 64级淡出纹理缓存；边长恒定且为偶数，缩小不会改变图案中心或导致像素跳动。
        int edge=2*((int)Math.Ceiling(size/2d)+2); var data=new byte[edge*edge*4];
        int rgb=Convert.ToInt32(color[1..],16); double fade=step/64d,radius=size*fade*.5;
        for(int y=0;y<edge;y++) for(int x=0;x<edge;x++)
        {
            int covered=0;
            // 八边四角星，4×4子像素覆盖采样；缓存命中后不重新栅格化。
            for(int sy=0;sy<4;sy++) for(int sx=0;sx<4;sx++)
            {
                double dx=Math.Abs(x+(sx+.5)/4-edge*.5)/radius,dy=Math.Abs(y+(sy+.5)/4-edge*.5)/radius;
                if(Math.Max(dx,dy)+Math.Min(dx,dy)*(.77/.23)<=1) covered++;
            }
            int alpha=(int)Math.Round(255*fade*covered/16),at=(y*edge+x)*4;
            data[at]=(byte)((rgb&255)*alpha/255);data[at+1]=(byte)(((rgb>>8)&255)*alpha/255);data[at+2]=(byte)(((rgb>>16)&255)*alpha/255);data[at+3]=(byte)alpha;
        }
        return new(edge,data);
    }
    [StructLayout(LayoutKind.Sequential)] struct NativePoint { public int X,Y; }
    [StructLayout(LayoutKind.Sequential)] struct Size { public int Width,Height; }
    [StructLayout(LayoutKind.Sequential,Pack=1)] struct BlendFunction { public byte Operation,Flags,Alpha,Format; }
    [StructLayout(LayoutKind.Sequential)] struct BitmapHeader { public uint Size; public int Width,Height; public ushort Planes,Bits; public uint Compression,ImageSize; public int XPixels,YPixels; public uint Colors,Important; }
    [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr source);
    [DllImport("gdi32.dll")] static extern IntPtr CreateDIBSection(IntPtr dc,ref BitmapHeader info,uint usage,out IntPtr pixels,IntPtr section,uint offset);
    [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc,IntPtr obj);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr obj);
    [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr dc);
    [DllImport("user32.dll",SetLastError=true)] static extern bool UpdateLayeredWindow(IntPtr window,IntPtr destination,ref NativePoint position,ref Size size,IntPtr source,ref NativePoint origin,uint key,ref BlendFunction blend,uint flags);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr window,int command);
    [DllImport("user32.dll")] static extern bool DestroyWindow(IntPtr window);
    sealed class Tile : IDisposable
    {
        internal IntPtr Handle { get; private set; }
        internal int Edge { get; }
        internal bool Visible { get; private set; }
        readonly int x,y; readonly byte[] buffer;
        IntPtr dc,bitmap,previous,pixels;
        internal Tile(int left,int top,int edge)
        {
            x=left;y=top;Edge=edge;buffer=new byte[edge*edge*4];
            try
            {
                Handle=DimmingPane.Create(); dc=CreateCompatibleDC(IntPtr.Zero);
                var info=new BitmapHeader { Size=(uint)Marshal.SizeOf<BitmapHeader>(),Width=edge,Height=-edge,Planes=1,Bits=32 };
                bitmap=CreateDIBSection(dc,ref info,0,out pixels,IntPtr.Zero,0);
                if(dc==IntPtr.Zero||bitmap==IntPtr.Zero||pixels==IntPtr.Zero) throw new InvalidOperationException("无法创建星光位图。");
                previous=SelectObject(dc,bitmap);
            }
            catch { Dispose();throw; }
        }
        internal void Clear()=>Array.Clear(buffer);
        internal void Blend(Sprite sprite,Point center)
        {
            int left=(int)Math.Round(center.X-x-sprite.Edge*.5),top=(int)Math.Round(center.Y-y-sprite.Edge*.5);
            for(int row=0;row<sprite.Edge;row++) for(int col=0;col<sprite.Edge;col++)
            {
                int xx=left+col,yy=top+row;if(xx<0||yy<0||xx>=Edge||yy>=Edge) continue;
                int src=(row*sprite.Edge+col)*4,alpha=sprite.Pixels[src+3];if(alpha==0) continue;
                int dest=(yy*Edge+xx)*4;
                for(int channel=0;channel<4;channel++) buffer[dest+channel]=(byte)(sprite.Pixels[src+channel]+(buffer[dest+channel]*(255-alpha)+127)/255);
            }
        }
        internal void Present()
        {
            Marshal.Copy(buffer,0,pixels,buffer.Length);
            var position=new NativePoint { X=x,Y=y };var size=new Size { Width=Edge,Height=Edge };var origin=new NativePoint();var blend=new BlendFunction { Alpha=255,Format=1 };
            // 坐标永远是网格创建位置；只提交预乘透明位图，不随鼠标搬动。
            if(!UpdateLayeredWindow(Handle,IntPtr.Zero,ref position,ref size,dc,ref origin,0,ref blend,2)) throw new Win32Exception(Marshal.GetLastWin32Error(),"无法提交星光图层。");
            if(!Visible) { ShowWindow(Handle,4);Visible=true; }
        }
        internal void Hide() { if(Visible) { ShowWindow(Handle,0);Visible=false; } }
        public void Dispose()
        {
            if(Handle!=IntPtr.Zero) { DestroyWindow(Handle);Handle=IntPtr.Zero; }
            if(previous!=IntPtr.Zero&&dc!=IntPtr.Zero) SelectObject(dc,previous);
            if(bitmap!=IntPtr.Zero) { DeleteObject(bitmap);bitmap=IntPtr.Zero; }
            if(dc!=IntPtr.Zero) { DeleteDC(dc);dc=IntPtr.Zero; }
            Visible=false;
        }
    }
}
