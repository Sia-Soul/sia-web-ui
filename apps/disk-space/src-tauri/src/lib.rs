use serde::Serialize;
// 清理模块独立保存扫描快照，避免与空间探测的数据或取消状态混用。
#[cfg(windows)]
mod cleanup;
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager, State};

const SCAN_EVENT: &str = "sia://disk-scan";
const EMIT_INTERVAL: Duration = Duration::from_millis(60);
const MAX_PENDING_NODES: usize = 320;

#[cfg(windows)]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    metadata.file_attributes() & 0x400 != 0
}

#[cfg(not(windows))]
fn is_reparse_point(_metadata: &fs::Metadata) -> bool {
    false
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiskVolume {
    path: String,
    name: String,
    file_system: String,
    drive_type: String,
    total_bytes: u64,
    free_bytes: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanNodeUpdate {
    id: u64,
    parent_id: Option<u64>,
    name: String,
    path: String,
    kind: &'static str,
    size: u64,
    completed: bool,
    unreadable: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SkippedEntry {
    id: u64,
    path: String,
    kind: &'static str,
    reason: String,
    permission_denied: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanBatch {
    scan_id: u64,
    phase: &'static str,
    root_path: String,
    nodes: Vec<ScanNodeUpdate>,
    processed_files: u64,
    processed_directories: u64,
    scanned_bytes: u64,
    errors: u64,
    skipped: Vec<SkippedEntry>,
    current_path: Option<String>,
    message: Option<String>,
}

struct ScanRuntime {
    next_scan_id: AtomicU64,
    active_scan_id: Arc<AtomicU64>,
}

impl Default for ScanRuntime {
    fn default() -> Self {
        Self {
            next_scan_id: AtomicU64::new(1),
            active_scan_id: Arc::new(AtomicU64::new(0)),
        }
    }
}

struct DirectoryScanner {
    app: AppHandle,
    active_scan_id: Arc<AtomicU64>,
    scan_id: u64,
    root_path: String,
    next_node_id: u64,
    next_skipped_id: u64,
    directories: HashMap<u64, ScanNodeUpdate>,
    pending: HashMap<u64, ScanNodeUpdate>,
    pending_skipped: Vec<SkippedEntry>,
    processed_files: u64,
    processed_directories: u64,
    scanned_bytes: u64,
    errors: u64,
    current_path: Option<String>,
    last_emit: Instant,
}

impl DirectoryScanner {
    fn new(
        app: AppHandle,
        active_scan_id: Arc<AtomicU64>,
        scan_id: u64,
        root_path: String,
    ) -> Self {
        Self {
            app,
            active_scan_id,
            scan_id,
            root_path,
            next_node_id: 1,
            next_skipped_id: 1,
            directories: HashMap::new(),
            pending: HashMap::new(),
            pending_skipped: Vec::new(),
            processed_files: 0,
            processed_directories: 0,
            scanned_bytes: 0,
            errors: 0,
            current_path: None,
            last_emit: Instant::now(),
        }
    }

    fn is_cancelled(&self) -> bool {
        self.active_scan_id.load(Ordering::Acquire) != self.scan_id
    }

    fn next_id(&mut self) -> u64 {
        let id = self.next_node_id;
        self.next_node_id = self.next_node_id.saturating_add(1);
        id
    }

    fn queue(&mut self, node: ScanNodeUpdate) {
        self.pending.insert(node.id, node);
    }

    fn record_skip(
        &mut self,
        path: &Path,
        kind: &'static str,
        context: &str,
        error: &std::io::Error,
    ) {
        let id = self.next_skipped_id;
        self.next_skipped_id = self.next_skipped_id.saturating_add(1);
        self.errors = self.errors.saturating_add(1);
        self.pending_skipped.push(SkippedEntry {
            id,
            path: path.to_string_lossy().into_owned(),
            kind,
            reason: format!("{context}：{error}"),
            permission_denied: error.kind() == std::io::ErrorKind::PermissionDenied,
        });
    }

    fn update_directory<F>(&mut self, id: u64, update: F)
    where
        F: FnOnce(&mut ScanNodeUpdate),
    {
        if let Some(directory) = self.directories.get_mut(&id) {
            update(directory);
            self.pending.insert(id, directory.clone());
        }
    }

    fn emit(&mut self, phase: &'static str, message: Option<String>, force: bool) {
        if !force
            && self.pending.len() < MAX_PENDING_NODES
            && self.last_emit.elapsed() < EMIT_INTERVAL
        {
            return;
        }
        if phase == "scanning" && self.is_cancelled() {
            return;
        }
        let mut nodes = self
            .pending
            .drain()
            .map(|(_, node)| node)
            .collect::<Vec<_>>();
        nodes.sort_unstable_by_key(|node| node.id);
        let event = ScanBatch {
            scan_id: self.scan_id,
            phase,
            root_path: self.root_path.clone(),
            nodes,
            processed_files: self.processed_files,
            processed_directories: self.processed_directories,
            scanned_bytes: self.scanned_bytes,
            errors: self.errors,
            skipped: self.pending_skipped.drain(..).collect(),
            current_path: self.current_path.clone(),
            message,
        };
        let _ = self.app.emit(SCAN_EVENT, event);
        self.last_emit = Instant::now();
    }

    fn mark_ancestors(&mut self, ancestors: &[u64], size: u64) {
        for id in ancestors {
            self.update_directory(*id, |directory| {
                directory.size = directory.size.saturating_add(size);
            });
        }
    }

    fn scan_directory(&mut self, path: &Path, directory_id: u64, ancestors: &mut Vec<u64>) {
        if self.is_cancelled() {
            return;
        }
        self.current_path = Some(path.to_string_lossy().into_owned());
        let entries = match fs::read_dir(path) {
            Ok(entries) => entries,
            Err(error) => {
                self.record_skip(path, "directory", "无法读取目录", &error);
                self.update_directory(directory_id, |directory| {
                    directory.completed = true;
                    directory.unreadable = true;
                });
                self.emit(
                    "scanning",
                    Some(format!("无法读取目录 {}：{error}", path.display())),
                    false,
                );
                return;
            }
        };

        for entry_result in entries {
            if self.is_cancelled() {
                return;
            }
            let entry = match entry_result {
                Ok(entry) => entry,
                Err(error) => {
                    self.record_skip(path, "unknown", "无法读取目录项", &error);
                    continue;
                }
            };
            let child_path = entry.path();
            self.current_path = Some(child_path.to_string_lossy().into_owned());
            let name = entry.file_name().to_string_lossy().into_owned();
            let metadata = match fs::symlink_metadata(&child_path) {
                Ok(metadata) => metadata,
                Err(error) => {
                    self.record_skip(&child_path, "unknown", "无法读取文件或文件夹信息", &error);
                    continue;
                }
            };

            if metadata.file_type().is_dir()
                && !metadata.file_type().is_symlink()
                && !is_reparse_point(&metadata)
            {
                let id = self.next_id();
                let directory = ScanNodeUpdate {
                    id,
                    parent_id: Some(directory_id),
                    name,
                    path: child_path.to_string_lossy().into_owned(),
                    kind: "directory",
                    size: 0,
                    completed: false,
                    unreadable: false,
                };
                self.processed_directories = self.processed_directories.saturating_add(1);
                self.directories.insert(id, directory.clone());
                self.queue(directory);
                self.emit("scanning", None, false);

                ancestors.push(id);
                self.scan_directory(&child_path, id, ancestors);
                ancestors.pop();
                if self.is_cancelled() {
                    return;
                }
                self.update_directory(id, |node| node.completed = true);
                self.emit("scanning", None, false);
            } else {
                let id = self.next_id();
                let size = metadata.len();
                let node = ScanNodeUpdate {
                    id,
                    parent_id: Some(directory_id),
                    name,
                    path: child_path.to_string_lossy().into_owned(),
                    kind: "file",
                    size,
                    completed: true,
                    unreadable: false,
                };
                self.processed_files = self.processed_files.saturating_add(1);
                self.scanned_bytes = self.scanned_bytes.saturating_add(size);
                self.mark_ancestors(ancestors, size);
                self.queue(node);
                self.emit("scanning", None, false);
            }
        }

        self.update_directory(directory_id, |directory| directory.completed = true);
    }

    fn run(mut self, root: PathBuf) {
        let root_id = self.next_id();
        let root_name = root
            .file_name()
            .filter(|name| !name.is_empty())
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| self.root_path.clone());
        let root_node = ScanNodeUpdate {
            id: root_id,
            parent_id: None,
            name: root_name,
            path: self.root_path.clone(),
            kind: "directory",
            size: 0,
            completed: false,
            unreadable: false,
        };
        self.processed_directories = 1;
        self.directories.insert(root_id, root_node.clone());
        self.queue(root_node);
        self.emit("started", None, true);

        let mut ancestors = vec![root_id];
        self.scan_directory(&root, root_id, &mut ancestors);
        if self.is_cancelled() {
            self.emit("cancelled", None, true);
            return;
        }

        self.update_directory(root_id, |directory| directory.completed = true);
        self.emit("completed", None, true);
        let _ = self.active_scan_id.compare_exchange(
            self.scan_id,
            0,
            Ordering::AcqRel,
            Ordering::Acquire,
        );
    }
}

#[cfg(windows)]
fn platform_volumes() -> Vec<DiskVolume> {
    use windows::{
        core::PCWSTR,
        Win32::Storage::FileSystem::{
            GetDiskFreeSpaceExW, GetDriveTypeW, GetLogicalDriveStringsW, GetVolumeInformationW,
        },
    };

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn string_from_buffer(buffer: &[u16]) -> String {
        let end = buffer
            .iter()
            .position(|value| *value == 0)
            .unwrap_or(buffer.len());
        String::from_utf16_lossy(&buffer[..end])
    }

    let required = unsafe { GetLogicalDriveStringsW(None) };
    if required == 0 {
        return Vec::new();
    }
    let mut buffer = vec![0_u16; required as usize + 1];
    let length = unsafe { GetLogicalDriveStringsW(Some(&mut buffer)) } as usize;
    let mut result = Vec::new();
    let mut start = 0;

    while start < length {
        let relative_end = buffer[start..length]
            .iter()
            .position(|value| *value == 0)
            .unwrap_or(length - start);
        let end = start + relative_end;
        if end == start {
            break;
        }
        let path = String::from_utf16_lossy(&buffer[start..end]);
        start = end + 1;
        let path_wide = wide(&path);
        let drive_type_code = unsafe { GetDriveTypeW(PCWSTR(path_wide.as_ptr())) };
        if drive_type_code <= 1 {
            continue;
        }

        let mut free_to_caller = 0_u64;
        let mut total_bytes = 0_u64;
        let mut total_free_bytes = 0_u64;
        let has_space = unsafe {
            GetDiskFreeSpaceExW(
                PCWSTR(path_wide.as_ptr()),
                Some(&mut free_to_caller),
                Some(&mut total_bytes),
                Some(&mut total_free_bytes),
            )
            .is_ok()
        };
        let mut volume_name = vec![0_u16; 128];
        let mut file_system = vec![0_u16; 64];
        let _ = unsafe {
            GetVolumeInformationW(
                PCWSTR(path_wide.as_ptr()),
                Some(&mut volume_name),
                None,
                None,
                None,
                Some(&mut file_system),
            )
        };
        let name = string_from_buffer(&volume_name);
        let drive_type = match drive_type_code {
            2 => "可移动磁盘",
            3 => "本地磁盘",
            4 => "网络磁盘",
            5 => "光盘驱动器",
            6 => "内存磁盘",
            _ => "磁盘",
        };
        result.push(DiskVolume {
            path,
            name: if name.is_empty() {
                drive_type.to_string()
            } else {
                name
            },
            file_system: string_from_buffer(&file_system),
            drive_type: drive_type.to_string(),
            total_bytes: if has_space { total_bytes } else { 0 },
            free_bytes: if has_space {
                free_to_caller
            } else {
                total_free_bytes
            },
        });
    }
    result.sort_by(|left, right| left.path.cmp(&right.path));
    result
}

#[cfg(not(windows))]
fn platform_volumes() -> Vec<DiskVolume> {
    vec![DiskVolume {
        path: "/".to_string(),
        name: "根目录".to_string(),
        file_system: String::new(),
        drive_type: "本地磁盘".to_string(),
        total_bytes: 0,
        free_bytes: 0,
    }]
}

#[tauri::command]
fn list_volumes() -> Vec<DiskVolume> {
    platform_volumes()
}

#[tauri::command]
async fn choose_directory(initial_path: Option<String>) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = rfd::FileDialog::new().set_title("选择需要探测的目录");
        if let Some(path) = initial_path.filter(|path| !path.trim().is_empty()) {
            let path = PathBuf::from(path);
            if path.exists() {
                dialog = dialog.set_directory(path);
            }
        }
        Ok(dialog
            .pick_folder()
            .map(|path| path.to_string_lossy().into_owned()))
    })
    .await
    .map_err(|error| format!("打开目录选择窗口失败：{error}"))?
}

#[tauri::command]
fn start_scan(
    app: AppHandle,
    runtime: State<'_, ScanRuntime>,
    path: String,
) -> Result<u64, String> {
    if path.trim().is_empty() {
        return Err("扫描路径不能为空".to_string());
    }
    let root = PathBuf::from(&path);
    let metadata = fs::metadata(&root)
        .map_err(|error| format!("无法访问扫描路径 {}：{error}", root.display()))?;
    if !metadata.is_dir() {
        return Err("请选择磁盘或文件夹，而不是单个文件".to_string());
    }

    let scan_id = runtime.next_scan_id.fetch_add(1, Ordering::AcqRel);
    runtime.active_scan_id.store(scan_id, Ordering::Release);
    let active_scan_id = runtime.active_scan_id.clone();
    std::thread::Builder::new()
        .name(format!("sia-disk-scan-{scan_id}"))
        .spawn(move || {
            DirectoryScanner::new(app, active_scan_id, scan_id, path).run(root);
        })
        .map_err(|error| format!("无法启动扫描线程：{error}"))?;
    Ok(scan_id)
}

#[tauri::command]
fn cancel_scan(runtime: State<'_, ScanRuntime>, scan_id: u64) -> bool {
    runtime
        .active_scan_id
        .compare_exchange(scan_id, 0, Ordering::AcqRel, Ordering::Acquire)
        .is_ok()
}

#[tauri::command]
fn disk_space_window_action(app: AppHandle, action: String) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "找不到磁盘空间探测器主窗口".to_string())?;

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
        "close" => window.close(),
        _ => return Err(format!("未知窗口操作：{action}")),
    }
    .map_err(|error| error.to_string())
}

#[cfg(windows)]
fn open_disk_entry(path: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::{
        core::{w, PCWSTR},
        Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL},
    };

    let wide_path = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let result = unsafe {
        ShellExecuteW(
            None,
            w!("open"),
            PCWSTR(wide_path.as_ptr()),
            PCWSTR::null(),
            PCWSTR::null(),
            SW_SHOWNORMAL,
        )
    };
    if result.0 as isize <= 32 {
        Err(format!("系统无法打开 {}", path.display()))
    } else {
        Ok(())
    }
}

#[cfg(windows)]
fn reveal_disk_entry(path: &Path) -> Result<(), String> {
    std::process::Command::new("explorer.exe")
        .arg(format!("/select,{}", path.display()))
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("无法在资源管理器中定位 {}：{error}", path.display()))
}

#[cfg(windows)]
fn show_disk_entry_properties(path: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::{
        core::PCWSTR,
        Win32::UI::Shell::{SHObjectProperties, SHOP_FILEPATH},
    };

    let wide_path = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let shown = unsafe {
        SHObjectProperties(
            None,
            SHOP_FILEPATH,
            PCWSTR(wide_path.as_ptr()),
            PCWSTR::null(),
        )
    };
    if shown.as_bool() {
        Ok(())
    } else {
        Err(format!("无法显示 {} 的属性", path.display()))
    }
}

#[cfg(not(windows))]
fn open_disk_entry(_path: &Path) -> Result<(), String> {
    Err("当前平台暂不支持打开文件".to_string())
}

#[cfg(not(windows))]
fn reveal_disk_entry(_path: &Path) -> Result<(), String> {
    Err("当前平台暂不支持在文件管理器中定位".to_string())
}

#[cfg(not(windows))]
fn show_disk_entry_properties(_path: &Path) -> Result<(), String> {
    Err("当前平台暂不支持文件属性窗口".to_string())
}

#[tauri::command]
fn disk_entry_action(action: String, path: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Err(format!("文件或文件夹已不存在：{}", path.display()));
    }
    match action.as_str() {
        "open" => open_disk_entry(&path),
        "reveal" => reveal_disk_entry(&path),
        "properties" => show_disk_entry_properties(&path),
        _ => Err(format!("未知文件操作：{action}")),
    }
}

pub fn run() {
    let builder = tauri::Builder::default().manage(ScanRuntime::default());
    // Windows 清理接口不影响其他平台已有的空间探测能力。
    #[cfg(windows)]
    let builder = builder
        .manage(cleanup::CleanupRuntime::default())
        .invoke_handler(tauri::generate_handler![
            list_volumes,
            choose_directory,
            start_scan,
            cancel_scan,
            disk_space_window_action,
            disk_entry_action,
            cleanup::scan_cleanup,
            cleanup::execute_cleanup,
            cleanup::cancel_cleanup,
            cleanup::cleanup_progress
        ]);
    #[cfg(not(windows))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        list_volumes, choose_directory, start_scan, cancel_scan,
        disk_space_window_action, disk_entry_action
    ]);
    builder.run(tauri::generate_context!())
        .expect("启动 Sia 磁盘空间探测器失败");
}
