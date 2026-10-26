# UTF-8 BOM：安装完成后迁移已有品牌任务栏链接；不新增、取消固定或改变排列。
param(
    [Parameter(Mandatory = $true)][string]$InstallDirectory,
    [string]$PinnedDirectory = (Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'),
    [switch]$SkipShellNotify
)
$ErrorActionPreference = 'Stop'
$target = Join-Path ([IO.Path]::GetFullPath($InstallDirectory)) 'sia-browser.exe'
$icon = Join-Path $InstallDirectory 'app-s1e-blue-bird.ico'
if (-not (Test-Path -LiteralPath $target) -or -not (Test-Path -LiteralPath $icon)) { throw '新版程序或品牌图标缺失，不能迁移任务栏链接。' }
if (-not (Test-Path -LiteralPath $PinnedDirectory)) { return }
$shell = New-Object -ComObject WScript.Shell
$brands = @('Sia Browser', 'Sia 浏览器', 'Sia浏览器', '西娅浏览器', '栖页浏览器')
foreach ($file in Get-ChildItem -LiteralPath $PinnedDirectory -Filter '*.lnk' -File) {
    if ($file.BaseName -notin $brands) { continue }
    $link = $shell.CreateShortcut($file.FullName)
    $oldTarget = $link.TargetPath.Replace('/', '\')
    # 同时校验品牌名称和已知程序路径，保留用户同名但指向其他软件的快捷方式。
    $knownTarget = $oldTarget -eq $target -or
        $oldTarget -match '\\(?:SiaBrowser|sia-browser)\\(?:sia-browser|Sia浏览器)\.exe$' -or
        $oldTarget -match '\\apps\\browser\\src-tauri\\target\\(?:release|debug)\\sia-browser\.exe$'
    if (-not $knownTarget) { continue }
    $link.TargetPath = $target
    $link.WorkingDirectory = $InstallDirectory
    # 使用新的图标文件名，避免复用旧 app.ico 的 Shell 缓存键；参数等用户设置不变。
    $link.IconLocation = "$icon,0"
    $link.Save()
    Write-Output "已更新任务栏链接：$($file.Name)"
}
# 安装时通知 Shell 重新读取快捷方式与图标，不重启资源管理器；隔离测试禁用通知。
if (-not $SkipShellNotify) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class SiaIconNotification {
    [DllImport("shell32.dll")]
    public static extern void SHChangeNotify(uint eventId, uint flags, IntPtr item1, IntPtr item2);
}
'@
    [SiaIconNotification]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
}
