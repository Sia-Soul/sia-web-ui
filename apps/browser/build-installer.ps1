# UTF-8 BOM：构建浏览器后使用白名单打包，不携带个人数据、旧程序或测试文件。
param(
    [string]$Compiler = 'C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
    [switch]$SkipBuild,
    [switch]$ValidationBuild
)
$ErrorActionPreference = 'Stop'
# 直接使用系统 SHA-256，避免嵌套 pnpm/PowerShell 环境中模块自动发现失败而遗漏校验文件。
function Get-InstallerFileHash([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '') }
    finally { $algorithm.Dispose(); $stream.Dispose() }
}
$config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'src-tauri\tauri.conf.json') -Encoding UTF8 -Raw | ConvertFrom-Json
$version = $config.version
# 读取 Cargo 的有效输出目录，同时兼容仓库配置和 CARGO_TARGET_DIR 环境变量。
Push-Location $PSScriptRoot
try {
    $metadataText = & cargo metadata --no-deps --format-version 1 --manifest-path src-tauri/Cargo.toml
    if ($LASTEXITCODE -ne 0) { throw '无法读取 Cargo 构建目录。' }
    $targetDirectory = ($metadataText | ConvertFrom-Json).target_directory
} finally { Pop-Location }
$release = Join-Path $targetDirectory 'release'
$exe = Join-Path $release 'sia-browser.exe'
$output = Join-Path $release 'bundle\inno'
$stage = Join-Path $targetDirectory ('installer-stage\' + [Guid]::NewGuid().ToString('N'))
# 仅在本次构建进程中把编译和压缩的临时文件移到同一磁盘，不修改用户环境变量。
$buildTemp = Join-Path $targetDirectory 'tmp'
New-Item -ItemType Directory -Path $buildTemp -Force | Out-Null
$env:TEMP = $buildTemp
$env:TMP = $buildTemp
if (-not (Test-Path -LiteralPath $Compiler)) { throw '请先安装 Inno Setup 6，或用 -Compiler 指定 ISCC.exe。' }

if (-not $SkipBuild) {
    # 正在运行的便携程序可以继续使用旧文件；重命名后构建新的 EXE，不强制结束用户会话。
    if ((Test-Path -LiteralPath $exe) -and (Get-Process -Name 'sia-browser' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe })) {
        Move-Item -LiteralPath $exe -Destination (Join-Path $release ('sia-browser-previous-' + [Guid]::NewGuid().ToString('N') + '.exe'))
    }
    Push-Location $PSScriptRoot
    try {
        & pnpm tauri:build:bin
        if ($LASTEXITCODE -ne 0) { throw '浏览器构建失败，未生成安装包。' }
    } finally { Pop-Location }
}

# 即使显式复用构建产物，也必须校验版本、产品名称和 x64 架构，避免交付错包。
$info = (Get-Item -LiteralPath $exe).VersionInfo
# Tauri 的显示版本省略末尾 .0，使用 PE 数值字段比较，避免三段与四段版本被误判。
$builtVersion = "$($info.FileMajorPart).$($info.FileMinorPart).$($info.FileBuildPart)"
if ($builtVersion -ne $version -or $info.FilePrivatePart -ne 0 -or $info.ProductName -ne $config.productName) {
    throw '程序与当前配置的版本或产品名称不一致，请重新构建。'
}
$pe = [IO.File]::ReadAllBytes($exe)
$header = [BitConverter]::ToInt32($pe, 0x3c)
if ([BitConverter]::ToUInt16($pe, $header + 4) -ne 0x8664) { throw '当前安装包仅支持 x64 程序。' }
New-Item -ItemType Directory -Path $stage,$output -Force | Out-Null
Copy-Item -LiteralPath $exe -Destination $stage
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'src-tauri\icons\icon.ico') -Destination (Join-Path $stage 'app.ico')
$compileArgs = @("/DAppVersion=$version", "/DPayloadDir=$stage", "/O$output")
$baseName = "Sia-Browser-Setup-$version-x64"
if ($ValidationBuild) {
    $compileArgs += '/DValidationBuild=1'
    $baseName = "Sia-Browser-Validation-Setup-$version-x64"
}
& $Compiler @compileArgs (Join-Path $PSScriptRoot 'installer\SiaBrowser.iss')
if ($LASTEXITCODE -ne 0) { throw '安装包编译失败。' }
$installer = Join-Path $output "$baseName.exe"
$hash = Get-InstallerFileHash $installer
$utf8 = [Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText("$installer.sha256", "$hash  $baseName.exe`n", $utf8)
# 清单用于验收确切运行文件与安装包哈希，不记录机器上的账号或浏览信息。
$manifest = [ordered]@{
    ProductName = $config.productName
    Version = $version
    Architecture = 'x64'
    ValidationBuild = [bool]$ValidationBuild
    Sha256 = $hash
    Files = @(Get-ChildItem -LiteralPath $stage -File | ForEach-Object {
        @{ Name = $_.Name; Sha256 = Get-InstallerFileHash $_.FullName }
    })
}
[IO.File]::WriteAllText("$installer.manifest.json", ($manifest | ConvertTo-Json -Depth 4), $utf8)
Write-Host "安装包已生成：$installer"
