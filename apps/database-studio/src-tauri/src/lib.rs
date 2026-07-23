use serde::Deserialize;
use serde_json::Value;
use std::{
    io::Write,
    path::PathBuf,
    process::{Command, Stdio},
};
use tauri::{path::BaseDirectory, AppHandle, Manager};

const CREDENTIAL_SERVICE: &str = "com.sia.data-studio.connection-password";

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
    tauri::async_runtime::spawn_blocking(move || run_database_host(app, request))
        .await
        .map_err(|error| format!("FreeSql 数据库任务异常：{error}"))?
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
                if let Err(error) = credential_entry(&profile_id)?.delete_credential() {
                    if !matches!(error, keyring::Error::NoEntry) {
                        return Err(format!("删除连接“{profile_id}”的旧密码失败：{error}"));
                    }
                }
            }
        }
    }

    for credential in credentials {
        let entry = credential_entry(&credential.id)?;
        if credential.remember_password {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            database_request,
            load_connection_profiles,
            save_connection_profiles,
            load_query_workspace,
            save_query_workspace,
            save_csv_file
        ])
        .run(tauri::generate_context!())
        .expect("启动 Sia Data Studio 失败");
}

#[cfg(test)]
mod tests {
    use super::credential_entry;

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
