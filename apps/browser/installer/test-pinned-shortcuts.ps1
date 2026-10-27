# UTF-8 BOM：仅在临时目录构造 .lnk，验证升级迁移，不触碰真实任务栏或广播 Shell 通知。
$ErrorActionPreference = 'Stop'
$testRoot = Join-Path 'D:/SiaBuild/SiaWebUI/diagnostics' ('pinned-icons-' + [Guid]::NewGuid().ToString('N'))
$installed = Join-Path $testRoot '安装目录'
$pins = Join-Path $testRoot '模拟任务栏'
New-Item -ItemType Directory -Path $installed,$pins | Out-Null
[IO.File]::WriteAllBytes((Join-Path $installed 'sia-browser.exe'), [byte[]]@(0))
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../src-tauri/icons/icon.ico') -Destination (Join-Path $installed 'app-sia-swift-05.ico')
$shell = New-Object -ComObject WScript.Shell
$cases = @(
    @{ Name='Sia 浏览器'; Target='C:\Program Files\sia-browser\Sia浏览器.exe'; Update=$true },
    @{ Name='Sia Browser'; Target='C:\repo\apps\browser\src-tauri\target\release\sia-browser.exe'; Update=$true },
    @{ Name='西娅浏览器'; Target=(Join-Path $installed 'sia-browser.exe'); Update=$true },
    @{ Name='栖页浏览器'; Target='C:\OtherApp\sia-browser.exe'; Update=$false },
    @{ Name='其他软件'; Target='C:\Program Files\sia-browser\Sia浏览器.exe'; Update=$false }
)
foreach ($case in $cases) {
    $link = $shell.CreateShortcut((Join-Path $pins ($case.Name + '.lnk')))
    $link.TargetPath = $case.Target
    $link.Arguments = '--keep-user-argument'
    $link.IconLocation = 'C:\old\app.ico,0'
    $link.Save()
}
# 连续运行两次，验证迁移幂等，并且不会新增或删除固定项目。
1..2 | ForEach-Object {
    & (Join-Path $PSScriptRoot 'update-pinned-shortcuts.ps1') -InstallDirectory $installed -PinnedDirectory $pins -SkipShellNotify
    foreach ($case in $cases) {
        $link = $shell.CreateShortcut((Join-Path $pins ($case.Name + '.lnk')))
        $expected = if ($case.Update) { Join-Path $installed 'sia-browser.exe' } else { $case.Target }
        if ($link.TargetPath -ne $expected) { throw "目标错误：$($case.Name)" }
        $expectedIcon = if ($case.Update) { (Join-Path $installed 'app-sia-swift-05.ico') + ',0' } else { 'C:\old\app.ico,0' }
        if ($link.IconLocation -ne $expectedIcon) { throw "图标错误：$($case.Name)" }
        if ($link.Arguments -ne '--keep-user-argument') { throw '迁移丢失用户参数' }
    }
    if (@(Get-ChildItem -LiteralPath $pins -Filter '*.lnk').Count -ne $cases.Count) { throw '迁移改变了固定项目数量' }
}
Write-Output 'PASS: 旧安装、开发构建及现有链接迁移；无关链接和参数保留；重复运行安全。'
