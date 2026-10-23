# UTF-8 BOM：仅在用户点击强制关闭后执行，不读写浏览器资料。
param([Parameter(Mandatory = $true)][string]$ResultFile, [switch]$ValidationBuild)
$ErrorActionPreference = 'Stop'
$session = [Diagnostics.Process]::GetCurrentProcess().SessionId
$names = @('sia-browser', 'perch-browser')
$products = @('西娅浏览器', 'Sia Browser', '栖页浏览器')
$mutexName = 'Local\SiaBrowser.Installation'
if ($ValidationBuild) {
    # 验证版只允许关闭专用测试进程，不能触及正在使用的正式浏览器。
    $names = @('sia-close-fixture')
    $products = @('Sia Installer Close Fixture')
    $mutexName = 'Local\SiaBrowser.Installation.Validation'
}
try {
    foreach ($candidate in @(Get-Process -Name $names -ErrorAction SilentlyContinue)) {
        try {
            if ($candidate.SessionId -ne $session -or $candidate.HasExited) { continue }
            # 通过持有的进程对象检查产品并结束该实例，避免同名的其他应用被误关闭。
            if ($candidate.MainModule.FileVersionInfo.ProductName -notin $products) { continue }
            $candidate.Kill()
            if (-not $candidate.WaitForExit(5000)) { throw '浏览器关闭超时，请重试。' }
        } catch {
            if (-not $candidate.HasExited) { throw }
        } finally { $candidate.Dispose() }
    }
    # 退出完成后检查互斥体，权限不足、未识别实例或重新启动均不能放行安装。
    $remaining = $null
    if ([Threading.Mutex]::TryOpenExisting($mutexName, [ref]$remaining)) {
        $remaining.Dispose()
        throw '仍有浏览器实例未能关闭。请检查是否以管理员身份运行，或关闭后点击“重新检测”。'
    }
    [IO.File]::WriteAllText($ResultFile, '', [Text.UTF8Encoding]::new($false))
    exit 0
} catch {
    [IO.File]::WriteAllText($ResultFile, ('强制关闭未完成：' + $_.Exception.Message), [Text.UTF8Encoding]::new($false))
    exit 1
}
