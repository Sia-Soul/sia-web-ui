# UTF-8 BOM：仅操作本脚本创建的验证安装器和假浏览器，不操作正式浏览器。
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$target = ((& cargo metadata --no-deps --format-version 1 --manifest-path (Join-Path $PSScriptRoot '../src-tauri/Cargo.toml')) | ConvertFrom-Json).target_directory
$installer = Join-Path $target 'release/bundle/inno/Sia-Browser-Validation-Setup-0.1.0-x64.exe'
$manifest = Get-Content -LiteralPath ($installer + '.manifest.json') -Encoding UTF8 -Raw | ConvertFrom-Json
if (-not $manifest.ValidationBuild -or (Get-FileHash -LiteralPath $installer).Hash -ne $manifest.Sha256) { throw '验证安装包身份或哈希不匹配' }
$testRoot = Join-Path $target ('force-close-tests/' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$env:TEMP = $testRoot
$env:TMP = $testRoot
# 两个同名程序仅产品身份不同，验证不会仅凭文件名误杀进程。
$fixtureSource = @'
using System;
using System.IO;
using System.Threading;
[assembly:System.Reflection.AssemblyProduct("PRODUCT")]
public class Fixture {
 public static void Main(string[] args) {
  using(var mutex=new Mutex(false,"Local\\SiaBrowser.Installation.Validation")) {
   File.WriteAllText(args[0],"ready");Thread.Sleep(Timeout.Infinite);
  }
 }
}
'@
foreach ($kind in @('browser', 'unrelated')) {
    $folder = Join-Path $testRoot $kind
    New-Item -ItemType Directory -Path $folder | Out-Null
    $product = if ($kind -eq 'browser') { 'Sia Installer Close Fixture' } else { 'Unrelated fixture' }
    Add-Type -TypeDefinition $fixtureSource.Replace('PRODUCT',$product).Replace('class Fixture', ('class Fixture' + $kind)) -OutputAssembly (Join-Path $folder 'sia-close-fixture.exe') -OutputType ConsoleApplication
}
# 仅查找本次安装器进程树的按钮；隐藏启动，避免打开额外控制台窗口。
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class InstallerButtons {
 public delegate bool Callback(IntPtr window,IntPtr data);
 [DllImport("user32.dll")] static extern bool EnumWindows(Callback call,IntPtr data);
 [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent,Callback call,IntPtr data);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr window,StringBuilder text,int count);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr window,uint message,IntPtr w,IntPtr l);
 public static IntPtr Find(uint[] pids,string caption) {
  IntPtr result=IntPtr.Zero;
  EnumWindows((window,data)=>{uint pid;GetWindowThreadProcessId(window,out pid);
   if(Array.IndexOf(pids,pid)>=0) EnumChildWindows(window,(child,unused)=>{var text=new StringBuilder(512);GetWindowText(child,text,512);
    if(IsWindowVisible(child)&&text.ToString().Contains(caption)) result=child; return true;},IntPtr.Zero);
   return true;},IntPtr.Zero);
  return result;
 }
}
'@
$fixture = $null
$setup = $null
$ownedIds = @()
function Find-Button([string]$Caption) {
    $deadline = [DateTime]::UtcNow.AddSeconds(15)
    do {
        if ($setup.HasExited) { throw "验证安装器提前退出：$($setup.ExitCode)，日志目录 $testRoot" }
        $all = @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId)
        $script:ownedIds = @($setup.Id)
        for ($i=0; $i -lt 4; $i++) { $script:ownedIds += @($all | Where-Object { $_.ParentProcessId -in $script:ownedIds } | ForEach-Object ProcessId) }
        $handle = [InstallerButtons]::Find([uint32[]]($script:ownedIds | Select-Object -Unique), $Caption)
        if ($handle -ne [IntPtr]::Zero) { return $handle }
        Start-Sleep -Milliseconds 200
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "未找到验证安装器按钮：$Caption"
}
function Click-Button([string]$Caption) {
    $handle = Find-Button $Caption
    if (-not [InstallerButtons]::PostMessage($handle,0xF5,[IntPtr]::Zero,[IntPtr]::Zero)) { throw '无法发送验证按钮点击' }
    Start-Sleep -Milliseconds 350
}
function Start-Fixture([string]$Kind) {
    $ready = Join-Path $testRoot ([Guid]::NewGuid().ToString('N') + '.ready')
    $process = Start-Process -FilePath (Join-Path $testRoot "$Kind/sia-close-fixture.exe") -ArgumentList ('"'+$ready+'"') -WindowStyle Hidden -PassThru
    for ($i=0; $i -lt 50 -and -not (Test-Path -LiteralPath $ready); $i++) { Start-Sleep -Milliseconds 100 }
    if (-not (Test-Path -LiteralPath $ready)) { throw '测试进程启动失败' }
    return $process
}
try {
    $fixture = Start-Fixture 'unrelated'
    $report = Join-Path $testRoot 'close-result.txt'
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'close-running-browser.ps1') -ValidationBuild -ResultFile $report
    if ($LASTEXITCODE -eq 0 -or $fixture.HasExited) { throw '不能关闭产品身份不匹配的同名进程' }
    $fixture.Kill(); $fixture.WaitForExit(); $fixture.Dispose()
    $fixture = Start-Fixture 'browser'
    $silent = Start-Process -FilePath $installer -ArgumentList '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-' -WindowStyle Hidden -PassThru -Wait
    if ($silent.ExitCode -eq 0 -or $fixture.HasExited) { throw '静默安装必须阻止安装且不关闭浏览器' }
    $setup = Start-Process -FilePath $installer -ArgumentList ('/SP- /LOG="' + (Join-Path $testRoot 'cancel.log') + '"') -WindowStyle Hidden -PassThru
    Click-Button '取消'
    if (-not $setup.WaitForExit(10000) -or $fixture.HasExited) { throw '取消安装不能关闭浏览器' }
    $setup = Start-Process -FilePath $installer -ArgumentList ('/SP- /LOG="' + (Join-Path $testRoot 'close.log') + '"') -WindowStyle Hidden -PassThru
    Click-Button '重新检测'
    if ($fixture.HasExited) { throw '重新检测不能关闭浏览器' }
    Click-Button '强制关闭并继续安装'
    if (-not $fixture.WaitForExit(15000)) { throw '强制关闭按钮未结束测试浏览器' }
    $null = Find-Button '下一步'
    Write-Host 'PASS：同名异产品不误关、静默保护、取消、重新检测、强制关闭、进入安装向导。'
} finally {
    # 只结束本次启动并追踪的验证进程；不按全局进程名清理。
    if ($setup -and -not $setup.HasExited) { & taskkill /PID $setup.Id /T /F | Out-Null }
    if ($fixture) { if (-not $fixture.HasExited) { $fixture.Kill(); $fixture.WaitForExit() }; $fixture.Dispose() }
}
