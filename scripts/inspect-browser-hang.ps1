# 只读取进程的窗口响应和线程等待链，不关闭程序，不读取网页或凭据内容。
param([int]$BrowserProcessId)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class BrowserHangProbe {
    [DllImport("user32.dll", SetLastError=true)]
    public static extern IntPtr SendMessageTimeout(IntPtr hwnd, uint msg, UIntPtr w, IntPtr l, uint flags, uint timeout, out UIntPtr result);
    [DllImport("advapi32.dll", SetLastError=true)]
    public static extern IntPtr OpenThreadWaitChainSession(uint flags, IntPtr callback);
    [DllImport("advapi32.dll", SetLastError=true)]
    public static extern bool GetThreadWaitChain(IntPtr session, UIntPtr context, uint flags, uint thread, ref uint count, IntPtr nodes, out bool cycle);
    [DllImport("advapi32.dll")]
    public static extern void CloseThreadWaitChainSession(IntPtr session);
}
'@
$browserProcess = Get-Process -Id $BrowserProcessId
$result = [UIntPtr]::Zero
$response = [BrowserHangProbe]::SendMessageTimeout($browserProcess.MainWindowHandle, 0, [UIntPtr]::Zero, [IntPtr]::Zero, 2, 1500, [ref]$result)
Write-Output "WindowResponding=$($response -ne [IntPtr]::Zero) ProcessId=$BrowserProcessId"
# WAITCHAIN_NODE_INFO 在 x64 上为 280 字节，只输出类型及线程编号，不输出锁名称。
$session = [BrowserHangProbe]::OpenThreadWaitChainSession(0, [IntPtr]::Zero)
$buffer = [Runtime.InteropServices.Marshal]::AllocHGlobal(280 * 16)
try {
    foreach ($thread in $browserProcess.Threads) {
        $count = [uint32]16
        $cycle = $false
        if ([BrowserHangProbe]::GetThreadWaitChain($session, [UIntPtr]::Zero, 7, $thread.Id, [ref]$count, $buffer, [ref]$cycle)) {
            $chain = for ($i = 0; $i -lt $count; $i++) {
                $offset = $i * 280
                $type = [Runtime.InteropServices.Marshal]::ReadInt32($buffer, $offset)
                $status = [Runtime.InteropServices.Marshal]::ReadInt32($buffer, $offset + 4)
                if ($type -eq 8) {
                    "Thread(pid=$([Runtime.InteropServices.Marshal]::ReadInt32($buffer, $offset + 8)),tid=$([Runtime.InteropServices.Marshal]::ReadInt32($buffer, $offset + 12)),status=$status)"
                } else { "Wait(type=$type,status=$status)" }
            }
            Write-Output "Thread=$($thread.Id) Cycle=$cycle $($chain -join ' -> ')"
        }
    }
} finally {
    [Runtime.InteropServices.Marshal]::FreeHGlobal($buffer)
    [BrowserHangProbe]::CloseThreadWaitChainSession($session)
}
if ($response -eq [IntPtr]::Zero) { exit 1 }
