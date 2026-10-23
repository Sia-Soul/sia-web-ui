//! 保守垃圾清理：后台扫描生成一次性计划，删除时重新验证路径、文件身份及修改时间。
use serde::Serialize;
use std::{
    collections::HashSet,
    fs::{self, File, OpenOptions},
    os::windows::{fs::OpenOptionsExt, io::AsRawHandle},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::{Duration, SystemTime},
};
use tauri::State;
use windows::{
    core::{GUID, PCWSTR},
    Win32::{
        Foundation::HANDLE,
        Storage::FileSystem::{
            FileDispositionInfo, GetFileInformationByHandle, SetFileInformationByHandle,
            BY_HANDLE_FILE_INFORMATION, FILE_DISPOSITION_INFO,
        },
        System::Com::CoTaskMemFree,
        UI::Shell::{
            FOLDERID_LocalAppData, FOLDERID_ProgramData, FOLDERID_Windows, SHEmptyRecycleBinW,
            SHGetKnownFolderPath, SHQueryRecycleBinW, KF_FLAG_DEFAULT, SHERB_NOCONFIRMATION,
            SHERB_NOPROGRESSUI, SHERB_NOSOUND, SHQUERYRBINFO,
        },
    },
};

const MAX_ENTRIES: usize = 20_000;
const TEMP_AGE: Duration = Duration::from_secs(7 * 24 * 3600);

/// 仅由后台生成的显示条目；前端执行清理时只能传回 id，不可传入删除路径。
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    id: usize,
    category: String,
    path: String,
    bytes: u64,
    count: u64,
    reason: String,
    eligible: bool,
    status: String,
}

/// 文件快照包括卷与文件标识，防止同路径文件被替换后仍遭删除。
#[derive(Clone, PartialEq, Debug)]
struct Identity {
    volume: u32,
    index: u64,
    size: u64,
    modified: u64,
    links: u32,
}

/// 白名单规则来自系统已知目录，不读取可由调用方指定的扫描根路径。
#[derive(Clone)]
struct Rule {
    category: &'static str,
    root: PathBuf,
    age: Duration,
    thumbnails: bool,
}
#[derive(Clone)]
struct Candidate {
    entry: Entry,
    rule: Option<Rule>,
    identity: Option<Identity>,
}

/// 进度仅包含轻量统计，避免轮询时反复复制所有文件路径。
#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    busy: bool,
    stage: String,
    visited: usize,
    current_path: String,
}

/// 扫描与执行共用单任务门闩；计划在执行前消耗，不能重复删除。
#[derive(Default)]
struct Inner {
    busy: AtomicBool,
    cancel: AtomicBool,
    plan_id: AtomicU64,
    plan: Mutex<Vec<Candidate>>,
    progress: Mutex<Progress>,
}
#[derive(Default)]
pub struct CleanupRuntime {
    inner: Arc<Inner>,
}

/// 返回可见明细及是否因取消或上限提前结束，不把部分扫描冒充完整扫描。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    entries: Vec<Entry>,
    cancelled: bool,
    limited: bool,
    plan_id: u64,
    free_space_delta: Option<i64>,
}

/// 记录本地卷可用空间；前后净变化受其他程序影响，不等同于已删除文件的逻辑大小。
fn free_space() -> std::collections::HashMap<String, u64> {
    crate::platform_volumes()
        .into_iter()
        .filter(|v| v.drive_type == "本地磁盘" && v.total_bytes > 0)
        .map(|v| (v.path, v.free_bytes))
        .collect()
}

/// 任务退出时（包含错误返回）释放忙状态，保持后续重试可用。
struct Job(Arc<Inner>);
impl Drop for Job {
    fn drop(&mut self) {
        self.0.busy.store(false, Ordering::SeqCst);
    }
}

fn begin(inner: &Arc<Inner>, stage: &str) -> Result<Job, String> {
    inner
        .busy
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .map_err(|_| "已有清理任务正在运行")?;
    inner.cancel.store(false, Ordering::SeqCst);
    *inner.progress.lock().unwrap() = Progress {
        busy: true,
        stage: stage.into(),
        ..Default::default()
    };
    Ok(Job(inner.clone()))
}

/// 从 Windows 获取当前账户的已知文件夹，释放系统分配的字符串。
fn known_folder(id: &GUID) -> Result<PathBuf, String> {
    unsafe {
        let value = SHGetKnownFolderPath(id, KF_FLAG_DEFAULT, None).map_err(|e| e.to_string())?;
        let text = value.to_string().map_err(|e| e.to_string());
        CoTaskMemFree(Some(value.0.cast()));
        text.map(PathBuf::from)
    }
}

fn rules() -> Result<Vec<Rule>, String> {
    let local = known_folder(&FOLDERID_LocalAppData)?;
    let windows = known_folder(&FOLDERID_Windows)?;
    let data = known_folder(&FOLDERID_ProgramData)?;
    Ok(vec![
        Rule {
            category: "temp",
            root: local.join("Temp"),
            age: TEMP_AGE,
            thumbnails: false,
        },
        Rule {
            category: "temp",
            root: windows.join("Temp"),
            age: TEMP_AGE,
            thumbnails: false,
        },
        Rule {
            category: "reports",
            root: local.join("CrashDumps"),
            age: TEMP_AGE,
            thumbnails: false,
        },
        Rule {
            category: "reports",
            root: local.join("Microsoft/Windows/WER"),
            age: TEMP_AGE,
            thumbnails: false,
        },
        Rule {
            category: "reports",
            root: data.join("Microsoft/Windows/WER/ReportArchive"),
            age: TEMP_AGE,
            thumbnails: false,
        },
        Rule {
            category: "reports",
            root: data.join("Microsoft/Windows/WER/ReportQueue"),
            age: TEMP_AGE,
            thumbnails: false,
        },
        Rule {
            category: "thumbnails",
            root: local.join("Microsoft/Windows/Explorer"),
            age: Duration::ZERO,
            thumbnails: true,
        },
    ])
}

/// 禁止跟随重解析点，打开目录时保留句柄阻止重命名、删除及链接替换。
fn pin_ancestors(path: &Path) -> Result<Vec<File>, String> {
    let mut parents: Vec<_> = path.parent().ok_or("路径缺少父目录")?.ancestors().collect();
    parents.reverse();
    let mut pins = Vec::new();
    for parent in parents {
        let file = OpenOptions::new()
            .access_mode(0x80)
            .share_mode(1)
            .custom_flags(0x02200000)
            .open(parent)
            .map_err(|e| e.to_string())?;
        let info = information(&file)?;
        if info.dwFileAttributes & 0x400 != 0 {
            return Err("路径包含链接或重解析点".into());
        }
        pins.push(file);
    }
    Ok(pins)
}

fn information(file: &File) -> Result<BY_HANDLE_FILE_INFORMATION, String> {
    let mut info = BY_HANDLE_FILE_INFORMATION::default();
    unsafe { GetFileInformationByHandle(HANDLE(file.as_raw_handle()), &mut info) }
        .map_err(|e| e.to_string())?;
    Ok(info)
}

fn identity(file: &File) -> Result<Identity, String> {
    let i = information(file)?;
    if i.dwFileAttributes & (0x400 | 0x10) != 0 {
        return Err("不清理目录、链接或重解析点".into());
    }
    Ok(Identity {
        volume: i.dwVolumeSerialNumber,
        index: (u64::from(i.nFileIndexHigh) << 32) | u64::from(i.nFileIndexLow),
        size: (u64::from(i.nFileSizeHigh) << 32) | u64::from(i.nFileSizeLow),
        modified: (u64::from(i.ftLastWriteTime.dwHighDateTime) << 32)
            | u64::from(i.ftLastWriteTime.dwLowDateTime),
        links: i.nNumberOfLinks,
    })
}

/// 缩略图仅匹配 Explorer 直属 thumbcache_*.db；不碰图标缓存和其他数据库。
fn allowed_name(rule: &Rule, path: &Path) -> bool {
    path != rule.root
        && path.starts_with(&rule.root)
        && (!rule.thumbnails
            || (path.parent() == Some(rule.root.as_path())
                && path.file_name().is_some_and(|s| {
                    let s = s.to_string_lossy().to_lowercase();
                    s.starts_with("thumbcache_") && s.ends_with(".db")
                })))
}

fn old_enough(modified: SystemTime, age: Duration) -> bool {
    SystemTime::now()
        .duration_since(modified)
        .is_ok_and(|elapsed| elapsed >= age)
}

fn recycle_info() -> Result<(u64, u64), String> {
    let mut info = SHQUERYRBINFO {
        cbSize: std::mem::size_of::<SHQUERYRBINFO>() as u32,
        ..Default::default()
    };
    unsafe { SHQueryRecycleBinW(PCWSTR::null(), &mut info) }.map_err(|e| e.to_string())?;
    Ok((info.i64Size.max(0) as u64, info.i64NumItems.max(0) as u64))
}

/// 清理使用独占文件句柄及句柄删除，检查后不再按路径重新打开，拒绝修改过的快照。
fn delete_candidate(candidate: &Candidate) -> Result<(), String> {
    let rule = candidate.rule.as_ref().ok_or("缺少白名单规则")?;
    let path = Path::new(&candidate.entry.path);
    if !allowed_name(rule, path) {
        return Err("文件不在清理白名单内".into());
    }
    let _pins = pin_ancestors(path)?;
    let file = OpenOptions::new()
        .access_mode(0x10080)
        .share_mode(0)
        .custom_flags(0x00200000)
        .open(path)
        .map_err(|e| format!("文件被占用、已消失或无权访问：{e}"))?;
    let current = identity(&file)?;
    if candidate.identity.as_ref() != Some(&current) || current.links != 1 {
        return Err("文件已改变或存在硬链接，请重新扫描".into());
    }
    if !old_enough(
        file.metadata()
            .map_err(|e| e.to_string())?
            .modified()
            .map_err(|e| e.to_string())?,
        rule.age,
    ) {
        return Err("文件未达到保留期限".into());
    }
    let disposition = FILE_DISPOSITION_INFO { DeleteFile: true };
    unsafe {
        SetFileInformationByHandle(
            HANDLE(file.as_raw_handle()),
            FileDispositionInfo,
            (&disposition as *const FILE_DISPOSITION_INFO).cast(),
            std::mem::size_of::<FILE_DISPOSITION_INFO>() as u32,
        )
    }
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// 扫描只读取元数据，最多返回两万条；错误与跳过原因也列入明细。
#[tauri::command]
pub async fn scan_cleanup(state: State<'_, CleanupRuntime>) -> Result<Report, String> {
    let inner = state.inner.clone();
    let job = begin(&inner, "扫描")?;
    tauri::async_runtime::spawn_blocking(move || {
        let _job = job;
        inner.plan.lock().unwrap().clear();
        // 每次扫描发放新的计划编号，拒绝旧页面或延迟请求中的条目 id。
        let plan_id = inner.plan_id.fetch_add(1, Ordering::SeqCst) + 1;
        let mut plan = Vec::new();
        let mut limited = false;
        for rule in rules()? {
            if !rule.root.exists() {
                continue;
            }
            let mut stack = vec![rule.root.clone()];
            while let Some(path) = stack.pop() {
                if inner.cancel.load(Ordering::SeqCst) {
                    break;
                }
                if plan.len() >= MAX_ENTRIES {
                    limited = true;
                    break;
                }
                {
                    let mut p = inner.progress.lock().unwrap();
                    p.visited += 1;
                    p.current_path = path.display().to_string();
                }
                let mut candidate = Candidate {
                    entry: Entry {
                        id: plan.len(),
                        category: rule.category.into(),
                        path: path.display().to_string(),
                        bytes: 0,
                        count: 1,
                        reason: String::new(),
                        eligible: false,
                        status: "跳过".into(),
                    },
                    rule: Some(rule.clone()),
                    identity: None,
                };
                let inspected = (|| -> Result<bool, String> {
                    let _pins = pin_ancestors(&path)?;
                    let file = OpenOptions::new()
                        .access_mode(0x80)
                        .share_mode(7)
                        .custom_flags(0x02200000)
                        .open(&path)
                        .map_err(|e| e.to_string())?;
                    let info = information(&file)?;
                    if info.dwFileAttributes & 0x400 != 0 {
                        return Err("链接或重解析点，不跟随扫描".into());
                    }
                    if info.dwFileAttributes & 0x10 != 0 {
                        if rule.thumbnails && path != rule.root {
                            return Ok(false);
                        }
                        for entry in fs::read_dir(&path).map_err(|e| e.to_string())? {
                            if inner.cancel.load(Ordering::SeqCst) {
                                break;
                            }
                            if stack.len() + plan.len() >= MAX_ENTRIES {
                                limited = true;
                                break;
                            }
                            stack.push(entry.map_err(|e| e.to_string())?.path());
                        }
                        return Ok(false);
                    }
                    if !allowed_name(&rule, &path) {
                        return Ok(false);
                    }
                    let id = identity(&file)?;
                    candidate.entry.bytes = id.size;
                    if id.links != 1 {
                        return Err("文件存在硬链接，保守跳过".into());
                    }
                    if !old_enough(
                        file.metadata()
                            .map_err(|e| e.to_string())?
                            .modified()
                            .map_err(|e| e.to_string())?,
                        rule.age,
                    ) {
                        return Err("最近 7 天内修改或时间异常，保留".into());
                    }
                    candidate.identity = Some(id);
                    candidate.entry.eligible = true;
                    candidate.entry.status = "待清理".into();
                    candidate.entry.reason = if rule.thumbnails {
                        "系统缩略图缓存，清理后按需重建"
                    } else {
                        "白名单目录内超过 7 天未修改的文件"
                    }
                    .into();
                    Ok(true)
                })();
                match inspected {
                    Ok(true) => plan.push(candidate),
                    Ok(false) => {}
                    Err(error) => {
                        candidate.entry.reason = error;
                        plan.push(candidate);
                    }
                }
            }
            if limited || inner.cancel.load(Ordering::SeqCst) {
                break;
            }
        }
        if !inner.cancel.load(Ordering::SeqCst) && !limited {
            let mut entry = Entry {
                id: plan.len(),
                category: "recycle".into(),
                path: "Windows 回收站（当前账户，所有磁盘；系统汇总）".into(),
                bytes: 0,
                count: 0,
                reason: "系统接口汇总，不逐项枚举；清空后不能通过回收站恢复".into(),
                eligible: false,
                status: "空".into(),
            };
            match recycle_info() {
                Ok((bytes, count)) => {
                    entry.bytes = bytes;
                    entry.count = count;
                    entry.eligible = count > 0;
                    if count > 0 {
                        entry.status = "待清理".into();
                    }
                }
                Err(error) => {
                    entry.reason = error;
                    entry.status = "跳过".into();
                }
            }
            plan.push(Candidate {
                entry,
                rule: None,
                identity: None,
            });
        }
        let report = Report {
            entries: plan.iter().map(|c| c.entry.clone()).collect(),
            cancelled: inner.cancel.load(Ordering::SeqCst),
            limited,
            plan_id,
            free_space_delta: None,
        };
        *inner.plan.lock().unwrap() = plan;
        Ok(report)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 只执行当前扫描计划内的已选择条目。取消会保留已完成结果，其余条目标为未执行。
#[tauri::command]
pub async fn execute_cleanup(
    state: State<'_, CleanupRuntime>,
    ids: Vec<usize>,
    confirm_recycle: bool,
    plan_id: u64,
) -> Result<Report, String> {
    let inner = state.inner.clone();
    let job = begin(&inner, "清理")?;
    tauri::async_runtime::spawn_blocking(move || {
        let _job = job;
        if inner.plan_id.load(Ordering::SeqCst) != plan_id {
            return Err("扫描计划已失效，请重新扫描".into());
        }
        let selected: HashSet<_> = ids.into_iter().collect();
        let mut plan = inner.plan.lock().unwrap();
        if selected.is_empty()
            || selected
                .iter()
                .any(|id| !plan.iter().any(|c| c.entry.id == *id && c.entry.eligible))
        {
            return Err("选择无效，请重新扫描".into());
        }
        if plan
            .iter()
            .any(|c| selected.contains(&c.entry.id) && c.entry.category == "recycle")
            && !confirm_recycle
        {
            return Err("回收站需要单独确认".into());
        }
        let candidates = std::mem::take(&mut *plan);
        drop(plan);
        let before = free_space();
        let mut entries = Vec::new();
        for candidate in candidates
            .into_iter()
            .filter(|c| selected.contains(&c.entry.id))
        {
            let mut entry = candidate.entry.clone();
            entry.eligible = false;
            if inner.cancel.load(Ordering::SeqCst) {
                entry.status = "未执行".into();
                entry.reason = "用户已停止清理".into();
            } else {
                {
                    let mut p = inner.progress.lock().unwrap();
                    p.visited += 1;
                    p.current_path = entry.path.clone();
                }
                let result = if entry.category == "recycle" {
                    recycle_info().and_then(|current| {
                        if current != (entry.bytes, entry.count) {
                            return Err("回收站内容已变化，请重新扫描确认".into());
                        }
                        // 回收站由系统执行整体清空；调用期间不能中断，停止在下一个条目生效。
                        unsafe {
                            SHEmptyRecycleBinW(
                                None,
                                PCWSTR::null(),
                                SHERB_NOCONFIRMATION | SHERB_NOPROGRESSUI | SHERB_NOSOUND,
                            )
                        }
                        .map_err(|e| e.to_string())
                    })
                } else {
                    delete_candidate(&candidate)
                };
                match result {
                    Ok(()) => {
                        entry.status = "已清理".into();
                        entry.reason = "已永久删除".into();
                    }
                    Err(error) => {
                        entry.status = "失败/跳过".into();
                        entry.reason = error;
                    }
                }
            }
            entries.push(entry);
        }
        let after = free_space();
        let free_space_delta = if before.is_empty()
            || before.keys().any(|key| !after.contains_key(key))
        {
            None
        } else {
            Some(
                before
                    .iter()
                    .map(|(key, value)| i128::from(after[key]) - i128::from(*value))
                    .sum::<i128>()
                    .clamp(i128::from(i64::MIN), i128::from(i64::MAX)) as i64,
            )
        };
        Ok(Report {
            entries,
            cancelled: inner.cancel.load(Ordering::SeqCst),
            limited: false,
            plan_id,
            free_space_delta,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 请求停止当前任务，不撤销此前已删除的文件。
#[tauri::command]
pub fn cancel_cleanup(state: State<'_, CleanupRuntime>) {
    state.inner.cancel.store(true, Ordering::SeqCst);
}

/// 轮询仅返回进度；完整明细由扫描或清理命令一次性返回。
#[tauri::command]
pub fn cleanup_progress(state: State<'_, CleanupRuntime>) -> Progress {
    let mut p = state.inner.progress.lock().unwrap().clone();
    p.busy = state.inner.busy.load(Ordering::SeqCst);
    p
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn retention_keeps_recent_and_future_files() {
        assert!(!old_enough(SystemTime::now(), TEMP_AGE));
        assert!(!old_enough(SystemTime::now() + TEMP_AGE, TEMP_AGE));
        assert!(old_enough(
            SystemTime::now() - TEMP_AGE - Duration::from_secs(2),
            TEMP_AGE
        ));
    }
    #[test]
    fn whitelist_rejects_root_siblings_and_other_databases() {
        let rule = Rule {
            category: "thumbnails",
            root: PathBuf::from(r"C:\test\Explorer"),
            age: Duration::ZERO,
            thumbnails: true,
        };
        assert!(allowed_name(&rule, &rule.root.join("thumbcache_32.db")));
        assert!(!allowed_name(&rule, &rule.root));
        assert!(!allowed_name(&rule, &rule.root.join("iconcache_32.db")));
        assert!(!allowed_name(
            &rule,
            &rule.root.join("sub/thumbcache_32.db")
        ));
        assert!(!allowed_name(
            &rule,
            Path::new(r"C:\test\Explorer-other\thumbcache_32.db")
        ));
    }
    #[test]
    fn jobs_are_exclusive_and_release_on_drop() {
        let inner = Arc::new(Inner::default());
        let first = begin(&inner, "测试").unwrap();
        assert!(begin(&inner, "测试").is_err());
        drop(first);
        assert!(begin(&inner, "测试").is_ok());
    }

    /// 仅在唯一测试目录内验证句柄删除，不调用系统清理扫描或回收站接口。
    #[test]
    fn deletes_only_unchanged_unlocked_fixture() {
        let root = std::env::temp_dir().join(format!(
            "sia-cleanup-test-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&root).unwrap();
        let path = root.join("fixture.tmp");
        fs::write(&path, b"fixture").unwrap();
        let rule = Rule {
            category: "temp",
            root: root.clone(),
            age: Duration::ZERO,
            thumbnails: false,
        };
        let id = identity(&File::open(&path).unwrap()).unwrap();
        let mut candidate = Candidate {
            entry: Entry {
                id: 0,
                category: "temp".into(),
                path: path.display().to_string(),
                bytes: id.size,
                count: 1,
                reason: String::new(),
                eligible: true,
                status: "待清理".into(),
            },
            rule: Some(rule),
            identity: Some(id),
        };
        let held = OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&path)
            .unwrap();
        assert!(delete_candidate(&candidate).is_err());
        drop(held);
        fs::write(&path, b"changed fixture").unwrap();
        assert!(delete_candidate(&candidate).is_err());
        assert!(path.exists());
        candidate.identity = Some(identity(&File::open(&path).unwrap()).unwrap());
        delete_candidate(&candidate).unwrap();
        assert!(!path.exists());
        // 只移除刚创建且已空的测试目录，不递归清理任何真实用户目录。
        fs::remove_dir(&root).unwrap();
    }
}
