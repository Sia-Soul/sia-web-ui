//! 下载身份在重启之间保持唯一；开始时间在源头生成，进度、完成和跨窗重放共用。
use std::{sync::atomic::{AtomicU64, Ordering}, time::{SystemTime, UNIX_EPOCH}};

static LAST_STARTED_AT: AtomicU64 = AtomicU64::new(0);

/// 生成带版本的下载身份；同毫秒触发使用递增毫秒排序，GUID 防止跨进程或重启后覆盖历史。
pub fn new_download_id() -> windows::core::Result<String> {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
    let previous = LAST_STARTED_AT.fetch_update(Ordering::SeqCst, Ordering::SeqCst, |last| Some(now.max(last + 1))).unwrap();
    let started_at = now.max(previous + 1);
    let unique = unsafe { windows::Win32::System::Com::CoCreateGuid()? };
    Ok(format!("download-v2-{started_at}-{unique:?}"))
}

/// 读取身份中固定的开始时间（Unix 毫秒）；旧版纯编号无时间信息，返回 None。
pub fn started_at(id: &str) -> Option<u64> {
    let (time, _) = id.strip_prefix("download-v2-")?.split_once('-')?;
    time.parse::<u64>().ok().filter(|time| *time > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_downloads_are_unique_and_have_stable_increasing_start_times() {
        let first = new_download_id().unwrap();
        let second = new_download_id().unwrap();
        assert_ne!(first, second);
        assert_ne!(first, "download-1");
        let time = started_at(&first).unwrap();
        assert!(time > 1_000_000_000_000);
        assert!(started_at(&second).unwrap() > time);
        // 完成及重放事件只读取同一个身份，不生成新的排序时间。
        assert_eq!(started_at(&first), Some(time));
        assert_eq!(started_at("download-1"), None);
    }
}
