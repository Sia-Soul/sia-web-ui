# 仅统计显式指定的隔离测试目录，不读取或输出其他浏览器的命令行。
param([Parameter(Mandatory=$true)][string]$TestDirectory, [string]$ScopePrefixes = '', [switch]$IncludeChildren)
$ErrorActionPreference = 'Stop'
# 前缀使用项目的 UTF-8 十六进制目录编码，排除壳层启动时仍在使用的其他分组。
$scopePatterns = @($ScopePrefixes.Split(',') | Where-Object { $_ } | ForEach-Object {
    'g-' + (([Text.Encoding]::UTF8.GetBytes($_) | ForEach-Object { $_.ToString('x2') }) -join '')
})
$profiles = @(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine.Contains($TestDirectory) -and
    $_.CommandLine.Contains('browser-profiles-v2') -and ($IncludeChildren -or $_.CommandLine -notmatch '--type=')
} | Where-Object {
    $line = $_.CommandLine
    $scopePatterns.Count -eq 0 -or @($scopePatterns | Where-Object { $line.Contains($_) }).Count -gt 0
} | ForEach-Object {
    [PSCustomObject]@{ processId = $_.ProcessId; workingSetBytes = [long]$_.WorkingSetSize }
})
ConvertTo-Json -InputObject $profiles -Compress
