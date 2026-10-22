using System.ComponentModel;
using System.Runtime.InteropServices;

namespace SiaWebUI.Windows.Effects;

// 外围遮罩使用固定纯黑背景，避免 STATIC/SS_BLACKRECT 跟随系统窗口边框色而变灰。
internal static class DimmingPane
{
    const string ClassName = "SiaWebUI.FixedBlackDimmingPane";
    [UnmanagedFunctionPointer(CallingConvention.Winapi)] delegate IntPtr WindowProcedure(IntPtr window, uint message, IntPtr wparam, IntPtr lparam);
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct WindowClass
    {
        public uint Style;
        public WindowProcedure Procedure;
        public int ClassExtra, WindowExtra;
        public IntPtr Instance, Icon, Cursor, Background;
        public string? Menu;
        public string Name;
    }
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern ushort RegisterClass(ref WindowClass value);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr DefWindowProc(IntPtr window, uint message, IntPtr wparam, IntPtr lparam);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern IntPtr CreateWindowEx(int exStyle, string name, string? text, uint style, int x, int y, int width, int height, IntPtr parent, IntPtr menu, IntPtr instance, IntPtr parameter);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr GetModuleHandle(string? name);
    [DllImport("gdi32.dll")] static extern IntPtr GetStockObject(int kind);
    // 委托与窗口类同寿命，防止窗口消息回调被 GC 回收；系统 stock brush 不由本组件销毁。
    static readonly WindowProcedure procedure = DefWindowProc;
    static readonly Lazy<ushort> registration = new(() =>
    {
        var value = new WindowClass { Procedure = procedure, Instance = GetModuleHandle(null), Background = GetStockObject(4), Name = ClassName };
        ushort atom = RegisterClass(ref value);
        if (atom == 0) throw new Win32Exception(Marshal.GetLastWin32Error(), "无法注册纯黑遮罩窗口。");
        return atom;
    });
    internal static IntPtr Create()
    {
        _ = registration.Value;
        // 分层、穿透、不激活、工具窗口和置顶样式保持与局部动画层一致。
        var window = CreateWindowEx(0x80800A8,ClassName,null,0x80000000,-10000,-10000,1,1,IntPtr.Zero,IntPtr.Zero,GetModuleHandle(null),IntPtr.Zero);
        if (window == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error(), "无法创建纯黑遮罩窗口。");
        return window;
    }
}
