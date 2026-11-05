//! ChooseBox 的只读目录桥接：只列举元信息，不读取文件正文或执行文件。
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
pub struct Entry {
    id: String,
    name: String,
    kind: &'static str,
    path: String,
}

fn entry(path: &Path, name: String, directory: bool) -> Entry {
    let path = path.to_string_lossy().into_owned();
    Entry { id: path.clone(), name, kind: if directory { "directory" } else { "file" }, path }
}

/// 列出本机常用目录及盘符，不在 UI 线程中探测磁盘。
#[tauri::command]
pub async fn choose_box_roots() -> Result<Vec<Entry>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut paths = Vec::<PathBuf>::new();
        if let Some(home) = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")) {
            let home = PathBuf::from(home);
            for name in ["Desktop", "Downloads", "Documents", "Pictures", "Music", "Videos"] {
                let path = home.join(name);
                if path.is_dir() { paths.push(path); }
            }
            if home.is_dir() { paths.push(home); }
        }
        #[cfg(target_os = "windows")]
        for letter in b'A'..=b'Z' {
            let path = PathBuf::from(format!("{}:\\", letter as char));
            if path.is_dir() { paths.push(path); }
        }
        #[cfg(not(target_os = "windows"))]
        paths.push(PathBuf::from("/"));
        paths.into_iter().map(|path| {
            let name = path.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_else(|| path.display().to_string());
            entry(&path, name, true)
        }).collect()
    }).await.map_err(|error| error.to_string())
}

/// 只读取绝对目录的直接子项；忽略符号链接，避免把链接当作可递归的目录。
fn read_directory(path: &str) -> Result<Vec<Entry>, String> {
    let directory = Path::new(path);
    if !directory.is_absolute() || !directory.is_dir() { return Err("请选择有效的绝对目录路径".into()); }
    let entries = std::fs::read_dir(directory).map_err(|error| format!("无法读取目录：{error}"))?;
    let mut result = Vec::new();
    for item in entries {
        let item = item.map_err(|error| format!("无法读取目录项：{error}"))?;
        let kind = item.file_type().map_err(|error| error.to_string())?;
        if kind.is_symlink() || !(kind.is_dir() || kind.is_file()) { continue; }
        result.push(entry(&item.path(), item.file_name().to_string_lossy().into_owned(), kind.is_dir()));
    }
    Ok(result)
}

/// 文件系统操作在线程池中执行，避免大目录阻塞窗口事件处理。
#[tauri::command]
pub async fn choose_box_read_directory(path: String) -> Result<Vec<Entry>, String> {
    tauri::async_runtime::spawn_blocking(move || read_directory(&path)).await.map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn lists_files_and_empty_directories_without_reading_contents() {
        let path = std::env::temp_dir().join(format!("sia-choose-box-{}", std::process::id()));
        std::fs::create_dir_all(path.join("空目录")).unwrap();
        std::fs::write(path.join("中文.txt"), "内容").unwrap();
        let entries = read_directory(path.to_str().unwrap()).unwrap();
        assert!(entries.iter().any(|item| item.name == "空目录" && item.kind == "directory"));
        assert!(entries.iter().any(|item| item.name == "中文.txt" && item.kind == "file"));
        assert!(read_directory("relative-path").is_err());
        std::fs::remove_dir_all(path).unwrap();
    }
}
