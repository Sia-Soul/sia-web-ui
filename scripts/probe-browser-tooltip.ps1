# 仅对隔离诊断进程执行悬停并读取原生窗口状态，不操作用户安装版。
param([int]$TestProcessId, [ValidateSet('inspect','hover','hover-inactive','stretch','drag','position','normal','size','move','restore')][string]$Action='inspect', [double]$X=0, [double]$Y=0, [int]$WaitMs=0)
$ErrorActionPreference='Stop'
# Windows PowerShell 的默认控制台编码不同于文件编码，显式输出 UTF-8 给 Node 解析。
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$testProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$TestProcessId"
if(-not $testProcess -or $testProcess.CommandLine -notlike '*--diagnostic-data-dir*'){throw '只允许检查隔离诊断进程'}
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class SiaTooltipProbe {
    public delegate bool Callback(IntPtr window, IntPtr data);
    [StructLayout(LayoutKind.Sequential)] public struct Point { public int X,Y; }
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
    [DllImport("user32.dll")] public static extern bool EnumWindows(Callback callback, IntPtr data);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr window,StringBuilder title,int count);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window,int command);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr window,IntPtr after,int x,int y,int width,int height,uint flags);
    [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint x,uint y,uint data,UIntPtr extra);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point point);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr window,ref Point point);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window,out Rect rect);
    [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr window);
    [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll",EntryPoint="GetWindowLongPtrW")] public static extern IntPtr GetWindowLongPtr(IntPtr window,int index);
    public static List<IntPtr> Windows(uint pid) {
        var result=new List<IntPtr>();
        EnumWindows((window,data)=>{uint owner;GetWindowThreadProcessId(window,out owner);if(owner==pid)result.Add(window);return true;},IntPtr.Zero);
        return result;
    }
    public static string Title(IntPtr window) {var text=new StringBuilder(256);GetWindowText(window,text,256);return text.ToString();}
}
'@
# 使用物理屏幕坐标，防止 PowerShell 的 DPI 虚拟化将指针放到错误位置。
[void][SiaTooltipProbe]::SetThreadDpiAwarenessContext([IntPtr](-4))
$handles=[SiaTooltipProbe]::Windows($TestProcessId)
$main=@($handles | Where-Object {[SiaTooltipProbe]::Title($_) -eq '西娅浏览器'})[0]
if(-not $main){throw '没有找到测试主窗口'}
$originalCursor=New-Object SiaTooltipProbe+Point
[void][SiaTooltipProbe]::GetCursorPos([ref]$originalCursor)
if($Action -eq 'hover' -or $Action -eq 'hover-inactive'){
    $showCommand=if($Action -eq 'hover-inactive'){4}else{5}
    [void][SiaTooltipProbe]::ShowWindow($main,$showCommand)
    # 子进程带 SW_HIDE 启动时，Windows 首次 ShowWindow 会服从启动标记而忽略参数。
    if(-not [SiaTooltipProbe]::IsWindowVisible($main)){[void][SiaTooltipProbe]::ShowWindow($main,$showCommand)}
    # 只提升新建的诊断窗口，避免测试被其他应用遮挡；点击本窗口标题栏获得真实焦点。
    [void][SiaTooltipProbe]::SetWindowPos($main,[IntPtr](-1),0,0,0,0,0x13)
    if($Action -eq 'hover'){[void][SiaTooltipProbe]::SetForegroundWindow($main)}
    $origin=New-Object SiaTooltipProbe+Point
    [void][SiaTooltipProbe]::ClientToScreen($main,[ref]$origin)
    $scale=[SiaTooltipProbe]::GetDpiForWindow($main)/96.0
    if($Action -eq 'hover' -and [SiaTooltipProbe]::GetForegroundWindow() -ne $main){
        [void][SiaTooltipProbe]::SetCursorPos([int]($origin.X+300*$scale),[int]($origin.Y+18*$scale))
        [SiaTooltipProbe]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
        [SiaTooltipProbe]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
        # 输入消息异步派发，等待诊断窗口收到点击后再查询前台归属。
        Start-Sleep -Milliseconds 150
    }
    # 记录预期坐标，让回归测试识别用户或其他任务在等待期间移动鼠标的干扰。
    $targetX=[int]($origin.X+$X*$scale)
    $targetY=[int]($origin.Y+$Y*$scale)
    [void][SiaTooltipProbe]::SetCursorPos($targetX,$targetY)
} elseif($Action -eq 'normal') {
    [void][SiaTooltipProbe]::SetWindowPos($main,[IntPtr](-2),0,0,0,0,0x13)
} elseif($Action -eq 'position') {
    [void][SiaTooltipProbe]::SetWindowPos($main,[IntPtr]::Zero,[int]$X,[int]$Y,0,0,0x15)
} elseif($Action -eq 'size') {
    [void][SiaTooltipProbe]::SetWindowPos($main,[IntPtr]::Zero,0,0,[int]$X,[int]$Y,0x16)
} elseif($Action -eq 'drag') {
    $rect=New-Object SiaTooltipProbe+Rect
    [void][SiaTooltipProbe]::GetWindowRect($main,[ref]$rect)
    $middle=[int](($rect.Left+$rect.Right)/2)
    [void][SiaTooltipProbe]::SetCursorPos($middle,$rect.Top+1)
    Start-Sleep -Milliseconds 200
    [SiaTooltipProbe]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
    Start-Sleep -Milliseconds 200
    for($step=1;$step -le 10;$step++) {
        [void][SiaTooltipProbe]::SetCursorPos($middle,[int](($rect.Top+1)*(10-$step)/10))
        Start-Sleep -Milliseconds 50
    }
    Start-Sleep -Milliseconds 300
    [SiaTooltipProbe]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
} elseif($Action -eq 'stretch') {
    # 双击测试窗口顶部缩放边缘，触发 Windows 原生纵向铺满工作区。
    $rect=New-Object SiaTooltipProbe+Rect
    [void][SiaTooltipProbe]::GetWindowRect($main,[ref]$rect)
    [void][SiaTooltipProbe]::SetCursorPos([int](($rect.Left+$rect.Right)/2),$rect.Top+1)
    foreach($click in 1..2){
        [SiaTooltipProbe]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
        [SiaTooltipProbe]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
        Start-Sleep -Milliseconds 60
    }
} elseif($Action -eq 'move') {
    # 仅移动鼠标，不刷新窗口显示状态，避免掩盖原生缩放后的输入问题。
    $origin=New-Object SiaTooltipProbe+Point
    [void][SiaTooltipProbe]::ClientToScreen($main,[ref]$origin)
    $scale=[SiaTooltipProbe]::GetDpiForWindow($main)/96.0
    $targetX=[int]($origin.X+$X*$scale)
    $targetY=[int]($origin.Y+$Y*$scale)
    [void][SiaTooltipProbe]::SetCursorPos($targetX,$targetY)
} elseif($Action -eq 'restore') {
    [void][SiaTooltipProbe]::SetCursorPos([int]$X,[int]$Y)
}
if($WaitMs -gt 0){Start-Sleep -Milliseconds $WaitMs}
$foregroundProcess=[uint32]0
[void][SiaTooltipProbe]::GetWindowThreadProcessId([SiaTooltipProbe]::GetForegroundWindow(),[ref]$foregroundProcess)
$currentCursor=New-Object SiaTooltipProbe+Point
[void][SiaTooltipProbe]::GetCursorPos([ref]$currentCursor)
$windows=@($handles | ForEach-Object {
    $rect=New-Object SiaTooltipProbe+Rect
    [void][SiaTooltipProbe]::GetWindowRect($_,[ref]$rect)
    [pscustomobject]@{Title=[SiaTooltipProbe]::Title($_);Visible=[SiaTooltipProbe]::IsWindowVisible($_);Topmost=([SiaTooltipProbe]::GetWindowLongPtr($_,-20).ToInt64() -band 8) -ne 0;X=$rect.Left;Y=$rect.Top;Width=$rect.Right-$rect.Left;Height=$rect.Bottom-$rect.Top;Foreground=($_ -eq [SiaTooltipProbe]::GetForegroundWindow())}
})
[pscustomobject]@{OriginalX=$originalCursor.X;OriginalY=$originalCursor.Y;CursorX=$currentCursor.X;CursorY=$currentCursor.Y;TargetX=$targetX;TargetY=$targetY;ForegroundProcess=(Get-Process -Id $foregroundProcess -ErrorAction SilentlyContinue).ProcessName;Windows=$windows} | ConvertTo-Json -Depth 4 -Compress
