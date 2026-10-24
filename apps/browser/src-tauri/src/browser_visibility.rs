//! 只缓存已经成功隐藏的视图，避免每次切页重复调用所有后台 WebView 的原生隐藏接口。
use std::{collections::HashSet, sync::Mutex};

#[derive(Default)]
pub struct BrowserVisibility(Mutex<(u64, HashSet<String>)>);

impl BrowserVisibility {
    /// 未登记的视图按可见处理，确保新建或恢复后的网页不会被漏隐藏。
    pub fn hide_revision(&self, label: &str) -> Result<Option<u64>, String> {
        let state = self.0.lock().map_err(|_| "无法读取网页可见状态")?;
        Ok((!state.1.contains(label)).then_some(state.0))
    }

    /// 仅在原生隐藏成功后记录；调用原生接口期间不得持有此锁，避免消息泵重入死锁。
    pub fn mark_hidden(&self, label: &str, revision: u64) -> Result<(), String> {
        let mut state = self.0.lock().map_err(|_| "无法记录网页隐藏状态")?;
        // 原生调用可能泵送消息；期间若有显示请求，不缓存过期的隐藏结果。
        if state.0 == revision {
            state.1.insert(label.to_string());
        }
        Ok(())
    }

    /// 显示、创建或销毁前清除缓存；即使操作失败，下次也会保守地重新隐藏。
    pub fn mark_visible(&self, label: &str) -> Result<(), String> {
        let mut state = self.0.lock().map_err(|_| "无法清除网页隐藏状态")?;
        state.0 = state.0.wrapping_add(1);
        state.1.remove(label);
        Ok(())
    }
}
