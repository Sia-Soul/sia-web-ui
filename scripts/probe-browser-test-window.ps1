# 只操作调用方提供的测试进程：显示但不激活主窗口，并检查 UI 消息响应。
param([int]$TestProcessId, [switch]$Show, [switch]$Restore)
# Restore 用于最小化回归，会恢复并激活测试窗口；普通 Show 仍不激活。
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class SiaTestWindow {
    public delegate bool EnumProc(IntPtr hwnd, IntPtr data);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback, IntPtr data);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int count);
    [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hwnd, int command);
    [DllImport("user32.dll")] public static extern IntPtr SendMessageTimeout(IntPtr hwnd, uint msg, UIntPtr w, IntPtr l, uint flags, uint timeout, out UIntPtr result);
}
'@
$script:testHandle = [IntPtr]::Zero
[SiaTestWindow]::EnumWindows({
    param($handle, $unused)
    $owner = [uint32]0
    [void][SiaTestWindow]::GetWindowThreadProcessId($handle, [ref]$owner)
    if ($owner -eq $TestProcessId) {
        $caption = New-Object Text.StringBuilder 256
        [void][SiaTestWindow]::GetWindowText($handle, $caption, 256)
        if ($caption.ToString() -eq '西娅浏览器') { $script:testHandle = $handle; return $false }
    }
    return $true
}, [IntPtr]::Zero) | Out-Null
if ($script:testHandle -eq [IntPtr]::Zero) { throw '没有找到测试主窗口' }
if ($Show) { [void][SiaTestWindow]::ShowWindowAsync($script:testHandle, 4) }
# 最小化恢复必须使用 SW_RESTORE；普通显示不会解除 WebView2 的最小化节流。
if ($Restore) { [void][SiaTestWindow]::ShowWindowAsync($script:testHandle, 9) }
$result = [UIntPtr]::Zero
$response = [SiaTestWindow]::SendMessageTimeout($script:testHandle, 0, [UIntPtr]::Zero, [IntPtr]::Zero, 2, 1500, [ref]$result)
if ($response -eq [IntPtr]::Zero) { throw '测试窗口原生心跳超时' }
Write-Output 'PASS native window heartbeat'
