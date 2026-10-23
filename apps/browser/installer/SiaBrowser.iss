; UTF-8：沿用鼠标指针项目的 Inno Setup 原生中文向导。
#ifndef AppVersion
  #error 必须由 build-installer.ps1 传入版本号
#endif
#ifndef PayloadDir
  #error 必须由 build-installer.ps1 传入经过校验的运行文件目录
#endif

; 验证包使用独立安装身份和快捷方式，绝不覆盖正式安装登记。
#ifdef ValidationBuild
  #define InstallerId "com.sia.browser.installer-validation"
  #define ProductName "西娅浏览器安装验证"
  #define InstallFolder "SiaBrowser-InstallerValidation"
  #define OutputName "Sia-Browser-Validation-Setup-" + AppVersion + "-x64"
  #define BrowserMutex "Local\SiaBrowser.Installation.Validation"
#else
  #define InstallerId "com.sia.browser"
  #define ProductName "西娅浏览器"
  #define InstallFolder "SiaBrowser"
  #define OutputName "Sia-Browser-Setup-" + AppVersion + "-x64"
  #define BrowserMutex "Local\SiaBrowser.Installation"
#endif

[Setup]
; 固定身份用于后续覆盖升级，浏览器自己的数据标识仍为 com.sia.browser。
AppId={#InstallerId}
AppName={#ProductName}
AppVersion={#AppVersion}
AppVerName={#ProductName} {#AppVersion}
AppPublisher=Sia UI
DefaultDirName={localappdata}\Programs\{#InstallFolder}
DefaultGroupName={#ProductName}
DisableProgramGroupPage=yes
DisableDirPage=no
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
OutputBaseFilename={#OutputName}
SetupIconFile={#PayloadDir}\app.ico
UninstallDisplayIcon={app}\app-s1e-iridescent.ico
UninstallDisplayName={#ProductName}
Compression=lzma2/fast
SolidCompression=yes
WizardStyle=modern
DisableWelcomePage=no
; 运行保护由脚本接管，提供重新检测、强制关闭及取消按钮；静默安装保持阻止策略。
CloseApplications=no
RestartApplications=no
VersionInfoVersion={#AppVersion}

[Languages]
Name: "chinesesimp"; MessagesFile: "ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "快捷方式："; Flags: unchecked

[Files]
; 显式列出程序与品牌图标，前端已内嵌到 EXE，不收集浏览数据或发布目录杂项。
Source: "{#PayloadDir}\sia-browser.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#PayloadDir}\app.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#PayloadDir}\app-s1e-iridescent.ico"; DestDir: "{app}"; Flags: ignoreversion
; 迁移脚本只解压到安装临时目录，不留在应用目录中。
Source: "migrate-legacy.ps1"; Flags: dontcopy
Source: "close-running-browser.ps1"; Flags: dontcopy
Source: "update-pinned-shortcuts.ps1"; Flags: dontcopy

[Icons]
Name: "{group}\{#ProductName}"; Filename: "{app}\sia-browser.exe"; IconFilename: "{app}\app-s1e-iridescent.ico"; WorkingDir: "{app}"
Name: "{group}\卸载{#ProductName}"; Filename: "{uninstallexe}"
Name: "{userdesktop}\{#ProductName}"; Filename: "{app}\sia-browser.exe"; IconFilename: "{app}\app-s1e-iridescent.ico"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\sia-browser.exe"; Description: "启动{#ProductName}"; Flags: nowait postinstall skipifsilent

[Code]
// 文件安装完成后更新已有任务栏链接；验证包不访问用户的真实固定项目。
procedure CurStepChanged(CurStep: TSetupStep);
var
  ExitCode: Integer;
begin
#ifndef ValidationBuild
  if CurStep = ssPostInstall then
  begin
    ExtractTemporaryFile('update-pinned-shortcuts.ps1');
    if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
      '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' +
      ExpandConstant('{tmp}\update-pinned-shortcuts.ps1') + '" -InstallDirectory "' + ExpandConstant('{app}') + '"',
      '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then
      Log('无法启动任务栏快捷方式更新程序。')
    else if ExitCode <> 0 then
      Log('任务栏快捷方式更新未完成，退出码：' + IntToStr(ExitCode));
  end;
#endif
end;

// 用户选择强制关闭后才运行固定脚本，按产品身份和会话筛选，不按名称批量结束其他软件。
function ForceCloseBrowser: String;
var
  ExitCode: Integer;
  Arguments, ReportPath: String;
  ErrorText: AnsiString;
begin
  Result := '';
  ExtractTemporaryFile('close-running-browser.ps1');
  ReportPath := ExpandConstant('{tmp}\close-browser-result.txt');
  Arguments := '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' +
    ExpandConstant('{tmp}\close-running-browser.ps1') + '" -ResultFile "' + ReportPath + '"';
#ifdef ValidationBuild
  Arguments := Arguments + ' -ValidationBuild';
#endif
  if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Arguments,
    '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then
    Result := '无法启动关闭程序，请重试。'
  else if ExitCode <> 0 then
  begin
    if LoadStringFromFile(ReportPath, ErrorText) then Result := Trim(UTF8Decode(ErrorText));
    if Result = '' then Result := '浏览器未能关闭，请检查是否以管理员身份运行，然后重试。';
  end;
end;

// 初始化和覆盖文件前均检查；静默运行绝不自动结束浏览器，也不弹出交互对话框。
function EnsureBrowserClosed: Boolean;
var
  Choice: Integer;
  ErrorText: String;
begin
  Result := False;
  while CheckForMutexes('{#BrowserMutex}') do
  begin
    if WizardSilent then Exit;
    Choice := TaskDialogMsgBox('检测到西娅浏览器正在运行',
      '可以手动关闭后重新检测，或直接强制关闭并继续安装。' + #13#10 +
      '强制关闭可能丢失网页中尚未保存的输入；已保存的浏览数据不会被删除。',
      mbError, MB_YESNOCANCEL, ['重新检测', '强制关闭并继续安装'], 0);
    if Choice = IDNO then
    begin
      ErrorText := ForceCloseBrowser;
      if ErrorText <> '' then MsgBox(ErrorText, mbError, MB_OK);
    end
    else if Choice <> IDYES then Exit;
  end;
  Result := True;
end;

function InitializeSetup: Boolean;
begin
  Result := EnsureBrowserClosed;
end;

// 卸载继续要求正常退出；仅安装向导提供用户主动选择的强制关闭入口。
function InitializeUninstall: Boolean;
begin
  Result := False;
  while CheckForMutexes('{#BrowserMutex}') do
    if SuppressibleMsgBox('西娅浏览器正在运行，请关闭后点击“确定”继续卸载。',
      mbError, MB_OKCANCEL, IDCANCEL) <> IDOK then Exit;
  Result := True;
end;

// 在准备安装页说明迁移；只有用户点击安装后才调用旧卸载器。
function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo,
  MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
begin
  Result := MemoDirInfo + NewLine + NewLine + MemoGroupInfo;
  if MemoTasksInfo <> '' then Result := Result + NewLine + NewLine + MemoTasksInfo;
  Result := Result + NewLine + NewLine + '升级处理：自动卸载检测到的旧版浏览器，保留密码、标签、历史及网站登录数据，然后安装新版。';
end;

// 使用随安装包分发的固定脚本迁移，不拼接执行注册表里的命令行。
function MigrateLegacyInstallations: String;
var
  ExitCode: Integer;
  Arguments, ReportPath: String;
  ErrorText: AnsiString;
begin
  Result := '';
  ExtractTemporaryFile('migrate-legacy.ps1');
  ReportPath := ExpandConstant('{tmp}\migration-result.txt');
  Arguments := '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' +
    ExpandConstant('{tmp}\migrate-legacy.ps1') + '" -ResultFile "' + ReportPath + '"';
#ifdef ValidationBuild
  Arguments := Arguments + ' -ValidationBuild';
#endif
  WizardForm.StatusLabel.Caption := '正在迁移旧版浏览器，保留浏览数据…';
  if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Arguments,
    '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then
    Result := '无法启动旧版迁移程序，请重试。'
  else if ExitCode <> 0 then
  begin
    if LoadStringFromFile(ReportPath, ErrorText) then Result := Trim(UTF8Decode(ErrorText));
    if Result = '' then Result := '旧版迁移未完成，请关闭浏览器后重试。';
  end;
end;
// 检测 Evergreen 运行时；已安装 Edge 浏览器不能替代此检测。
function HasWebView2: Boolean;
var
  Version: String;
  Key: String;
begin
  Key := 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  Result := RegQueryStringValue(HKLM32, Key, 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0');
  if not Result then
    Result := RegQueryStringValue(HKCU, Key, 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0');
end;

// 仅缺失运行时才联网下载微软引导程序；失败时阻止安装并显示可操作的错误提示。
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ExitCode: Integer;
begin
  Result := '';
  if not EnsureBrowserClosed then
  begin
    Result := '浏览器仍在运行，安装尚未开始。关闭浏览器后可以重试，或取消安装。';
    Exit;
  end;
  if not HasWebView2 then
  begin
    try
      DownloadTemporaryFile('https://go.microsoft.com/fwlink/p/?LinkId=2124703',
        'MicrosoftEdgeWebview2Setup.exe', '', nil);
    except
      Result := '下载 Microsoft WebView2 失败，请连接网络后重试，或先从微软官网下载并安装 WebView2 Runtime。' + #13#10 + GetExceptionMessage;
      Exit;
    end;
    if not Exec(ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe'),
      '/silent /install', '', SW_HIDE, ewWaitUntilTerminated, ExitCode) then
      Result := '无法启动 Microsoft WebView2 安装程序，请重试。'
    else if not HasWebView2 then
      Result := '未能安装 Microsoft WebView2 运行环境。请连接网络后重试，或先从微软官网下载并安装 WebView2 Runtime。错误码：' + IntToStr(ExitCode);
  end;
  // 先确认运行环境可用，再卸载旧版，避免下载失败后用户暂时没有可用浏览器。
  if Result = '' then Result := MigrateLegacyInstallations;
end;

// 不设置 UninstallDelete：卸载只删除安装器登记的文件，保留 com.sia.browser 数据和用户额外文件。
