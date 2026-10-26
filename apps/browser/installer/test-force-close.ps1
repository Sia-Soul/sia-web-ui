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
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window,out Rect rect);
 // 验证操作按钮在向导底部同一行，避免回退成向导之前的独立任务对话框。
 public static bool SameRow(IntPtr first,IntPtr second) {
  Rect a,b; return GetWindowRect(first,out a)&&GetWindowRect(second,out b)&&Math.Abs(a.Top-b.Top)<=2&&a.Right<=b.Left;
 }
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr window,uint message,IntPtr w,IntPtr l);
 public static IntPtr Find(uint[] pids,string caption) {
  IntPtr result=IntPtr.Zero; bool exact=false;
  EnumWindows((window,data)=>{uint pid;GetWindowThreadProcessId(window,out pid);
   if(Array.IndexOf(pids,pid)>=0) EnumChildWindows(window,(child,unused)=>{var text=new StringBuilder(512);GetWindowText(child,text,512);
    if(IsWindowVisible(child)&&text.ToString()==caption) {result=child;exact=true;}
    else if(!exact&&IsWindowVisible(child)&&text.ToString().Contains(caption)) result=child; return true;},IntPtr.Zero);
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
# 原生向导的取消会要求确认；只操作当前测试安装器的确认按钮。
function Cancel-Setup {
    Click-Button '取消'
    Click-Button '是'
    if (-not $setup.WaitForExit(10000)) { throw '取消后安装向导未退出' }
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
    # 浏览器仍在运行时也必须先出现欢迎向导，不能先显示拦截弹窗。
    $null = Find-Button '下一步'
    Cancel-Setup
    if ($fixture.HasExited) { throw '取消安装不能关闭浏览器' }
    $setup = Start-Process -FilePath $installer -ArgumentList ('/SP- /LOG="' + (Join-Path $testRoot 'close.log') + '"') -WindowStyle Hidden -PassThru
    Click-Button '下一步'
    $retry = Find-Button '重新检测'
    $force = Find-Button '强制关闭并继续'
    if (-not [InstallerButtons]::SameRow($retry, $force)) { throw '运行处理按钮未排列在向导底部同一行' }
    Click-Button '重新检测'
    if ($fixture.HasExited) { throw '重新检测不能关闭浏览器' }
    Click-Button '强制关闭并继续'
    if (-not $fixture.WaitForExit(15000)) { throw '强制关闭按钮未结束测试浏览器' }
    $null = Find-Button '选择目标位置'
    Cancel-Setup
    # 用户手动关闭后重新检测，须恢复正常“下一步”并继续到安装目录页。
    $fixture.Dispose()
    $fixture = Start-Fixture 'browser'
    $setup = Start-Process -FilePath $installer -ArgumentList '/SP-' -WindowStyle Hidden -PassThru
    Click-Button '下一步'
    $null = Find-Button '强制关闭并继续'
    $fixture.Kill(); $fixture.WaitForExit()
    Click-Button '重新检测'
    $null = Find-Button '运行检测通过'
    Click-Button '下一步'
    $null = Find-Button '选择目标位置'
    Write-Host 'PASS：先显示欢迎向导、独立检测步骤、底部动作按钮、同名异产品不误关、静默保护、取消、重新检测、强制关闭及手动关闭后继续。'
} finally {
    # 只结束本次启动并追踪的验证进程；不按全局进程名清理。
    if ($setup -and -not $setup.HasExited) { & taskkill /PID $setup.Id /T /F | Out-Null }
    if ($fixture) { if (-not $fixture.HasExited) { $fixture.Kill(); $fixture.WaitForExit() }; $fixture.Dispose() }
}
