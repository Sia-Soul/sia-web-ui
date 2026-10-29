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
UninstallDisplayIcon={app}\app-sia-demon-eyes-mouth.ico
UninstallDisplayName={#ProductName}
Compression=lzma2/fast
SolidCompression=yes
WizardStyle=modern
DisableWelcomePage=no
; 运行保护由脚本接管，提供重新检测、强制关闭及取消按钮；静默安装保持阻止策略。
CloseApplications=no
RestartApplications=no
VersionInfoVersion={#AppVersion}
; 关联能力登记变化后通知 Shell 刷新候选，不修改用户已选择的默认程序。
ChangesAssociations=yes

[Languages]
Name: "chinesesimp"; MessagesFile: "ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "快捷方式："; Flags: unchecked

[Files]
; 显式列出程序与品牌图标，前端已内嵌到 EXE，不收集浏览数据或发布目录杂项。
Source: "{#PayloadDir}\sia-browser.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#PayloadDir}\app.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#PayloadDir}\app-sia-demon-eyes-mouth.ico"; DestDir: "{app}"; Flags: ignoreversion
; 迁移脚本只解压到安装临时目录，不留在应用目录中。
Source: "migrate-legacy.ps1"; Flags: dontcopy
Source: "close-running-browser.ps1"; Flags: dontcopy
Source: "update-pinned-shortcuts.ps1"; Flags: dontcopy

[Icons]
Name: "{group}\{#ProductName}"; Filename: "{app}\sia-browser.exe"; IconFilename: "{app}\app-sia-demon-eyes-mouth.ico"; WorkingDir: "{app}"
Name: "{group}\卸载{#ProductName}"; Filename: "{uninstallexe}"
Name: "{userdesktop}\{#ProductName}"; Filename: "{app}\sia-browser.exe"; IconFilename: "{app}\app-sia-demon-eyes-mouth.ico"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\sia-browser.exe"; Description: "启动{#ProductName}"; Flags: nowait postinstall skipifsilent

[Registry]
; 与 default_browser.rs 使用同一用户登记名；验证安装不写入正式浏览器能力。
#ifndef ValidationBuild
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\SiaBrowser"; ValueType: string; ValueName: ""; ValueData: "西娅浏览器"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\SiaBrowser\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: """{app}\sia-browser.exe"",0"
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\SiaBrowser\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\sia-browser.exe"""
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\SiaBrowser\Capabilities"; ValueType: string; ValueName: "ApplicationName"; ValueData: "西娅浏览器"
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\SiaBrowser\Capabilities"; ValueType: string; ValueName: "ApplicationDescription"; ValueData: "西娅浏览器 · 轻量级工作空间浏览器"
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\SiaBrowser\Capabilities"; ValueType: string; ValueName: "ApplicationIcon"; ValueData: """{app}\sia-browser.exe"",0"
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\SiaBrowser\Capabilities\URLAssociations"; ValueType: string; ValueName: "http"; ValueData: "SiaBrowserURL"
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\SiaBrowser\Capabilities\URLAssociations"; ValueType: string; ValueName: "https"; ValueData: "SiaBrowserURL"
Root: HKCU; Subkey: "Software\Classes\SiaBrowserURL"; ValueType: string; ValueName: ""; ValueData: "西娅浏览器网址"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SiaBrowserURL"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\SiaBrowserURL\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: """{app}\sia-browser.exe"",0"
Root: HKCU; Subkey: "Software\Classes\SiaBrowserURL\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\sia-browser.exe"" --open-url ""%1"""
Root: HKCU; Subkey: "Software\RegisteredApplications"; ValueType: string; ValueName: "SiaBrowser"; ValueData: "Software\Clients\StartMenuInternet\SiaBrowser\Capabilities"; Flags: uninsdeletevalue
; HTML 打开方式仅增加候选，卸载只移除本应用的值，保留其他程序的关联。
Root: HKCU; Subkey: "Software\Classes\Applications\sia-browser.exe"; ValueType: string; ValueName: "FriendlyAppName"; ValueData: "西娅浏览器"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\Applications\sia-browser.exe\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\sia-browser.exe"" --open-file ""%1"""
Root: HKCU; Subkey: "Software\Classes\Applications\sia-browser.exe\SupportedTypes"; ValueType: string; ValueName: ".html"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\Applications\sia-browser.exe\SupportedTypes"; ValueType: string; ValueName: ".htm"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\SiaBrowserHTML"; ValueType: string; ValueName: ""; ValueData: "西娅浏览器 HTML 文档"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SiaBrowserHTML\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: """{app}\sia-browser.exe"",0"
Root: HKCU; Subkey: "Software\Classes\SiaBrowserHTML\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\sia-browser.exe"" --open-file ""%1"""
Root: HKCU; Subkey: "Software\Classes\.html\OpenWithProgids"; ValueType: string; ValueName: "SiaBrowserHTML"; ValueData: ""; Flags: uninsdeletevalue uninsdeletekeyifempty
Root: HKCU; Subkey: "Software\Classes\.htm\OpenWithProgids"; ValueType: string; ValueName: "SiaBrowserHTML"; ValueData: ""; Flags: uninsdeletevalue uninsdeletekeyifempty
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\SiaBrowser\Capabilities\FileAssociations"; ValueType: string; ValueName: ".html"; ValueData: "SiaBrowserHTML"
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\SiaBrowser\Capabilities\FileAssociations"; ValueType: string; ValueName: ".htm"; ValueData: "SiaBrowserHTML"
#endif

[Code]
var
  RunningPage: TWizardPage;
  RunningStatus, RunningDetails: TNewStaticText;
  RetryRunningButton: TNewButton;
  BrowserWasRunning, ClosingBrowser: Boolean;
  OriginalNextLeft, OriginalNextWidth, OriginalBackLeft: Integer;

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

// 检测只读取运行互斥体，结果呈现在向导页内，不在窗口创建前弹出阻塞对话框。
procedure RefreshRunningStatus;
begin
  BrowserWasRunning := CheckForMutexes('{#BrowserMutex}');
  if BrowserWasRunning then
  begin
    RunningStatus.Caption := '检测到西娅浏览器正在运行';
    RunningDetails.Caption :=
      '可以手动关闭后重新检测，或直接强制关闭并继续安装。' + #13#10#13#10 +
      '强制关闭可能丢失网页中尚未保存的输入；已保存的浏览数据不会被删除。';
    WizardForm.NextButton.Caption := '强制关闭并继续';
  end
  else
  begin
    RunningStatus.Caption := '运行检测通过';
    RunningDetails.Caption := '西娅浏览器当前未运行，可以继续安装。' + #13#10#13#10 +
      '安装期间请保持浏览器关闭，已保存的浏览数据会保留。';
    WizardForm.NextButton.Caption := SetupMessage(msgButtonNext);
  end;
end;

// 重新检测仅更新状态，不关闭浏览器，也不自动跳过当前步骤。
procedure RetryRunningClick(Sender: TObject);
begin
  if not ClosingBrowser then RefreshRunningStatus;
end;

// 欢迎页先显示，下一步再进入运行检测；动作按钮放在向导底部，与取消入口同一行。
procedure InitializeWizard;
begin
  RunningPage := CreateCustomPage(wpWelcome, '检测浏览器运行状态',
    '安装前确认西娅浏览器已关闭。');
  RunningStatus := TNewStaticText.Create(WizardForm);
  RunningStatus.Parent := RunningPage.Surface;
  RunningStatus.SetBounds(0, ScaleY(16), RunningPage.SurfaceWidth, ScaleY(32));
  RunningStatus.AutoSize := False;
  RunningStatus.Font.Size := 12;
  RunningStatus.Font.Style := [fsBold];
  RunningDetails := TNewStaticText.Create(WizardForm);
  RunningDetails.Parent := RunningPage.Surface;
  RunningDetails.SetBounds(0, ScaleY(64), RunningPage.SurfaceWidth, ScaleY(150));
  RunningDetails.AutoSize := False;
  RunningDetails.WordWrap := True;
  RetryRunningButton := TNewButton.Create(WizardForm);
  RetryRunningButton.Parent := WizardForm.NextButton.Parent;
  RetryRunningButton.Caption := '重新检测';
  RetryRunningButton.SetBounds(ScaleX(16), WizardForm.NextButton.Top,
    ScaleX(90), WizardForm.NextButton.Height);
  RetryRunningButton.OnClick := @RetryRunningClick;
  RetryRunningButton.Visible := False;
  OriginalNextLeft := WizardForm.NextButton.Left;
  OriginalNextWidth := WizardForm.NextButton.Width;
  OriginalBackLeft := WizardForm.BackButton.Left;
end;

// 检测页显示之后才读取状态；离开时恢复系统向导按钮的位置与宽度。
procedure CurPageChanged(CurPageID: Integer);
begin
  RetryRunningButton.Visible := CurPageID = RunningPage.ID;
  if CurPageID = RunningPage.ID then
  begin
    // 向导完成 DPI/字体布局后再对齐底部按钮，沿用系统导航按钮的实际坐标。
    RetryRunningButton.Top := WizardForm.NextButton.Top;
    RetryRunningButton.Height := WizardForm.NextButton.Height;
    WizardForm.NextButton.Width := ScaleX(140);
    WizardForm.NextButton.Left := WizardForm.CancelButton.Left - ScaleX(8) - WizardForm.NextButton.Width;
    WizardForm.BackButton.Left := WizardForm.NextButton.Left - ScaleX(8) - WizardForm.BackButton.Width;
    RefreshRunningStatus;
  end
  else
  begin
    WizardForm.NextButton.Left := OriginalNextLeft;
    WizardForm.NextButton.Width := OriginalNextWidth;
    WizardForm.BackButton.Left := OriginalBackLeft;
  end;
end;

// 只有已展示“强制关闭”文案后再次点击该按钮才结束进程，避免状态突变导致误关闭。
function NextButtonClick(CurPageID: Integer): Boolean;
var
  ErrorText: String;
begin
  Result := True;
  if CurPageID <> RunningPage.ID then Exit;
  Result := False;
  if ClosingBrowser then Exit;
  if not CheckForMutexes('{#BrowserMutex}') then
  begin
    Result := True;
    Exit;
  end;
  if WizardSilent then Exit;
  if not BrowserWasRunning then
  begin
    RefreshRunningStatus;
    Exit;
  end;
  ClosingBrowser := True;
  WizardForm.NextButton.Enabled := False;
  WizardForm.BackButton.Enabled := False;
  WizardForm.CancelButton.Enabled := False;
  RetryRunningButton.Enabled := False;
  RunningStatus.Caption := '正在关闭西娅浏览器…';
  WizardForm.Repaint;
  try
    ErrorText := ForceCloseBrowser;
    RefreshRunningStatus;
    if ErrorText <> '' then
    begin
      RunningStatus.Caption := '浏览器未能关闭';
      RunningDetails.Caption := ErrorText + #13#10 + #13#10 +
        '请手动关闭后点击“重新检测”，或再次尝试强制关闭。';
    end
    else Result := not BrowserWasRunning;
  finally
    ClosingBrowser := False;
    WizardForm.NextButton.Enabled := True;
    WizardForm.BackButton.Enabled := True;
    WizardForm.CancelButton.Enabled := True;
    RetryRunningButton.Enabled := True;
  end;
end;

// 交互安装直接创建向导；静默安装没有用户确认入口，仍在运行时立即退出。
function InitializeSetup: Boolean;
begin
  Result := True;
  if WizardSilent then Result := not CheckForMutexes('{#BrowserMutex}');
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
  if CheckForMutexes('{#BrowserMutex}') then
  begin
    Result := '浏览器已重新运行，安装尚未开始。请关闭浏览器后重试，或返回“检测浏览器运行状态”步骤处理。';
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
