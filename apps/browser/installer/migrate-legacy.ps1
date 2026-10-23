# UTF-8 BOM：由安装向导在实际安装前调用旧 NSIS 卸载器，升级模式明确保留浏览数据。
param(
    [Parameter(Mandatory = $true)][string]$ResultFile,
    [switch]$ValidationBuild
)
$ErrorActionPreference = 'Stop'
$utf8 = [Text.UTF8Encoding]::new($true)
$registryPrefix = 'Software\Microsoft\Windows\CurrentVersion\Uninstall\'
$legacyNames = @('Sia Browser', '西娅浏览器', '栖页浏览器')
if ($ValidationBuild) { $legacyNames = @('Sia Browser Migration Test A', 'Sia Browser Migration Test B') }

# 只读取指定品牌的卸载登记；显式遍历注册表视图，兼容机器级旧安装。
function Read-LegacyInstallations {
    $found = @()
    foreach ($scope in @(
        @{ Hive = [Microsoft.Win32.RegistryHive]::CurrentUser; View = [Microsoft.Win32.RegistryView]::Default },
        @{ Hive = [Microsoft.Win32.RegistryHive]::LocalMachine; View = [Microsoft.Win32.RegistryView]::Registry64 },
        @{ Hive = [Microsoft.Win32.RegistryHive]::LocalMachine; View = [Microsoft.Win32.RegistryView]::Registry32 }
    )) {
        $root = [Microsoft.Win32.RegistryKey]::OpenBaseKey($scope.Hive, $scope.View)
        try {
            foreach ($name in $legacyNames) {
                $key = $root.OpenSubKey($registryPrefix + $name)
                if ($null -eq $key) { continue }
                try {
                    if (-not $key.GetValue('UninstallString')) { continue }
                    $found += [pscustomobject]@{
                        Name = $name; Hive = $scope.Hive; View = $scope.View
                        Directory = ([string]$key.GetValue('InstallLocation')).Trim().Trim('"')
                        Uninstaller = ([string]$key.GetValue('UninstallString')).Trim().Trim('"')
                        Binary = [string]$key.GetValue('MainBinaryName')
                    }
                } finally { $key.Dispose() }
            }
        } finally { $root.Dispose() }
    }
    return $found
}

# 先检查全部登记，路径损坏或缺少卸载器时不开始迁移，避免只卸载一部分才发现问题。
function Assert-LegacyInstallation($entry) {
    if ($entry.Binary -notin @('sia-browser.exe', 'perch-browser.exe') -or
        -not [IO.Path]::IsPathRooted($entry.Directory) -or
        -not [IO.Path]::IsPathRooted($entry.Uninstaller)) {
        throw "旧版 $($entry.Name) 的安装登记不完整，无法自动迁移。请修复旧版安装后重试。"
    }
    $directory = [IO.Path]::GetFullPath($entry.Directory).TrimEnd('\')
    $expected = Join-Path $directory 'uninstall.exe'
    if ($directory -eq [IO.Path]::GetPathRoot($directory).TrimEnd('\') -or
        [IO.Path]::GetFullPath($entry.Uninstaller) -ne $expected -or
        -not (Test-Path -LiteralPath $expected -PathType Leaf)) {
        throw "旧版 $($entry.Name) 的卸载程序缺失或路径不匹配，无法自动迁移。请修复旧版安装后重试。"
    }
    # 用户数据目录不能成为卸载工作目录，防止错误登记把数据当成程序目录。
    foreach ($dataRoot in @($env:LOCALAPPDATA, $env:APPDATA)) {
        $profile = Join-Path $dataRoot 'com.sia.browser'
        if ($directory -eq $profile -or $directory.StartsWith($profile + '\', [StringComparison]::OrdinalIgnoreCase)) {
            throw '旧版安装路径指向浏览数据目录，已停止迁移。'
        }
    }
}

# NSIS 静默卸载会结束同名进程，必须在调用前明确阻止，给用户保留保存工作和正常退出的机会。
function Assert-BrowserClosed {
    # 验证包只使用独立测试身份，正式浏览器的运行状态不应影响隔离安装验证。
    if ($ValidationBuild) { return }
    if (Get-Process -Name 'sia-browser','perch-browser' -ErrorAction SilentlyContinue) {
        throw '请先关闭正在运行的西娅浏览器（包括旧版窗口），然后点击“重试”继续安装。'
    }
}

# /UPDATE 会保留旧快捷方式；只移除目标仍指向该旧程序的链接，保留同名但已改指向的用户链接。
function Remove-LegacyLinks($entry) {
    $oldExe = Join-Path $entry.Directory $entry.Binary
    $shell = New-Object -ComObject WScript.Shell
    $folders = @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop'))
    if ($entry.Hive -eq [Microsoft.Win32.RegistryHive]::LocalMachine) {
        $folders += @([Environment]::GetFolderPath('CommonPrograms'), [Environment]::GetFolderPath('CommonDesktopDirectory'))
    }
    foreach ($folder in $folders | Select-Object -Unique) {
        if (-not (Test-Path -LiteralPath $folder)) { continue }
        foreach ($link in Get-ChildItem -LiteralPath $folder -Filter '*.lnk' -File -Recurse -ErrorAction SilentlyContinue) {
            if ($link.BaseName -eq $entry.Name -and $shell.CreateShortcut($link.FullName).TargetPath -eq $oldExe) {
                Remove-Item -LiteralPath $link.FullName -ErrorAction Stop
            }
        }
    }
    # 和普通卸载一致，仅清理确实指向旧 EXE 的品牌启动项。
    $runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
    $runValues = Get-ItemProperty -LiteralPath $runKey -ErrorAction SilentlyContinue
    $run = $null
    if ($null -ne $runValues) { $run = $runValues.PSObject.Properties[$entry.Name] }
    if ($null -ne $run -and ([string]$run.Value -eq $oldExe -or [string]$run.Value -eq ('"' + $oldExe + '"') -or
        ([string]$run.Value).StartsWith('"' + $oldExe + '" ', [StringComparison]::OrdinalIgnoreCase))) {
        Remove-ItemProperty -LiteralPath $runKey -Name $entry.Name
    }
}

try {
    $entries = @(Read-LegacyInstallations)
    foreach ($entry in $entries) { Assert-LegacyInstallation $entry }
    if ($entries.Count -gt 0) { Assert-BrowserClosed }
    $workDir = Join-Path ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($ResultFile))) ('legacy-' + [Guid]::NewGuid().ToString('N'))
    if ($entries.Count -gt 0) { New-Item -ItemType Directory -Path $workDir | Out-Null }
    $index = 0
    foreach ($entry in $entries) {
        Assert-BrowserClosed
        # 在临时目录运行副本，并把 _?= 放在末尾，禁用 NSIS 自复制，确保等待的是实际卸载进程。
        $copy = Join-Path $workDir ("uninstall-$index.exe")
        Copy-Item -LiteralPath $entry.Uninstaller -Destination $copy
        $arguments = '/S /UPDATE _?=' + $entry.Directory
        $options = @{ FilePath = $copy; ArgumentList = $arguments; WindowStyle = 'Hidden'; Wait = $true; PassThru = $true }
        if ($entry.Hive -eq [Microsoft.Win32.RegistryHive]::LocalMachine) { $options.Verb = 'RunAs' }
        $process = Start-Process @options
        if ($process.ExitCode -ne 0) { throw "旧版 $($entry.Name) 卸载未完成（退出码 $($process.ExitCode)），请重试。" }
        $root = [Microsoft.Win32.RegistryKey]::OpenBaseKey($entry.Hive, $entry.View)
        try {
            $remaining = $root.OpenSubKey($registryPrefix + $entry.Name)
            if ($null -ne $remaining) { $remaining.Dispose(); throw "旧版 $($entry.Name) 仍有安装登记，已停止安装，请重试。" }
        } finally { $root.Dispose() }
        if (Test-Path -LiteralPath (Join-Path $entry.Directory $entry.Binary)) {
            throw "旧版 $($entry.Name) 的程序文件仍被占用，请关闭浏览器后重试。"
        }
        Remove-LegacyLinks $entry
        $index++
    }
    [IO.File]::WriteAllText($ResultFile, '', $utf8)
    exit 0
} catch {
    [IO.File]::WriteAllText($ResultFile, $_.Exception.Message, $utf8)
    exit 1
}
