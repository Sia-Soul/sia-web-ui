use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::{mpsc, Arc, Mutex, OnceLock},
    thread,
    time::{Duration, Instant},
};
use tauri::{path::BaseDirectory, AppHandle, Manager};

const CREDENTIAL_SERVICE: &str = "com.sia.data-studio.connection-password";
const MCP_CREDENTIAL_SERVICE: &str = "com.sia.data-studio.mcp-configuration";
const MCP_RESPONSE_TIMEOUT: Duration = Duration::from_secs(60);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseHostResponse {
    ok: bool,
    data: Option<Value>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CredentialUpdate {
    id: String,
    password: String,
    remember_password: bool,
    #[serde(default)]
    mcp_config: String,
    #[serde(default)]
    remember_mcp_config: bool,
}

/// 前端传入的 stdio MCP 启动配置。
#[derive(Clone, Debug, Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct McpStdioConfig {
    command: String,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    env: HashMap<String, String>,
    tool_name: Option<String>,
}

/// MCP 数据库请求中用于日志和对象树显示的非敏感连接信息。
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct McpConnectionProfile {
    id: String,
    name: String,
    kind: String,
    host: String,
    port: u16,
    database: String,
    username: String,
    connection_mode: Option<String>,
    mcp: Option<McpStdioConfig>,
}

/// Tauri 接收到的 MCP 数据库操作。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct McpDatabaseRequest {
    operation: String,
    profile: McpConnectionProfile,
    #[serde(default)]
    sql: String,
}

/// 一个可跨数据库请求复用的 MCP stdio 子进程。
struct McpSession {
    child: Child,
    stdin: ChildStdin,
    responses: mpsc::Receiver<Value>,
    stderr_lines: Arc<Mutex<Vec<String>>>,
    signature: String,
    tool_name: String,
    next_request_id: u64,
}

impl Drop for McpSession {
    fn drop(&mut self) {
        // MCP 服务器与连接配置同生命周期，释放会话时必须避免遗留 npx/node 子进程。
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

static MCP_SESSIONS: OnceLock<Mutex<HashMap<String, McpSession>>> = OnceLock::new();

/// 返回进程内的 MCP 会话池；相同连接会复用已完成握手的服务器进程。
fn mcp_sessions() -> &'static Mutex<HashMap<String, McpSession>> {
    MCP_SESSIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// 隐去错误文本中 URI 的用户信息，避免数据库口令进入界面日志。
fn redact_uri_credentials(message: &str) -> String {
    let mut output = String::new();
    let mut remaining = message;
    while let Some(scheme_index) = remaining.find("://") {
        let scheme_end = scheme_index + 3;
        output.push_str(&remaining[..scheme_end]);
        let tail = &remaining[scheme_end..];
        let boundary = tail
            .find(|character: char| {
                character.is_whitespace() || matches!(character, '\'' | '"' | ')' | ']')
            })
            .unwrap_or(tail.len());
        let candidate = &tail[..boundary];
        if let Some(at_index) = candidate.rfind('@') {
            output.push_str("***@");
            output.push_str(&candidate[at_index + 1..]);
        } else {
            output.push_str(candidate);
        }
        remaining = &tail[boundary..];
    }
    output.push_str(remaining);
    output
}

/// 创建 MCP 启动命令；Windows 上自动兼容用户常用的 `npx`/`.cmd` 配置写法。
fn mcp_process_command(config: &McpStdioConfig) -> Command {
    #[cfg(target_os = "windows")]
    let mut command = {
        let lower = config.command.to_ascii_lowercase();
        if lower == "npx" || lower.ends_with(".cmd") || lower.ends_with(".bat") {
            let mut shell = Command::new("cmd");
            shell.arg("/d").arg("/s").arg("/c").arg(&config.command);
            shell.args(&config.args);
            shell
        } else {
            let mut direct = Command::new(&config.command);
            direct.args(&config.args);
            direct
        }
    };

    #[cfg(not(target_os = "windows"))]
    let mut command = {
        let mut direct = Command::new(&config.command);
        direct.args(&config.args);
        direct
    };

    command.envs(&config.env);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW 防止桌面应用启动 MCP 服务时弹出额外控制台窗口。
        command.creation_flags(0x0800_0000);
    }
    command
}

impl McpSession {
    /// 启动服务器、完成 MCP 初始化握手并确认 SQL 工具存在。
    fn start(config: &McpStdioConfig) -> Result<Self, String> {
        let signature = serde_json::to_string(config)
            .map_err(|error| format!("MCP 配置序列化失败：{error}"))?;
        let mut child = mcp_process_command(config)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|error| format!("无法启动 MCP 服务器命令“{}”：{error}", config.command))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "无法打开 MCP 服务器标准输入。".to_owned())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "无法读取 MCP 服务器标准输出。".to_owned())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "无法读取 MCP 服务器错误输出。".to_owned())?;

        let (response_sender, responses) = mpsc::channel();
        thread::spawn(move || {
            // MCP stdio 传输约定每行一条 JSON-RPC 消息；通知也会进入同一读取通道。
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if let Ok(message) = serde_json::from_str::<Value>(&line) {
                    if response_sender.send(message).is_err() {
                        break;
                    }
                }
            }
        });

        let stderr_lines = Arc::new(Mutex::new(Vec::new()));
        let stderr_target = Arc::clone(&stderr_lines);
        thread::spawn(move || {
            // 仅保留最近的诊断行，并在保存前清理可能出现的连接 URI 凭据。
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                if let Ok(mut lines) = stderr_target.lock() {
                    lines.push(redact_uri_credentials(&line));
                    if lines.len() > 20 {
                        lines.remove(0);
                    }
                }
            }
        });

        let mut session = Self {
            child,
            stdin,
            responses,
            stderr_lines,
            signature,
            tool_name: config.tool_name.as_deref().unwrap_or("query").to_owned(),
            next_request_id: 1,
        };
        session.request(
            "initialize",
            json!({
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": { "name": "sia-data-studio", "version": env!("CARGO_PKG_VERSION") }
            }),
        )?;
        session.notify("notifications/initialized", json!({}))?;
        let tools = session.request("tools/list", json!({}))?;
        let available = tools
            .get("tools")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(|tool| tool.get("name").and_then(Value::as_str))
            .collect::<Vec<_>>();
        if !available.iter().any(|name| *name == session.tool_name) {
            return Err(format!(
                "MCP 服务器没有提供 SQL 工具“{}”；当前可用工具：{}。",
                session.tool_name,
                if available.is_empty() {
                    "无".to_owned()
                } else {
                    available.join("、")
                }
            ));
        }
        Ok(session)
    }

    /// 发送一条 JSON-RPC 请求并等待相同 id 的响应。
    fn request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        let request_id = self.next_request_id;
        self.next_request_id += 1;
        let message =
            json!({ "jsonrpc": "2.0", "id": request_id, "method": method, "params": params });
        serde_json::to_writer(&mut self.stdin, &message)
            .map_err(|error| format!("MCP 请求序列化失败：{error}"))?;
        self.stdin
            .write_all(b"\n")
            .and_then(|_| self.stdin.flush())
            .map_err(|error| format!("发送 MCP 请求失败：{error}"))?;

        let deadline = Instant::now() + MCP_RESPONSE_TIMEOUT;
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err(format!(
                    "等待 MCP 服务器响应超时。{}",
                    self.stderr_summary()
                ));
            }
            let response = self
                .responses
                .recv_timeout(remaining)
                .map_err(|error| match error {
                    mpsc::RecvTimeoutError::Timeout => {
                        format!("等待 MCP 服务器响应超时。{}", self.stderr_summary())
                    }
                    mpsc::RecvTimeoutError::Disconnected => {
                        format!("MCP 服务器已结束。{}", self.stderr_summary())
                    }
                })?;
            if response.get("id").and_then(Value::as_u64) != Some(request_id) {
                continue;
            }
            if let Some(error) = response.get("error") {
                let message = error
                    .get("message")
                    .and_then(Value::as_str)
                    .unwrap_or("MCP 服务器返回未知错误。");
                return Err(redact_uri_credentials(message));
            }
            return Ok(response.get("result").cloned().unwrap_or(Value::Null));
        }
    }

    /// 发送无需响应的 MCP JSON-RPC 通知。
    fn notify(&mut self, method: &str, params: Value) -> Result<(), String> {
        let message = json!({ "jsonrpc": "2.0", "method": method, "params": params });
        serde_json::to_writer(&mut self.stdin, &message)
            .map_err(|error| format!("MCP 通知序列化失败：{error}"))?;
        self.stdin
            .write_all(b"\n")
            .and_then(|_| self.stdin.flush())
            .map_err(|error| format!("发送 MCP 通知失败：{error}"))
    }

    /// 通过配置的 SQL 工具执行查询。
    fn query(&mut self, sql: &str) -> Result<Value, String> {
        let tool_name = self.tool_name.clone();
        self.request(
            "tools/call",
            json!({ "name": tool_name, "arguments": { "sql": sql } }),
        )
    }

    /// 汇总服务器最近输出的非敏感诊断信息。
    fn stderr_summary(&self) -> String {
        let Ok(lines) = self.stderr_lines.lock() else {
            return String::new();
        };
        if lines.is_empty() {
            String::new()
        } else {
            format!(" MCP 日志：{}", lines.join(" | "))
        }
    }
}

/// 将 MCP 工具返回的 JSON 或文本统一转换为数据库表格行。
fn mcp_result_rows(result: &Value) -> Result<Vec<Value>, String> {
    if result
        .get("isError")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        let message = result
            .get("content")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(|item| item.get("text").and_then(Value::as_str))
            .collect::<Vec<_>>()
            .join("\n");
        return Err(redact_uri_credentials(if message.is_empty() {
            "MCP SQL 工具执行失败。"
        } else {
            &message
        }));
    }

    let structured = result.get("structuredContent").cloned();
    let text_value = result
        .get("content")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .find_map(|item| item.get("text").and_then(Value::as_str))
        .map(|text| {
            serde_json::from_str::<Value>(text).unwrap_or_else(|_| json!({ "message": text }))
        });
    let value = structured.or(text_value).unwrap_or_else(|| json!([]));
    let candidate = value
        .get("rows")
        .or_else(|| value.get("data"))
        .or_else(|| value.get("results"))
        .cloned()
        .unwrap_or(value);
    let rows = match candidate {
        Value::Array(items) => items
            .into_iter()
            .map(|item| {
                if item.is_object() {
                    item
                } else {
                    json!({ "value": item })
                }
            })
            .collect(),
        Value::Null => Vec::new(),
        item if item.is_object() => vec![item],
        item => vec![json!({ "value": item })],
    };
    Ok(rows)
}

/// 跳过 SQL 开头的说明注释，返回第一条实际语句的起始位置。
fn trim_leading_sql_comments(mut sql: &str) -> &str {
    loop {
        sql = sql.trim_start();
        if let Some(comment) = sql.strip_prefix("--") {
            sql = comment.split_once('\n').map(|(_, rest)| rest).unwrap_or("");
        } else if let Some(comment) = sql.strip_prefix("/*") {
            sql = comment.split_once("*/").map(|(_, rest)| rest).unwrap_or("");
        } else {
            return sql;
        }
    }
}

/// 在 Tauri 边界再次校验 MCP SQL，防止堆叠语句绕过停止维护的旧服务只读事务。
fn is_safe_mcp_query(sql: &str) -> bool {
    let normalized = trim_leading_sql_comments(sql).to_ascii_lowercase();
    let read_only = [
        "select", "with", "show", "describe", "desc", "explain", "pragma",
    ]
    .iter()
    .any(|keyword| normalized.starts_with(keyword));
    if !read_only {
        return false;
    }
    if normalized.starts_with("with")
        && ["insert", "update", "delete", "merge"]
            .iter()
            .any(|keyword| {
                normalized
                    .split(|character: char| !character.is_ascii_alphanumeric() && character != '_')
                    .any(|token| token == *keyword)
            })
    {
        return false;
    }

    let bytes = sql.as_bytes();
    let mut index = 0;
    let mut quote = 0_u8;
    let mut dollar_tag: Option<Vec<u8>> = None;
    let mut line_comment = false;
    let mut block_comment = false;
    let mut statement_ended = false;
    while index < bytes.len() {
        let current = bytes[index];
        let next = bytes.get(index + 1).copied().unwrap_or_default();
        if line_comment {
            if current == b'\n' {
                line_comment = false;
            }
            index += 1;
            continue;
        }
        if block_comment {
            if current == b'*' && next == b'/' {
                block_comment = false;
                index += 2;
            } else {
                index += 1;
            }
            continue;
        }
        if let Some(tag) = dollar_tag.as_ref() {
            if bytes[index..].starts_with(tag) {
                index += tag.len();
                dollar_tag = None;
            } else {
                index += 1;
            }
            continue;
        }
        if quote != 0 {
            if current == quote {
                if quote != b']' && next == quote {
                    index += 2;
                    continue;
                }
                quote = 0;
            }
            index += 1;
            continue;
        }
        if current == b'-' && next == b'-' {
            line_comment = true;
            index += 2;
            continue;
        }
        if current == b'/' && next == b'*' {
            block_comment = true;
            index += 2;
            continue;
        }
        if matches!(current, b'\'' | b'"' | b'`' | b'[') {
            if statement_ended {
                return false;
            }
            quote = if current == b'[' { b']' } else { current };
            index += 1;
            continue;
        }
        if current == b'$' {
            if let Some(relative_end) = bytes[index + 1..]
                .iter()
                .position(|character| *character == b'$')
            {
                let tag_end = index + relative_end + 2;
                let tag_body = &bytes[index + 1..tag_end - 1];
                if tag_body
                    .iter()
                    .all(|character| character.is_ascii_alphanumeric() || *character == b'_')
                {
                    if statement_ended {
                        return false;
                    }
                    dollar_tag = Some(bytes[index..tag_end].to_vec());
                    index = tag_end;
                    continue;
                }
            }
        }
        if current == b';' {
            if statement_ended {
                return false;
            }
            statement_ended = true;
            index += 1;
            continue;
        }
        if statement_ended && !current.is_ascii_whitespace() {
            return false;
        }
        index += 1;
    }
    true
}

/// 复用或新建 MCP 会话并执行一次只读数据库请求。
fn run_mcp_database_host(request: Value) -> Result<Value, String> {
    let request: McpDatabaseRequest = serde_json::from_value(request)
        .map_err(|error| format!("MCP 数据库请求格式无效：{error}"))?;
    if request.profile.connection_mode.as_deref() != Some("mcp") {
        return Err("当前请求不是 MCP 连接。".to_owned());
    }
    if !matches!(request.operation.as_str(), "test" | "query") {
        return Err("当前 MCP 数据库连接为只读模式，不支持此操作。".to_owned());
    }
    let config = request
        .profile
        .mcp
        .as_ref()
        .ok_or_else(|| "MCP 启动配置为空，请编辑连接后重试。".to_owned())?;
    if config.command.trim().is_empty() {
        return Err("MCP 启动命令为空。".to_owned());
    }
    let signature =
        serde_json::to_string(config).map_err(|error| format!("MCP 配置序列化失败：{error}"))?;
    let sql = if request.operation == "test" {
        "SELECT 1 AS connection_test"
    } else {
        request.sql.trim()
    };
    if sql.is_empty() {
        return Err("SQL 不能为空。".to_owned());
    }
    if request.operation == "query" && !is_safe_mcp_query(sql) {
        return Err("MCP 只读连接只允许执行一条查询语句。".to_owned());
    }

    let started_at = Utc::now();
    let stopwatch = Instant::now();
    let mut sessions = mcp_sessions()
        .lock()
        .map_err(|_| "MCP 会话池不可用。".to_owned())?;
    let should_restart = sessions
        .get(&request.profile.id)
        .map(|session| session.signature != signature)
        .unwrap_or(false);
    if should_restart {
        sessions.remove(&request.profile.id);
    }
    if !sessions.contains_key(&request.profile.id) {
        sessions.insert(request.profile.id.clone(), McpSession::start(config)?);
    }
    let tool_result = sessions
        .get_mut(&request.profile.id)
        .expect("刚插入的 MCP 会话应当存在")
        .query(sql);
    let tool_result = match tool_result {
        Ok(result) => result,
        Err(error) => {
            // 通信或工具错误后丢弃会话，下次操作会重新握手并恢复。
            sessions.remove(&request.profile.id);
            return Err(error);
        }
    };
    let rows = mcp_result_rows(&tool_result)?;
    let finished_at = Utc::now();
    let duration_ms = stopwatch.elapsed().as_millis() as u64;
    let operation = if request.operation == "test" {
        "ConnectionTest"
    } else {
        "Select"
    };
    let audit = json!({
        "id": format!("mcp-{}-{}", finished_at.timestamp_millis(), std::process::id()),
        "operation": operation,
        "connectionId": request.profile.id,
        "connectionName": request.profile.name,
        "databaseKind": request.profile.kind,
        "host": request.profile.host,
        "port": request.profile.port,
        "database": request.profile.database,
        "username": request.profile.username,
        "sql": sql,
        "highRisk": false,
        "startedAt": started_at.to_rfc3339(),
        "finishedAt": finished_at.to_rfc3339(),
        "durationMs": duration_ms,
        "success": true,
        "returnedRows": rows.len()
    });
    Ok(json!({ "rows": rows, "affectedRows": Value::Null, "audit": audit }))
}

fn database_host_dll() -> PathBuf {
    let configuration = if cfg!(debug_assertions) {
        "Debug"
    } else {
        "Release"
    };
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../src-dotnet/bin")
        .join(configuration)
        .join("net8.0")
        .join("Sia.DataStudio.DatabaseHost.dll")
}

fn database_host_command(app: &tauri::AppHandle) -> Result<Command, String> {
    if !cfg!(debug_assertions) {
        let executable = app
            .path()
            .resolve("database-host.exe", BaseDirectory::Resource)
            .map_err(|error| format!("无法定位 FreeSql 数据库服务：{error}"))?;
        if executable.exists() {
            return Ok(Command::new(executable));
        }
    }

    let host_dll = database_host_dll();
    if host_dll.exists() {
        let mut command = Command::new("dotnet");
        command.arg(host_dll);
        return Ok(command);
    }

    Err(format!(
        "FreeSql 数据库服务尚未构建：{}",
        host_dll.display()
    ))
}

fn run_database_host(app: tauri::AppHandle, mut request: Value) -> Result<Value, String> {
    let storage_path = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法定位数据库工具数据目录：{error}"))?;
    std::fs::create_dir_all(&storage_path)
        .map_err(|error| format!("无法创建数据库工具数据目录：{error}"))?;
    if let Some(object) = request.as_object_mut() {
        object.insert(
            "storagePath".to_owned(),
            Value::String(storage_path.to_string_lossy().into_owned()),
        );
    }

    let mut child = database_host_command(&app)?
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("无法启动 FreeSql 数据库服务：{error}"))?;

    let input =
        serde_json::to_vec(&request).map_err(|error| format!("数据库请求序列化失败：{error}"))?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(&input)
            .and_then(|_| stdin.write_all(b"\n"))
            .map_err(|error| format!("无法发送数据库请求：{error}"))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|error| format!("等待 FreeSql 数据库服务失败：{error}"))?;
    if !output.status.success() && output.stdout.is_empty() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_owned());
    }

    let response: DatabaseHostResponse =
        serde_json::from_slice(&output.stdout).map_err(|error| {
            let details = String::from_utf8_lossy(&output.stderr);
            format!("FreeSql 数据库服务返回了无效结果：{error} {details}")
        })?;
    if response.ok {
        Ok(response.data.unwrap_or(Value::Null))
    } else {
        Err(response
            .error
            .unwrap_or_else(|| "FreeSql 数据库服务执行失败。".to_owned()))
    }
}

#[tauri::command]
async fn database_request(app: tauri::AppHandle, request: Value) -> Result<Value, String> {
    let use_mcp = request
        .pointer("/profile/connectionMode")
        .and_then(Value::as_str)
        .is_some_and(|mode| mode == "mcp")
        && request.get("operation").and_then(Value::as_str) != Some("audit-list");
    tauri::async_runtime::spawn_blocking(move || {
        // MCP 查询由 Tauri 直接维护长连接，其他请求继续交给 FreeSql sidecar。
        if use_mcp {
            run_mcp_database_host(request)
        } else {
            run_database_host(app, request)
        }
    })
    .await
    .map_err(|error| format!("数据库任务异常：{error}"))?
}

#[tauri::command]
fn disconnect_mcp_connection(profile_id: String) -> Result<(), String> {
    // 删除缓存项会触发 McpSession::drop，从而关闭 stdio 和子进程。
    mcp_sessions()
        .lock()
        .map_err(|_| "MCP 会话池不可用。".to_owned())?
        .remove(&profile_id);
    Ok(())
}

fn connection_profiles_file(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join("connections.json"))
}

fn query_workspace_file(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join("query-workspace.json"))
}

fn credential_entry(profile_id: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(CREDENTIAL_SERVICE, profile_id)
        .map_err(|error| format!("无法访问系统安全凭据存储：{error}"))
}

/// 返回用于保存敏感 MCP 参数的独立系统凭据项。
fn mcp_credential_entry(profile_id: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(MCP_CREDENTIAL_SERVICE, profile_id)
        .map_err(|error| format!("无法访问 MCP 系统安全凭据存储：{error}"))
}

fn remembered_profile_ids(profiles: &Value) -> Vec<String> {
    profiles
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|profile| {
            let object = profile.as_object()?;
            if !object
                .get("rememberPassword")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                return None;
            }
            object.get("id").and_then(Value::as_str).map(str::to_owned)
        })
        .collect()
}

#[tauri::command]
fn load_connection_profiles(app: AppHandle) -> Result<Option<Value>, String> {
    let path = connection_profiles_file(&app)?;
    if !path.exists() {
        return Ok(None);
    }

    let content = std::fs::read_to_string(path).map_err(|error| error.to_string())?;
    let mut profiles: Value =
        serde_json::from_str(&content).map_err(|error| format!("连接配置文件格式无效：{error}"))?;

    if let Some(items) = profiles.as_array_mut() {
        for profile in items {
            let Some(object) = profile.as_object_mut() else {
                continue;
            };
            let remember_password = object
                .get("rememberPassword")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let Some(profile_id) = object.get("id").and_then(Value::as_str).map(str::to_owned)
            else {
                continue;
            };

            if remember_password {
                let is_mcp = object.get("connectionMode").and_then(Value::as_str) == Some("mcp");
                if is_mcp {
                    match mcp_credential_entry(&profile_id)?.get_password() {
                        Ok(configuration) => {
                            let value = serde_json::from_str(&configuration).map_err(|error| {
                                format!("连接“{profile_id}”的 MCP 安全配置无效：{error}")
                            })?;
                            object.insert("mcp".to_owned(), value);
                        }
                        Err(keyring::Error::NoEntry) => {
                            object.remove("mcp");
                        }
                        Err(error) => {
                            return Err(format!(
                                "读取连接“{profile_id}”的 MCP 安全配置失败：{error}"
                            ));
                        }
                    }
                } else {
                    match credential_entry(&profile_id)?.get_password() {
                        Ok(password) => {
                            object.insert("password".to_owned(), Value::String(password));
                        }
                        Err(keyring::Error::NoEntry) => {
                            object.insert("password".to_owned(), Value::String(String::new()));
                        }
                        Err(error) => {
                            return Err(format!("读取连接“{profile_id}”的密码失败：{error}"));
                        }
                    }
                }
            }
        }
    }

    Ok(Some(profiles))
}

#[tauri::command]
fn save_connection_profiles(
    app: AppHandle,
    profiles: Value,
    credentials: Vec<CredentialUpdate>,
) -> Result<(), String> {
    let path = connection_profiles_file(&app)?;
    let temporary_path = path.with_extension("json.tmp");
    let content = serde_json::to_vec_pretty(&profiles).map_err(|error| error.to_string())?;

    let previous_profiles = if path.exists() {
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|value| serde_json::from_str::<Value>(&value).ok())
    } else {
        None
    };
    let current_ids = credentials
        .iter()
        .map(|credential| credential.id.as_str())
        .collect::<std::collections::HashSet<_>>();

    if let Some(previous) = previous_profiles {
        for profile_id in remembered_profile_ids(&previous) {
            if !current_ids.contains(profile_id.as_str()) {
                // 连接删除后同时清理两种传输方式可能遗留的系统凭据项。
                if let Err(error) = credential_entry(&profile_id)?.delete_credential() {
                    if !matches!(error, keyring::Error::NoEntry) {
                        return Err(format!("删除连接“{profile_id}”的旧密码失败：{error}"));
                    }
                }
                if let Err(error) = mcp_credential_entry(&profile_id)?.delete_credential() {
                    if !matches!(error, keyring::Error::NoEntry) {
                        return Err(format!("删除连接“{profile_id}”的旧 MCP 配置失败：{error}"));
                    }
                }
            }
        }
    }

    for credential in credentials {
        let entry = credential_entry(&credential.id)?;
        let mcp_entry = mcp_credential_entry(&credential.id)?;
        if credential.remember_password && !credential.remember_mcp_config {
            if !credential.password.is_empty() {
                entry
                    .set_password(&credential.password)
                    .map_err(|error| format!("保存连接“{}”的密码失败：{error}", credential.id))?;
            }
        } else if let Err(error) = entry.delete_credential() {
            if !matches!(error, keyring::Error::NoEntry) {
                return Err(format!("清除连接“{}”的密码失败：{error}", credential.id));
            }
        }

        if credential.remember_mcp_config {
            if !credential.mcp_config.is_empty() {
                mcp_entry
                    .set_password(&credential.mcp_config)
                    .map_err(|error| {
                        format!("保存连接“{}”的 MCP 配置失败：{error}", credential.id)
                    })?;
            }
        } else if let Err(error) = mcp_entry.delete_credential() {
            if !matches!(error, keyring::Error::NoEntry) {
                return Err(format!(
                    "清除连接“{}”的 MCP 配置失败：{error}",
                    credential.id
                ));
            }
        }
    }

    std::fs::write(&temporary_path, content).map_err(|error| error.to_string())?;
    if path.exists() {
        std::fs::remove_file(&path).map_err(|error| error.to_string())?;
    }
    std::fs::rename(&temporary_path, &path).map_err(|error| error.to_string())
}

#[tauri::command]
fn load_query_workspace(app: AppHandle) -> Result<Option<Value>, String> {
    let path = query_workspace_file(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(path).map_err(|error| error.to_string())?;
    let workspace = serde_json::from_str(&content)
        .map_err(|error| format!("查询工作区文件格式无效：{error}"))?;
    Ok(Some(workspace))
}

#[tauri::command]
fn save_query_workspace(app: AppHandle, workspace: Value) -> Result<(), String> {
    let path = query_workspace_file(&app)?;
    let temporary_path = path.with_extension("json.tmp");
    let content = serde_json::to_vec_pretty(&workspace).map_err(|error| error.to_string())?;
    std::fs::write(&temporary_path, content).map_err(|error| error.to_string())?;
    if path.exists() {
        std::fs::remove_file(&path).map_err(|error| error.to_string())?;
    }
    std::fs::rename(&temporary_path, &path).map_err(|error| error.to_string())
}

#[tauri::command]
async fn save_csv_file(suggested_name: String, csv: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let file_name = if suggested_name.to_lowercase().ends_with(".csv") {
            suggested_name
        } else {
            format!("{suggested_name}.csv")
        };
        let Some(mut path) = rfd::FileDialog::new()
            .set_title("导出查询结果")
            .add_filter("CSV 文件", &["csv"])
            .set_file_name(file_name)
            .save_file()
        else {
            return Ok(None);
        };
        if path.extension().is_none() {
            path.set_extension("csv");
        }
        std::fs::write(&path, csv.as_bytes())
            .map_err(|error| format!("保存 CSV 文件失败：{error}"))?;
        Ok(Some(path.to_string_lossy().into_owned()))
    })
    .await
    .map_err(|error| format!("打开文件保存窗口失败：{error}"))?
}

#[tauri::command]
fn data_studio_window_action(app: AppHandle, action: String) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "找不到数据库工具主窗口".to_string())?;

    match action.as_str() {
        "start-dragging" => window.start_dragging(),
        "minimize" => window.minimize(),
        "toggle-maximize" => {
            if window.is_maximized().map_err(|error| error.to_string())? {
                window.unmaximize()
            } else {
                window.maximize()
            }
        }
        "close" => {
            // 主窗口关闭前主动结束所有 MCP stdio 子进程，避免后台残留 node/npx。
            if let Ok(mut sessions) = mcp_sessions().lock() {
                sessions.clear();
            }
            window.close()
        }
        _ => return Err(format!("未知窗口操作：{action}")),
    }
    .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            database_request,
            disconnect_mcp_connection,
            load_connection_profiles,
            save_connection_profiles,
            load_query_workspace,
            save_query_workspace,
            save_csv_file,
            data_studio_window_action
        ])
        .run(tauri::generate_context!())
        .expect("启动 Sia Data Studio 失败");
}

#[cfg(test)]
mod tests {
    use super::{
        credential_entry, is_safe_mcp_query, mcp_result_rows, redact_uri_credentials, McpSession,
        McpStdioConfig,
    };
    use serde_json::json;
    use std::collections::HashMap;

    #[test]
    fn redacts_database_uri_credentials() {
        // 错误信息可以保留主机诊断，但绝不能带出 URI 中的用户名和密码。
        let message =
            redact_uri_credentials("连接 postgresql://reader:secret@example.com:5432/app 失败");
        assert_eq!(message, "连接 postgresql://***@example.com:5432/app 失败");
    }

    #[test]
    fn parses_mcp_text_rows() {
        // 官方 PostgreSQL MCP 服务把查询行作为 content.text 中的 JSON 数组返回。
        let result = json!({
            "content": [{ "type": "text", "text": "[{\"answer\":42}]" }],
            "isError": false
        });
        assert_eq!(
            mcp_result_rows(&result).expect("应能解析 MCP 表格行"),
            vec![json!({ "answer": 42 })]
        );
    }

    #[test]
    fn rejects_stacked_mcp_queries() {
        // 允许字符串中的分号和结尾分号，但拒绝结尾分号之后继续堆叠另一条语句。
        assert!(is_safe_mcp_query("-- 查询\nSELECT 'a;b' AS value;"));
        assert!(!is_safe_mcp_query("SELECT 1; DROP TABLE users"));
        assert!(!is_safe_mcp_query(
            "WITH removed AS (DELETE FROM users RETURNING *) SELECT * FROM removed"
        ));
    }

    #[test]
    fn completes_stdio_handshake_and_query() {
        // 使用无网络、无数据库凭据的 Node 假服务覆盖初始化、工具发现和查询调用链。
        let script = r#"
const readline = require('readline').createInterface({ input: process.stdin });
readline.on('line', line => {
  const request = JSON.parse(line);
  if (request.method === 'initialize') {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'test', version: '1.0.0' } } }) + '\n');
  } else if (request.method === 'tools/list') {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { tools: [{ name: 'query', inputSchema: { type: 'object' } }] } }) + '\n');
  } else if (request.method === 'tools/call') {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { content: [{ type: 'text', text: '[{\"answer\":42}]' }], isError: false } }) + '\n');
  }
});
"#;
        let config = McpStdioConfig {
            command: "node".to_owned(),
            args: vec!["-e".to_owned(), script.to_owned()],
            env: HashMap::new(),
            tool_name: Some("query".to_owned()),
        };
        let mut session = McpSession::start(&config).expect("应能连接 stdio MCP 假服务");
        let result = session
            .query("SELECT 42 AS answer")
            .expect("应能调用 query 工具");
        assert_eq!(
            mcp_result_rows(&result).expect("应能解析查询结果"),
            vec![json!({ "answer": 42 })]
        );
    }

    #[test]
    #[ignore = "显式验证当前操作系统的安全凭据存储"]
    fn credential_store_round_trip() {
        let profile_id = format!("credential-test-{}", std::process::id());
        let entry = credential_entry(&profile_id).expect("应能创建系统凭据项");
        entry
            .set_password("Sia-credential-round-trip")
            .expect("应能保存密码");
        let loaded = entry.get_password();
        let removed = entry.delete_credential();

        assert_eq!(
            loaded.expect("应能读取已保存的密码"),
            "Sia-credential-round-trip"
        );
        removed.expect("应能清理测试凭据");
    }
}
