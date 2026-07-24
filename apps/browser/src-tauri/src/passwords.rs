use serde::{Deserialize, Serialize};
use std::{
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};

#[cfg(windows)]
use std::{ffi::c_void, slice};
#[cfg(windows)]
use webview2_com::{
    CoTaskMemPWSTR, Microsoft::Web::WebView2::Win32::ICoreWebView2, WebMessageReceivedEventHandler,
};
#[cfg(windows)]
use windows::{
    core::{PCWSTR, PWSTR},
    Win32::{
        Foundation::{LocalFree, HLOCAL},
        Security::Cryptography::{
            CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
        },
    },
};

const PASSWORD_VAULT_FILE: &str = "password-vault.bin";
const MAX_CREDENTIALS: usize = 10_000;
static PASSWORD_ID_COUNTER: AtomicU64 = AtomicU64::new(1);

pub const PASSWORD_AUTOFILL_SCRIPT: &str = r#"
(() => {
  if (!window.chrome?.webview) return;

  const postMessage = window.chrome.webview.postMessage.bind(window.chrome.webview);
  let queryTimer;
  let activeInput;
  let suggestionHost;
  let suggestionRoot;
  let suggestionSheet;
  let suggestionDatalist;
  let datalistUsernameInput;
  let suggestionOptions = [];
  let lastSubmission = "";
  let lastSubmissionAt = 0;
  const suggestionContentStyles = `
    * { box-sizing: border-box; }
    .panel { overflow:hidden; color:#182033; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif; background:#fff; border:1px solid rgba(15,23,42,.16); border-radius:10px; box-shadow:0 8px 24px rgba(15,23,42,.16); }
    .title { display:flex; min-height:36px; align-items:center; padding:8px 12px; color:#5b6475; font-size:12px; font-weight:600; border-bottom:1px solid #e8ebf0; }
    .list { max-height:220px; overflow:auto; padding:4px; }
    .option { display:grid; width:100%; min-height:48px; align-items:center; padding:6px 8px; color:inherit; font:inherit; text-align:left; background:transparent; border:0; border-radius:7px; cursor:pointer; grid-template-columns:30px minmax(0,1fr); gap:8px; }
    .option:hover,.option:focus-visible { outline:none; background:#edf5ff; }
    .mark { display:grid; width:28px; height:28px; color:#fff; font-size:16px; font-weight:750; place-items:center; background:linear-gradient(135deg,#845ef7,#2684ff 50%,#16b8a6); border-radius:8px; }
    .copy { display:grid; min-width:0; gap:2px; }
    .username,.name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .username { color:#182033; font-size:13px; font-weight:600; }
    .name { color:#6c7484; font-size:11px; }
    .footer { padding:7px 12px; color:#7a8290; font-size:10px; border-top:1px solid #e8ebf0; }
    @media (prefers-color-scheme:dark) {
      .panel { color:#edf0f7; background:#20232a; border-color:rgba(255,255,255,.16); }
      .title,.footer { color:#aeb5c2; border-color:rgba(255,255,255,.1); }
      .option:hover,.option:focus-visible { background:#2d3d55; }
      .username { color:#f4f6fb; }
      .name { color:#aeb5c2; }
    }
  `;

  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };

  const findFields = (root = document) => {
    const passwords = [...root.querySelectorAll([
      'input[type="password"]',
      'input[autocomplete~="current-password"]',
      'input[autocomplete~="new-password"]',
      'input[name*="password" i]',
      'input[id*="password" i]',
    ].join(","))].filter((element) => isVisible(element) && !element.disabled && !element.readOnly);
    const password = passwords[0];
    if (!password) return {};
    const scope = password.form || root;
    const candidates = [...scope.querySelectorAll(
      'input:not([type]),input[type="text"],input[type="email"],input[type="tel"],input[type="username"]'
    )].filter((element) => element !== password && isVisible(element) && !element.disabled && !element.readOnly);
    const autocompleteMatch = candidates.find((element) =>
      /(^|\s)(username|email)(\s|$)/i.test(element.autocomplete || "")
    );
    const preceding = candidates.filter((element) =>
      (element.compareDocumentPosition(password) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    ).at(-1);
    return { password, username: autocompleteMatch || preceding || candidates[0] };
  };

  const setInputValue = (input, value) => {
    if (!input || value == null) return;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const isCredentialInput = (input) => {
    if (!(input instanceof HTMLInputElement)) return false;
    const { password, username } = findFields();
    return input === password || input === username;
  };

  const hideSuggestions = () => {
    if (suggestionHost) suggestionHost.hidden = true;
  };

  const applySuggestionStyles = (left = 8, top = 8, width = 320) => {
    suggestionSheet?.replaceSync(`
      :host {
        all: initial;
        position: fixed;
        z-index: 2147483647;
        display: block;
        left: ${left}px;
        top: ${top}px;
        width: ${width}px;
        box-sizing: border-box;
        color-scheme: light dark;
      }
      :host([hidden]) { display: none !important; }
      ${suggestionContentStyles}
    `);
  };

  const ensureSuggestionPanel = () => {
    if (suggestionHost?.isConnected) return;
    suggestionHost = document.createElement("div");
    suggestionHost.setAttribute("data-sia-password-suggestions", "");
    suggestionHost.hidden = true;
    suggestionRoot = suggestionHost.attachShadow({ mode: "closed" });
    suggestionSheet = new CSSStyleSheet();
    suggestionRoot.adoptedStyleSheets = [suggestionSheet];
    applySuggestionStyles();
    document.documentElement.append(suggestionHost);
  };

  const positionSuggestions = () => {
    if (!suggestionHost || suggestionHost.hidden || !activeInput?.isConnected) return;
    const rect = activeInput.getBoundingClientRect();
    const width = Math.max(260, Math.min(rect.width, 380, window.innerWidth - 16));
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    applySuggestionStyles(left, rect.bottom + 6, width);
    const panelHeight = suggestionHost.getBoundingClientRect().height || 160;
    const below = rect.bottom + 6;
    const top = below + panelHeight <= window.innerHeight - 8
      ? below
      : Math.max(8, rect.top - panelHeight - 6);
    applySuggestionStyles(left, top, width);
  };

  const renderSuggestions = () => {
    ensureSuggestionPanel();
    suggestionRoot.replaceChildren();
    const panel = document.createElement("div");
    panel.className = "panel";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = `当前站点保存的密码（${suggestionOptions.length}）`;
    const list = document.createElement("div");
    list.className = "list";
    for (const option of suggestionOptions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option";
      button.addEventListener("pointerdown", (event) => event.preventDefault());
      button.addEventListener("click", () => {
        postMessage({ kind: "password-fill-request", credentialId: option.id });
        hideSuggestions();
      });
      const mark = document.createElement("span");
      mark.className = "mark";
      mark.textContent = "S";
      const copy = document.createElement("span");
      copy.className = "copy";
      const username = document.createElement("span");
      username.className = "username";
      username.textContent = option.username || "未填写用户名";
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = option.name || location.host;
      copy.append(username, name);
      button.append(mark, copy);
      list.append(button);
    }
    const footer = document.createElement("div");
    footer.className = "footer";
    footer.textContent = "Sia Browser 密码管理";
    panel.append(title, list, footer);
    suggestionRoot.append(panel);
    suggestionHost.hidden = false;
    positionSuggestions();
    requestAnimationFrame(positionSuggestions);
  };

  const installNativeSuggestions = () => {
    const { username } = findFields();
    if (!username) return;
    if (!suggestionDatalist?.isConnected) {
      suggestionDatalist = document.createElement("datalist");
      suggestionDatalist.id = `sia-password-options-${Math.random().toString(36).slice(2)}`;
      document.documentElement.append(suggestionDatalist);
    }
    suggestionDatalist.replaceChildren();
    for (const option of suggestionOptions) {
      const entry = document.createElement("option");
      entry.value = option.username || "";
      entry.label = option.name || location.host;
      suggestionDatalist.append(entry);
    }
    username.setAttribute("list", suggestionDatalist.id);
    if (datalistUsernameInput === username) return;
    datalistUsernameInput = username;
    username.addEventListener("change", () => {
      const selected = suggestionOptions.find((option) => option.username === username.value);
      if (selected) {
        postMessage({ kind: "password-fill-request", credentialId: selected.id });
      }
    });
  };

  const queryCredentials = (input) => {
    window.clearTimeout(queryTimer);
    activeInput = input;
    queryTimer = window.setTimeout(() => {
      if (!activeInput?.isConnected || !isCredentialInput(activeInput)) {
        hideSuggestions();
        return;
      }
      const rect = activeInput.getBoundingClientRect();
      postMessage({
        kind: "password-options-query",
        inputBounds: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        },
        darkMode: window.matchMedia?.("(prefers-color-scheme: dark)")?.matches === true,
      });
    }, 80);
  };

  const submitCredential = (root = document) => {
    const { password, username } = findFields(root);
    const passwordValue = password?.value || "";
    if (!passwordValue) return;
    const usernameValue = username?.value || "";
    const fingerprint = `${location.origin}\u0000${usernameValue}\u0000${passwordValue}`;
    const now = Date.now();
    if (fingerprint === lastSubmission && now - lastSubmissionAt < 3000) return;
    lastSubmission = fingerprint;
    lastSubmissionAt = now;
    postMessage({
      kind: "password-submitted",
      username: usernameValue,
      password: passwordValue,
    });
  };

  window.chrome.webview.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || message.origin !== location.origin) return;
    if (message.kind === "sia-password-options") {
      suggestionOptions = Array.isArray(message.credentials) ? message.credentials : [];
      if (suggestionOptions.length > 0 && activeInput?.isConnected && isCredentialInput(activeInput)) {
        installNativeSuggestions();
        renderSuggestions();
      } else {
        hideSuggestions();
      }
      return;
    }
    if (message.kind === "sia-password-fill") {
      const { password, username } = findFields();
      if (!password) return;
      setInputValue(username, message.username);
      setInputValue(password, message.password);
      hideSuggestions();
    }
  });

  document.addEventListener("focusin", (event) => {
    if (isCredentialInput(event.target)) {
      queryCredentials(event.target);
    } else {
      hideSuggestions();
    }
  }, true);
  document.addEventListener("pointerdown", (event) => {
    if (suggestionHost && event.target !== suggestionHost) hideSuggestions();
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideSuggestions();
  }, true);
  document.addEventListener("submit", (event) => submitCredential(event.target), true);
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest('button,input[type="submit"],input[type="button"],[role="button"]')
      : null;
    if (target) submitCredential(target.closest("form") || document);
  }, true);

  window.addEventListener("resize", positionSuggestions);
  window.addEventListener("scroll", positionSuggestions, true);

  const startWatching = () => {
    if (isCredentialInput(document.activeElement)) queryCredentials(document.activeElement);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWatching, { once: true });
  } else {
    startWatching();
  }
})();
"#;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PasswordCredential {
    id: String,
    name: String,
    origin: String,
    username: String,
    password: String,
    source: String,
    created_at: u64,
    updated_at: u64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasswordCredentialInput {
    id: Option<String>,
    name: Option<String>,
    origin: String,
    username: String,
    password: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasswordImportEntry {
    name: Option<String>,
    origin: String,
    username: String,
    password: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PasswordCredentialSummary {
    id: String,
    name: String,
    origin: String,
    username: String,
    source: String,
    created_at: u64,
    updated_at: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PasswordImportResult {
    imported: usize,
    updated: usize,
    skipped: usize,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PasswordWebMessage {
    kind: String,
    credential_id: Option<String>,
    username: Option<String>,
    password: Option<String>,
    input_bounds: Option<PasswordInputBounds>,
    dark_mode: Option<bool>,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PasswordInputBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PasswordSubmissionEvent {
    tab_id: String,
    credential_id: Option<String>,
    origin: String,
    username: String,
    password: String,
    is_update: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PasswordFillMessage {
    kind: &'static str,
    origin: String,
    username: String,
    password: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PasswordOption {
    id: String,
    name: String,
    username: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PasswordOptionsMessage {
    kind: &'static str,
    origin: String,
    credentials: Vec<PasswordOption>,
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

fn next_credential_id() -> String {
    format!(
        "credential-{}-{}",
        now_millis(),
        PASSWORD_ID_COUNTER.fetch_add(1, Ordering::Relaxed)
    )
}

fn normalized_origin(raw_value: &str) -> Result<String, String> {
    let value = raw_value.trim();
    if value.is_empty() {
        return Err("网站地址不能为空".to_string());
    }
    let lowercase = value.to_ascii_lowercase();
    let candidate = if lowercase.starts_with("http://") || lowercase.starts_with("https://") {
        value.to_string()
    } else if value.contains("://") {
        return Err("密码仅支持 http 或 https 网站".to_string());
    } else {
        format!("https://{value}")
    };
    let parsed = tauri::Url::parse(&candidate).map_err(|_| "网站地址格式不正确".to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("密码仅支持 http 或 https 网站".to_string());
    }
    if parsed.host_str().is_none() {
        return Err("网站地址缺少有效域名".to_string());
    }
    Ok(parsed.origin().ascii_serialization())
}

fn vault_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&directory)
        .map_err(|error| format!("无法创建密码库目录 {}：{error}", directory.display()))?;
    Ok(directory.join(PASSWORD_VAULT_FILE))
}

#[cfg(windows)]
fn protect_vault_data(data: &[u8]) -> Result<Vec<u8>, String> {
    if data.len() > u32::MAX as usize {
        return Err("密码库数据过大".to_string());
    }
    let input = CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    let result = unsafe {
        CryptProtectData(
            &input,
            windows::core::w!("Sia Browser Password Vault"),
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    result.map_err(|error| format!("无法使用 Windows 加密密码库：{error}"))?;
    let encrypted =
        unsafe { slice::from_raw_parts(output.pbData, output.cbData as usize) }.to_vec();
    unsafe {
        let _ = LocalFree(Some(HLOCAL(output.pbData as *mut c_void)));
    }
    Ok(encrypted)
}

#[cfg(windows)]
fn unprotect_vault_data(data: &[u8]) -> Result<Vec<u8>, String> {
    if data.len() > u32::MAX as usize {
        return Err("密码库数据无效".to_string());
    }
    let input = CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    unsafe {
        CryptUnprotectData(
            &input,
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    }
    .map_err(|error| format!("当前 Windows 用户无法解密密码库：{error}"))?;
    let decrypted =
        unsafe { slice::from_raw_parts(output.pbData, output.cbData as usize) }.to_vec();
    unsafe {
        let _ = LocalFree(Some(HLOCAL(output.pbData as *mut c_void)));
    }
    Ok(decrypted)
}

#[cfg(not(windows))]
fn protect_vault_data(_data: &[u8]) -> Result<Vec<u8>, String> {
    Err("当前平台尚未接入系统密码加密服务".to_string())
}

#[cfg(not(windows))]
fn unprotect_vault_data(_data: &[u8]) -> Result<Vec<u8>, String> {
    Err("当前平台尚未接入系统密码加密服务".to_string())
}

fn read_vault(app: &AppHandle) -> Result<Vec<PasswordCredential>, String> {
    let path = vault_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let encrypted = std::fs::read(&path)
        .map_err(|error| format!("无法读取密码库 {}：{error}", path.display()))?;
    let decrypted = unprotect_vault_data(&encrypted)?;
    serde_json::from_slice(&decrypted).map_err(|error| format!("密码库数据已损坏：{error}"))
}

fn write_vault(app: &AppHandle, credentials: &[PasswordCredential]) -> Result<(), String> {
    let plaintext =
        serde_json::to_vec(credentials).map_err(|error| format!("无法序列化密码库：{error}"))?;
    let encrypted = protect_vault_data(&plaintext)?;
    let path = vault_path(app)?;
    std::fs::write(&path, encrypted)
        .map_err(|error| format!("无法写入密码库 {}：{error}", path.display()))
}

fn summary(credential: &PasswordCredential) -> PasswordCredentialSummary {
    PasswordCredentialSummary {
        id: credential.id.clone(),
        name: credential.name.clone(),
        origin: credential.origin.clone(),
        username: credential.username.clone(),
        source: credential.source.clone(),
        created_at: credential.created_at,
        updated_at: credential.updated_at,
    }
}

fn validate_secret(username: &str, password: &str) -> Result<(), String> {
    if username.len() > 1_024 {
        return Err("用户名过长".to_string());
    }
    if password.is_empty() {
        return Err("密码不能为空".to_string());
    }
    if password.len() > 4_096 {
        return Err("密码过长".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn list_browser_passwords(app: AppHandle) -> Result<Vec<PasswordCredentialSummary>, String> {
    let mut credentials = read_vault(&app)?;
    credentials.sort_by(|left, right| {
        left.origin
            .cmp(&right.origin)
            .then_with(|| left.username.cmp(&right.username))
    });
    Ok(credentials.iter().map(summary).collect())
}

#[tauri::command]
pub fn get_browser_password(app: AppHandle, id: String) -> Result<PasswordCredential, String> {
    read_vault(&app)?
        .into_iter()
        .find(|credential| credential.id == id)
        .ok_or_else(|| "找不到指定密码".to_string())
}

#[tauri::command]
pub fn save_browser_password(
    app: AppHandle,
    credential: PasswordCredentialInput,
) -> Result<PasswordCredentialSummary, String> {
    let origin = normalized_origin(&credential.origin)?;
    let username = credential.username.trim().to_string();
    validate_secret(&username, &credential.password)?;
    let now = now_millis();
    let mut credentials = read_vault(&app)?;
    let existing_index = credential
        .id
        .as_ref()
        .and_then(|id| credentials.iter().position(|entry| &entry.id == id))
        .or_else(|| {
            credentials
                .iter()
                .position(|entry| entry.origin == origin && entry.username == username)
        });

    let saved = if let Some(index) = existing_index {
        let existing = &mut credentials[index];
        existing.name = credential
            .name
            .as_deref()
            .map(str::trim)
            .filter(|name| !name.is_empty())
            .unwrap_or(&origin)
            .to_string();
        existing.origin = origin;
        existing.username = username;
        existing.password = credential.password;
        existing.updated_at = now;
        existing.source = "Sia Browser".to_string();
        existing.clone()
    } else {
        if credentials.len() >= MAX_CREDENTIALS {
            return Err("密码库条目数量已达到上限".to_string());
        }
        let saved = PasswordCredential {
            id: next_credential_id(),
            name: credential
                .name
                .as_deref()
                .map(str::trim)
                .filter(|name| !name.is_empty())
                .unwrap_or(&origin)
                .to_string(),
            origin,
            username,
            password: credential.password,
            source: "Sia Browser".to_string(),
            created_at: now,
            updated_at: now,
        };
        credentials.push(saved.clone());
        saved
    };
    write_vault(&app, &credentials)?;
    Ok(summary(&saved))
}

#[tauri::command]
pub fn delete_browser_password(app: AppHandle, id: String) -> Result<(), String> {
    let mut credentials = read_vault(&app)?;
    let original_len = credentials.len();
    credentials.retain(|credential| credential.id != id);
    if credentials.len() == original_len {
        return Err("找不到指定密码".to_string());
    }
    write_vault(&app, &credentials)
}

#[tauri::command]
pub fn import_browser_passwords(
    app: AppHandle,
    entries: Vec<PasswordImportEntry>,
    source: String,
) -> Result<PasswordImportResult, String> {
    if entries.len() > MAX_CREDENTIALS {
        return Err("单次导入的密码条目过多".to_string());
    }
    let mut credentials = read_vault(&app)?;
    let mut result = PasswordImportResult {
        imported: 0,
        updated: 0,
        skipped: 0,
    };
    let now = now_millis();
    let source = source.trim();

    for entry in entries {
        let origin = match normalized_origin(&entry.origin) {
            Ok(origin) => origin,
            Err(_) => {
                result.skipped += 1;
                continue;
            }
        };
        let username = entry.username.trim().to_string();
        if validate_secret(&username, &entry.password).is_err() {
            result.skipped += 1;
            continue;
        }
        if let Some(existing) = credentials
            .iter_mut()
            .find(|credential| credential.origin == origin && credential.username == username)
        {
            existing.password = entry.password;
            existing.updated_at = now;
            existing.source = if source.is_empty() {
                "浏览器导入".to_string()
            } else {
                source.to_string()
            };
            if let Some(name) = entry
                .name
                .as_deref()
                .map(str::trim)
                .filter(|name| !name.is_empty())
            {
                existing.name = name.to_string();
            }
            result.updated += 1;
            continue;
        }
        if credentials.len() >= MAX_CREDENTIALS {
            result.skipped += 1;
            continue;
        }
        credentials.push(PasswordCredential {
            id: next_credential_id(),
            name: entry
                .name
                .as_deref()
                .map(str::trim)
                .filter(|name| !name.is_empty())
                .unwrap_or(&origin)
                .to_string(),
            origin,
            username,
            password: entry.password,
            source: if source.is_empty() {
                "浏览器导入".to_string()
            } else {
                source.to_string()
            },
            created_at: now,
            updated_at: now,
        });
        result.imported += 1;
    }

    write_vault(&app, &credentials)?;
    Ok(result)
}

#[cfg(windows)]
fn source_origin(
    args: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2WebMessageReceivedEventArgs,
) -> Result<String, String> {
    let mut source = PWSTR::null();
    unsafe { args.Source(&mut source) }.map_err(|error| error.to_string())?;
    normalized_origin(&CoTaskMemPWSTR::from(source).to_string())
}

#[cfg(windows)]
fn post_web_message<T: Serialize>(sender: &ICoreWebView2, message: &T) {
    let Ok(json) = serde_json::to_string(message) else {
        return;
    };
    let wide = json
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let _ = unsafe { sender.PostWebMessageAsJson(PCWSTR::from_raw(wide.as_ptr())) };
}

#[cfg(windows)]
pub fn attach_password_bridge(
    app: &AppHandle,
    webview: &tauri::Webview,
    tab_id: String,
) -> Result<(), String> {
    let bridge_app = app.clone();
    webview
        .with_webview(move |platform_webview| {
            let setup = (|| -> windows::core::Result<()> {
                let core_webview: ICoreWebView2 =
                    unsafe { platform_webview.controller().CoreWebView2()? };
                let handler_app = bridge_app.clone();
                let handler_tab_id = tab_id.clone();
                let handler =
                    WebMessageReceivedEventHandler::create(Box::new(move |sender, args| {
                        let (Some(sender), Some(args)) = (sender, args) else {
                            return Ok(());
                        };
                        let origin = match source_origin(&args) {
                            Ok(origin) => origin,
                            Err(_) => return Ok(()),
                        };
                        let mut raw_message = PWSTR::null();
                        if unsafe { args.WebMessageAsJson(&mut raw_message) }.is_err() {
                            return Ok(());
                        }
                        let raw_message = CoTaskMemPWSTR::from(raw_message).to_string();
                        let Ok(message) = serde_json::from_str::<PasswordWebMessage>(&raw_message)
                        else {
                            return Ok(());
                        };

                        if message.kind == "password-options-query" {
                            let Ok(mut credentials) = read_vault(&handler_app) else {
                                return Ok(());
                            };
                            credentials.retain(|credential| credential.origin == origin);
                            credentials.sort_by(|left, right| {
                                right
                                    .updated_at
                                    .cmp(&left.updated_at)
                                    .then_with(|| left.username.cmp(&right.username))
                            });
                            if !credentials.is_empty() {
                                if let (Some(input_bounds), Some(tab_webview), Some(main_window)) = (
                                    message.input_bounds,
                                    handler_app.get_webview(&crate::browser_label(&handler_tab_id)),
                                    handler_app.get_window("main"),
                                ) {
                                    if let (Ok(webview_position), Ok(scale_factor)) =
                                        (tab_webview.position(), main_window.scale_factor())
                                    {
                                        let visible_credentials =
                                            credentials.iter().take(8).collect::<Vec<_>>();
                                        let items = visible_credentials
                                            .iter()
                                            .map(|credential| {
                                                serde_json::json!({
                                                    "key": format!(
                                                        "password-fill|{}|{}",
                                                        handler_tab_id,
                                                        credential.id
                                                    ),
                                                    "label": if credential.username.is_empty() {
                                                        "未填写用户名"
                                                    } else {
                                                        credential.username.as_str()
                                                    },
                                                    "subtitle": if credential.name.is_empty() {
                                                        credential.origin.as_str()
                                                    } else {
                                                        credential.name.as_str()
                                                    }
                                                })
                                            })
                                            .collect::<Vec<_>>();
                                        let payload = serde_json::json!({
                                            "darkMode": message.dark_mode.unwrap_or(false),
                                            "heading": format!(
                                                "当前站点保存的密码（{}）",
                                                credentials.len()
                                            ),
                                            "items": items
                                        });
                                        let menu_store = handler_app
                                            .state::<crate::floating_windows::BrowserMenuStore>();
                                        let menu_result = crate::floating_windows::show_menu(
                                            &handler_app,
                                            &menu_store,
                                            payload,
                                            "main".to_string(),
                                            crate::floating_windows::FloatingWindowBounds {
                                                x: webview_position.x as f64 / scale_factor
                                                    + input_bounds.x,
                                                y: webview_position.y as f64 / scale_factor
                                                    + input_bounds.y
                                                    + input_bounds.height
                                                    + 6.0,
                                                width: input_bounds.width.clamp(280.0, 380.0),
                                                height: 46.0
                                                    + visible_credentials.len() as f64 * 52.0,
                                            },
                                        );
                                        if menu_result.is_ok() {
                                            return Ok(());
                                        }
                                    }
                                }
                            }
                            let response = PasswordOptionsMessage {
                                kind: "sia-password-options",
                                origin,
                                credentials: credentials
                                    .into_iter()
                                    .take(100)
                                    .map(|credential| PasswordOption {
                                        id: credential.id,
                                        name: credential.name,
                                        username: credential.username,
                                    })
                                    .collect(),
                            };
                            post_web_message(&sender, &response);
                            return Ok(());
                        }

                        if message.kind == "password-fill-request" {
                            let Some(credential_id) = message.credential_id.as_deref() else {
                                return Ok(());
                            };
                            let Ok(credentials) = read_vault(&handler_app) else {
                                return Ok(());
                            };
                            let Some(credential) = credentials.iter().find(|credential| {
                                credential.id == credential_id && credential.origin == origin
                            }) else {
                                return Ok(());
                            };
                            let response = PasswordFillMessage {
                                kind: "sia-password-fill",
                                origin,
                                username: credential.username.clone(),
                                password: credential.password.clone(),
                            };
                            post_web_message(&sender, &response);
                            return Ok(());
                        }

                        if message.kind != "password-submitted" {
                            return Ok(());
                        }
                        let username = message.username.unwrap_or_default().trim().to_string();
                        let password = message.password.unwrap_or_default();
                        if validate_secret(&username, &password).is_err() {
                            return Ok(());
                        }
                        let existing = read_vault(&handler_app).ok().and_then(|credentials| {
                            credentials.into_iter().find(|credential| {
                                credential.origin == origin && credential.username == username
                            })
                        });
                        if existing
                            .as_ref()
                            .is_some_and(|credential| credential.password == password)
                        {
                            return Ok(());
                        }
                        let _ = handler_app.emit(
                            "sia://password-submission",
                            PasswordSubmissionEvent {
                                tab_id: handler_tab_id.clone(),
                                credential_id: existing
                                    .as_ref()
                                    .map(|credential| credential.id.clone()),
                                origin,
                                username,
                                password,
                                is_update: existing.is_some(),
                            },
                        );
                        Ok(())
                    }));
                let mut token = 0;
                unsafe {
                    core_webview.add_WebMessageReceived(&handler, &mut token)?;
                }
                Ok(())
            })();
            if let Err(error) = setup {
                eprintln!("无法初始化密码表单桥接：{error}");
            }
        })
        .map_err(|error| error.to_string())
}

#[cfg(not(windows))]
pub fn attach_password_bridge(
    _app: &AppHandle,
    _webview: &tauri::Webview,
    _tab_id: String,
) -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
pub fn handle_password_menu_action(app: &AppHandle, action: &str) -> Result<bool, String> {
    let Some(value) = action.strip_prefix("password-fill|") else {
        return Ok(false);
    };
    let mut parts = value.splitn(2, '|');
    let tab_id = parts
        .next()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "密码填充缺少标签页标识".to_string())?;
    let credential_id = parts
        .next()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "密码填充缺少密码标识".to_string())?;
    let webview = app
        .get_webview(&crate::browser_label(tab_id))
        .ok_or_else(|| "当前登录页面已关闭".to_string())?;
    let current_origin =
        normalized_origin(webview.url().map_err(|error| error.to_string())?.as_str())?;
    let credential = read_vault(app)?
        .into_iter()
        .find(|entry| entry.id == credential_id && entry.origin == current_origin)
        .ok_or_else(|| "当前站点中找不到所选密码".to_string())?;
    let response = PasswordFillMessage {
        kind: "sia-password-fill",
        origin: current_origin,
        username: credential.username,
        password: credential.password,
    };
    webview
        .with_webview(move |platform_webview| {
            let Ok(core_webview) = (unsafe { platform_webview.controller().CoreWebView2() }) else {
                return;
            };
            post_web_message(&core_webview, &response);
        })
        .map_err(|error| error.to_string())?;
    Ok(true)
}

#[cfg(not(windows))]
pub fn handle_password_menu_action(_app: &AppHandle, action: &str) -> Result<bool, String> {
    Ok(action.starts_with("password-fill|"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_password_origin_without_path() {
        assert_eq!(
            normalized_origin("https://example.com/login?from=test").unwrap(),
            "https://example.com"
        );
        assert_eq!(
            normalized_origin("localhost:8080/login").unwrap(),
            "https://localhost:8080"
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_dpapi_round_trip() {
        let plaintext = b"Sia Browser password vault test";
        let encrypted = protect_vault_data(plaintext).unwrap();
        assert_ne!(encrypted, plaintext);
        assert_eq!(unprotect_vault_data(&encrypted).unwrap(), plaintext);
    }
}
