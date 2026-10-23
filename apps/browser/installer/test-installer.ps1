# UTF-8 BOM：用独立验证包检查安装生命周期，不运行浏览器、不覆盖正式安装登记。
$ErrorActionPreference = 'Stop'
$browserRoot = Split-Path $PSScriptRoot -Parent
# 与正式打包读取同一 Cargo 配置，测试产物不再写入源码盘。
Push-Location $browserRoot
try {
    $targetMetadata = & cargo metadata --no-deps --format-version 1 --manifest-path src-tauri/Cargo.toml
    if ($LASTEXITCODE -ne 0) { throw '无法读取 Cargo 构建目录。' }
    $targetDirectory = ($targetMetadata | ConvertFrom-Json).target_directory
} finally { Pop-Location }
$config = Get-Content -LiteralPath (Join-Path $browserRoot 'src-tauri\tauri.conf.json') -Encoding UTF8 -Raw | ConvertFrom-Json
$output = Join-Path $targetDirectory 'release\bundle\inno'
$installer = Join-Path $output "Sia-Browser-Validation-Setup-$($config.version)-x64.exe"
$manifest = Get-Content -LiteralPath "$installer.manifest.json" -Encoding UTF8 -Raw | ConvertFrom-Json
if (-not $manifest.ValidationBuild -or (Get-FileHash -LiteralPath $installer).Hash -ne $manifest.Sha256) {
    throw '只能使用哈希一致的独立验证包，禁止测试正式安装。'
}
$testRoot = Join-Path $targetDirectory ('installer-tests\' + [Guid]::NewGuid().ToString('N'))
$installDir = Join-Path $testRoot '程序目录'
$registration = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\com.sia.browser.installer-validation_is1'
$shortcutDir = Join-Path ([Environment]::GetFolderPath('Programs')) '西娅浏览器安装验证'
$desktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) '西娅浏览器安装验证.lnk'
if ((Test-Path -LiteralPath $registration) -or (Test-Path -LiteralPath $shortcutDir) -or (Test-Path -LiteralPath $desktopLink)) {
    throw '已有验证安装或快捷方式，请先检查上一次测试，避免覆盖。'
}
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null

# 记录正式安装登记，验证测试包没有覆盖旧版及新版安装身份。
function Read-FormalRegistrations {
    $saved = [ordered]@{}
    foreach ($name in @('Sia Browser', '西娅浏览器', '栖页浏览器', 'com.sia.browser_is1')) {
        $key = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$name"
        if (Test-Path -LiteralPath $key) {
            $saved[$name] = Get-ItemProperty -LiteralPath $key | Select-Object DisplayName,InstallLocation,UninstallString,DisplayVersion
        }
    }
    return ($saved | ConvertTo-Json -Depth 4 -Compress)
}
function Run-Installer([string]$File, [string]$Arguments, [bool]$ExpectSuccess = $true) {
    $process = Start-Process -FilePath $File -ArgumentList $Arguments -WindowStyle Hidden -Wait -PassThru
    if ($ExpectSuccess -and $process.ExitCode -ne 0) { throw "安装进程失败，退出码 $($process.ExitCode)：$File" }
    if (-not $ExpectSuccess -and $process.ExitCode -eq 0) { throw '运行保护未能阻止安装或卸载。' }
}
$before = Read-FormalRegistrations
$arguments = '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /TASKS="desktopicon" /DIR="' + $installDir + '"'
$uninstallArguments = '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART'

# 用相同名字的互斥体模拟浏览器运行，避免为了测试启动用户真实会话。
$mutex = [Threading.Mutex]::new($false, 'Local\SiaBrowser.Installation.Validation')
try {
    Run-Installer $installer ($arguments + ' /LOG="' + (Join-Path $testRoot 'running-install.log') + '"') $false
    if (Test-Path -LiteralPath $registration) { throw '浏览器运行时仍写入了安装登记。' }
} finally { $mutex.Dispose() }

Run-Installer $installer ($arguments + ' /LOG="' + (Join-Path $testRoot 'install.log') + '"')
$installedExe = Join-Path $installDir 'sia-browser.exe'
foreach ($file in $manifest.Files) {
    if ((Get-FileHash -LiteralPath (Join-Path $installDir $file.Name)).Hash -ne $file.Sha256) { throw "安装内容不一致：$($file.Name)" }
}
if ((Get-ItemPropertyValue -LiteralPath $registration -Name InstallLocation).TrimEnd('\') -ne $installDir) { throw '安装路径登记不正确。' }
$shell = New-Object -ComObject WScript.Shell
$menuLink = Join-Path $shortcutDir '西娅浏览器安装验证.lnk'
foreach ($link in @($menuLink, $desktopLink)) {
    if (-not (Test-Path -LiteralPath $link) -or $shell.CreateShortcut($link).TargetPath -ne $installedExe) { throw "快捷方式不正确：$link" }
}
if (@(Get-ChildItem -LiteralPath $installDir -File | Where-Object { $_.Name -notmatch '^(sia-browser\.exe|app\.ico|unins\d+\.(exe|dat))$' }).Count -ne 0) { throw '安装目录包含清单外文件。' }

# 覆盖安装必须沿用首次路径，保留不归安装器管理的用户文件。
$sentinel = Join-Path $installDir '保留验证.txt'
[IO.File]::WriteAllText($sentinel, '覆盖安装和卸载均不得删除用户额外文件', [Text.UTF8Encoding]::new($false))
Run-Installer $installer ('/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /LOG="' + (Join-Path $testRoot 'upgrade.log') + '"')
if ((Get-ItemPropertyValue -LiteralPath $registration -Name InstallLocation).TrimEnd('\') -ne $installDir) { throw '覆盖升级未沿用首次路径。' }
if (-not (Test-Path -LiteralPath $sentinel)) { throw '升级删除了用户文件。' }

$uninstaller = Join-Path $installDir 'unins000.exe'
$mutex = [Threading.Mutex]::new($false, 'Local\SiaBrowser.Installation.Validation')
try {
    Run-Installer $uninstaller $uninstallArguments $false
    if (-not (Test-Path -LiteralPath $installedExe)) { throw '运行保护未能阻止卸载。' }
} finally { $mutex.Dispose() }
Run-Installer $uninstaller $uninstallArguments
if ((Test-Path -LiteralPath $installedExe) -or (Test-Path -LiteralPath $registration) -or (Test-Path -LiteralPath $menuLink) -or (Test-Path -LiteralPath $desktopLink)) { throw '卸载后仍有程序、登记或快捷方式残留。' }
if (-not (Test-Path -LiteralPath $sentinel)) { throw '卸载删除了用户文件。' }
if ((Read-FormalRegistrations) -ne $before) { throw '测试修改了正式安装登记。' }
$report = [ordered]@{
    Install = 'passed'
    PayloadHashes = 'passed'
    StartMenuAndDesktop = 'passed'
    UpgradeRetainsPath = 'passed'
    RunningInstallAndUninstallBlocked = 'passed'
    Uninstall = 'passed'
    UnknownFilesPreserved = 'passed'
    FormalRegistrationsUnchanged = 'passed'
    MissingRuntimeDownload = 'not exercised: WebView2 already installed'
    BrowserSessionLaunched = $false
    Logs = $testRoot
}
$report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'installation-report.json') -Encoding UTF8
$report | ConvertTo-Json
