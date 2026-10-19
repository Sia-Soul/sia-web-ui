using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Threading;

namespace SiaWebUI.Windows.Effects;

/// <summary>识别两次独立 Ctrl 点击；不监听系统，只消费宿主输入事件，便于隔离测试。</summary>
public sealed class CtrlDoubleTap
{
    readonly HashSet<int> held = [];
    double downAt, firstUp = -10000;
    bool chord;
    /// <summary>清空按键与上次点击状态；暂停或重新配置时调用。</summary>
    public void Reset() { held.Clear(); firstUp = -10000; chord = false; }
    /// <summary>处理虚拟键码、按下/松开及单调毫秒时间；interval 为两次点击最大间隔。仅第二次有效 Ctrl 松开返回 true；其它键、重叠双 Ctrl、长按和自动重复不触发。</summary>
    public bool Feed(int key, bool down, double milliseconds, int interval = 400)
    {
        bool ctrl = key is 0x11 or 0xA2 or 0xA3;
        if (down)
        {
            if (!held.Add(key)) return false;
            if (!ctrl || held.Count != 1) { chord = true; firstUp = -10000; }
            if (ctrl && held.Count == 1) { downAt = milliseconds; chord = false; }
            return false;
        }
        if (!held.Remove(key) || !ctrl) return false;
        if (held.Count != 0 || chord || milliseconds - downAt > 350) { firstUp = -10000; return false; }
        if (milliseconds - firstUp <= interval) { firstUp = -10000; return true; }
        firstUp = milliseconds; return false;
    }
}

// 低级钩子拥有独立消息泵，回调只复制事件并返回，不等待 WPF 绘图线程。
internal sealed class InputListener : IDisposable
{
    internal delegate IntPtr HookProc(int code, IntPtr message, IntPtr data);
    [DllImport("user32.dll", SetLastError = true)] static extern IntPtr SetWindowsHookEx(int id, HookProc proc, IntPtr module, uint thread);
    [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr GetModuleHandle(string? name);
    readonly HookProc mouseProc, keyboardProc;
    readonly CtrlDoubleTap detector = new();
    readonly Stopwatch clock = Stopwatch.StartNew();
    readonly Thread thread;
    readonly Dispatcher pump;
    IntPtr mouse, keyboard;
    int interval;
    internal bool Listening => mouse != IntPtr.Zero;
    internal bool KeyboardListening => keyboard != IntPtr.Zero;
    internal InputListener(Action<int, int, int> click, Action locate)
    {
        mouseProc = (code, message, data) => {
            int kind = message.ToInt32();
            if (code >= 0 && kind is 0x201 or 0x202 or 0x204 or 0x205) click(kind, Marshal.ReadInt32(data), Marshal.ReadInt32(data, 4));
            return CallNextHookEx(mouse, code, message, data);
        };
        keyboardProc = (code, message, data) => {
            if (code >= 0 && (Marshal.ReadInt32(data, 8) & 0x10) == 0)
            {
                int kind = message.ToInt32();
                if (kind is 0x100 or 0x104 or 0x101 or 0x105)
                    if (detector.Feed(Marshal.ReadInt32(data), kind is 0x100 or 0x104, clock.Elapsed.TotalMilliseconds, interval)) locate();
            }
            return CallNextHookEx(keyboard, code, message, data);
        };
        var ready = new TaskCompletionSource<Dispatcher>();
        thread = new Thread(() => { ready.SetResult(Dispatcher.CurrentDispatcher); Dispatcher.Run(); }) { IsBackground = true, Name = "Sia mouse input" };
        thread.SetApartmentState(ApartmentState.STA); thread.Start(); pump = ready.Task.GetAwaiter().GetResult();
    }
    internal void Configure(bool enabled, bool ctrl, int doubleTapMs)
    {
        pump.Invoke(() => {
            interval = doubleTapMs; detector.Reset();
            if (enabled && mouse == IntPtr.Zero) mouse = Install(14, mouseProc);
            if (!enabled && mouse != IntPtr.Zero) { UnhookWindowsHookEx(mouse); mouse = IntPtr.Zero; }
            try { if (ctrl && keyboard == IntPtr.Zero) keyboard = Install(13, keyboardProc); }
            catch { if (mouse != IntPtr.Zero) UnhookWindowsHookEx(mouse); mouse = IntPtr.Zero; throw; }
            if (!ctrl && keyboard != IntPtr.Zero) { UnhookWindowsHookEx(keyboard); keyboard = IntPtr.Zero; }
        });
    }
    static IntPtr Install(int type, HookProc proc)
    {
        var hook = SetWindowsHookEx(type, proc, GetModuleHandle(null), 0);
        if (hook == IntPtr.Zero) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "无法启动鼠标效果输入监听。");
        return hook;
    }
    public void Dispose() { Configure(false, false, 400); pump.BeginInvokeShutdown(DispatcherPriority.Send); thread.Join(1000); }
}
