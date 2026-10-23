# UTF-8 BOM：用真实 Tauri NSIS 模板创建两个隔离旧版，验证迁移、错误阻断及数据保留。
$ErrorActionPreference = 'Stop'
$browserRoot = Split-Path $PSScriptRoot -Parent
# 迁移验证模板与测试目录跟随 Cargo 输出目录，避免回退到旧 C 盘缓存。
Push-Location $browserRoot
try {
    $targetMetadata = & cargo metadata --no-deps --format-version 1 --manifest-path src-tauri/Cargo.toml
    if ($LASTEXITCODE -ne 0) { throw '无法读取 Cargo 构建目录。' }
    $targetDirectory = ($targetMetadata | ConvertFrom-Json).target_directory
} finally { Pop-Location }
$templateRoot = Join-Path $targetDirectory 'release\nsis\x64'
$compiler = Join-Path $env:LOCALAPPDATA 'tauri\NSIS\makensis.exe'
$names = @('Sia Browser Migration Test A', 'Sia Browser Migration Test B')
$registryRoot = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
foreach ($name in $names) {
    if (Test-Path -LiteralPath (Join-Path $registryRoot $name)) { throw '已有迁移验证登记，请先检查上次测试。' }
}
$testRoot = Join-Path $targetDirectory ('migration-tests\' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
foreach ($file in @('utils.nsh','FileAssociation.nsh','English.nsh')) {
    Copy-Item -LiteralPath (Join-Path $templateRoot $file) -Destination $testRoot
}
$bundleId = 'com.sia.browser.migration-test-' + [Guid]::NewGuid().ToString('N')
$dataMarkers = @()
foreach ($dataRoot in @($env:LOCALAPPDATA, $env:APPDATA)) {
    $dataDirectory = Join-Path $dataRoot $bundleId
    New-Item -ItemType Directory -Path $dataDirectory | Out-Null
    $marker = Join-Path $dataDirectory '浏览数据保留验证.txt'
    [IO.File]::WriteAllText($marker, '虚构密码和 Cookie 数据，不得删除', [Text.UTF8Encoding]::new($true))
    $dataMarkers += $marker
}
$template = Get-Content -LiteralPath (Join-Path $templateRoot 'installer.nsi') -Encoding UTF8 -Raw
$installDirs = @()
foreach ($name in $names) {
    $script = $template.Replace('!define PRODUCTNAME "西娅浏览器"', ('!define PRODUCTNAME "' + $name + '"'))
    $script = $script.Replace('!define MANUFACTURER "sia"', '!define MANUFACTURER "SiaBrowserMigrationTest"')
    $script = $script.Replace('!define BUNDLEID "com.sia.browser"', ('!define BUNDLEID "' + $bundleId + '"'))
    $setup = Join-Path $testRoot ($name + '-setup.exe')
    $script = $script.Replace('!define OUTFILE "nsis-output.exe"', ('!define OUTFILE "' + $setup + '"'))
    # 防止模板变化导致身份替换失效，绝不生成真实品牌的测试安装器。
    if ($script.Contains('!define PRODUCTNAME "西娅浏览器"') -or $script.Contains('!define BUNDLEID "com.sia.browser"') -or
        -not $script.Contains('!define PRODUCTNAME "' + $name + '"')) { throw 'NSIS 模板身份替换失败。' }
    $scriptPath = Join-Path $testRoot ($name + '.nsi')
    [IO.File]::WriteAllText($scriptPath, $script, [Text.UTF8Encoding]::new($true))
    & $compiler /V2 $scriptPath
    if ($LASTEXITCODE -ne 0) { throw 'NSIS 验证安装器编译失败。' }
    $installDir = Join-Path $testRoot ($name + ' 程序目录')
    $installDirs += $installDir
    $process = Start-Process -FilePath $setup -ArgumentList ('/S /D=' + $installDir) -WindowStyle Hidden -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw 'NSIS 验证旧版安装失败。' }
    [IO.File]::WriteAllText((Join-Path $installDir '用户额外文件.txt'), '用户额外文件', [Text.UTF8Encoding]::new($true))
}

# 一个旧版损坏时须在卸载任何版本前失败，不能先删除另一个正常旧版。
$brokenKey = Join-Path $registryRoot $names[1]
$originalCommand = Get-ItemPropertyValue -LiteralPath $brokenKey -Name UninstallString
Set-ItemProperty -LiteralPath $brokenKey -Name UninstallString -Value '"C:\不存在的迁移验证\uninstall.exe"'
$resultPath = Join-Path $testRoot 'failure-result.txt'
try {
    & powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'migrate-legacy.ps1') -ValidationBuild -ResultFile $resultPath
    if ($LASTEXITCODE -eq 0) { throw '损坏的卸载登记未阻止迁移。' }
    foreach ($directory in $installDirs) {
        if (-not (Test-Path -LiteralPath (Join-Path $directory 'sia-browser.exe'))) { throw '预检查失败后仍卸载了旧程序。' }
    }
} finally { Set-ItemProperty -LiteralPath $brokenKey -Name UninstallString -Value $originalCommand }

# 通过完整安装向导的 PrepareToInstall 触发迁移，再执行既有覆盖升级与卸载回归。
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'test-installer.ps1')
if ($LASTEXITCODE -ne 0) { throw '完整安装迁移验证失败。' }
foreach ($name in $names) {
    if (Test-Path -LiteralPath (Join-Path $registryRoot $name)) { throw '旧版安装登记没有清理。' }
    $shortcut = Join-Path ([Environment]::GetFolderPath('Programs')) ($name + '.lnk')
    if (Test-Path -LiteralPath $shortcut) { throw '旧版快捷方式没有清理。' }
}
foreach ($directory in $installDirs) {
    if ((Test-Path -LiteralPath (Join-Path $directory 'sia-browser.exe')) -or
        (Test-Path -LiteralPath (Join-Path $directory 'uninstall.exe'))) { throw '旧版程序仍残留。' }
    if (-not (Test-Path -LiteralPath (Join-Path $directory '用户额外文件.txt'))) { throw '旧版额外文件被误删。' }
}
foreach ($marker in $dataMarkers) {
    if ((Get-Content -LiteralPath $marker -Encoding UTF8 -Raw) -ne '虚构密码和 Cookie 数据，不得删除') { throw '迁移未保留浏览数据。' }
    # 仅删除本测试创建的已知文件和空目录，不执行递归清理。
    Remove-Item -LiteralPath $marker
    Remove-Item -LiteralPath (Split-Path $marker -Parent)
}
$report = [ordered]@{
    TwoLegacyVersionsMigrated = 'passed'
    RealNsisUpdateMode = 'passed'
    BrokenRegistrationBlocksAllUninstalls = 'passed'
    AppDataAndLocalAppDataPreserved = 'passed'
    LegacyShortcutsRemoved = 'passed'
    UnknownFilesPreserved = 'passed'
    ProductionInstallationsChanged = $false
    Logs = $testRoot
}
$report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $targetDirectory 'release\bundle\inno\migration-report.json') -Encoding UTF8
$report | ConvertTo-Json
