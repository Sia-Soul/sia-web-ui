//! 检测当前用户的浏览器配置并只读导入收藏，不修改来源浏览器的数据。
use serde::Serialize;
use serde_json::Value;
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkSource {
    /// 当前扫描中的来源标识；导入时重新扫描校验，不接受任意文件路径。
    pub id: String,
    pub browser: String,
    pub profile: String,
    #[serde(skip)]
    path: PathBuf,
    #[serde(skip)]
    firefox: bool,
}

#[derive(Debug, Serialize)]
pub struct ImportedBookmark {
    pub title: String,
    /// 有 URL 表示收藏；没有 URL 表示文件夹。
    pub url: Option<String>,
    pub children: Vec<ImportedBookmark>,
}

/// 在后台扫描本机常见浏览器的多个配置目录，不读取收藏内容。
#[tauri::command]
pub async fn list_bookmark_sources() -> Result<Vec<BookmarkSource>, String> {
    tauri::async_runtime::spawn_blocking(scan_sources)
        .await
        .map_err(|e| e.to_string())
}

/// 只读解析选定来源，保留文件夹及顺序；文件被锁定、损坏或超过限制时返回可展示的错误。
#[tauri::command]
pub async fn read_browser_bookmarks(source_id: String) -> Result<Vec<ImportedBookmark>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let source = scan_sources()
            .into_iter()
            .find(|s| s.id == source_id)
            .ok_or("来源已不存在，请重新检测浏览器")?;
        if source.firefox {
            read_firefox(&source.path)
        } else {
            read_chromium(&source.path)
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

fn scan_sources() -> Vec<BookmarkSource> {
    let local = std::env::var_os("LOCALAPPDATA").map(PathBuf::from);
    let roaming = std::env::var_os("APPDATA").map(PathBuf::from);
    let mut sources = Vec::new();
    // 标准用户数据目录与安装目录独立；保留可读取的配置，支持同一浏览器多个账号。
    if let Some(local) = local {
        for (name, relative) in [
            ("Microsoft Edge", "Microsoft/Edge/User Data"),
            ("Google Chrome", "Google/Chrome/User Data"),
            ("Brave", "BraveSoftware/Brave-Browser/User Data"),
            ("Vivaldi", "Vivaldi/User Data"),
            ("Chromium", "Chromium/User Data"),
            ("QQ 浏览器", "Tencent/QQBrowser/User Data"),
            ("360 极速浏览器", "360Chrome/Chrome/User Data"),
        ] {
            scan_chromium(name, &local.join(relative), &mut sources);
        }
    }
    if let Some(roaming) = roaming {
        scan_chromium(
            "360 安全浏览器",
            &roaming.join("360se6/User Data"),
            &mut sources,
        );
        for (name, relative) in [
            ("Opera", "Opera Software/Opera Stable"),
            ("Opera GX", "Opera Software/Opera GX Stable"),
        ] {
            scan_chromium(name, &roaming.join(relative), &mut sources);
        }
        let firefox = roaming.join("Mozilla/Firefox");
        if let Ok(ini) = std::fs::read_to_string(firefox.join("profiles.ini")) {
            for section in ini
                .split('[')
                .filter(|section| section.starts_with("Profile"))
            {
                let fields: HashMap<_, _> = section
                    .lines()
                    .filter_map(|line| line.trim().split_once('='))
                    .collect();
                if let Some(path) = fields.get("Path") {
                    let path = if fields.get("IsRelative") == Some(&"0") {
                        PathBuf::from(path)
                    } else {
                        firefox.join(path)
                    };
                    add_source(
                        &mut sources,
                        "Mozilla Firefox",
                        fields.get("Name").copied().unwrap_or("默认配置"),
                        path.join("places.sqlite"),
                        true,
                    );
                }
            }
        }
    }
    sources.sort_by(|a, b| (&a.browser, &a.profile).cmp(&(&b.browser, &b.profile)));
    sources
}

fn add_source(
    sources: &mut Vec<BookmarkSource>,
    browser: &str,
    profile: &str,
    path: PathBuf,
    firefox: bool,
) {
    if !path.is_file() || sources.iter().any(|source| source.path == path) {
        return;
    }
    sources.push(BookmarkSource {
        id: format!("{browser}|{}", path.to_string_lossy()),
        browser: browser.into(),
        profile: profile.into(),
        path,
        firefox,
    });
}

fn scan_chromium(browser: &str, root: &Path, sources: &mut Vec<BookmarkSource>) {
    let state: Value = std::fs::read(root.join("Local State"))
        .ok()
        .and_then(|data| serde_json::from_slice(&data).ok())
        .unwrap_or(Value::Null);
    add_source(sources, browser, "默认配置", root.join("Bookmarks"), false);
    if let Ok(dirs) = std::fs::read_dir(root) {
        for dir in dirs.flatten() {
            let name = dir.file_name().to_string_lossy().into_owned();
            // 仅枚举一层用户配置，不递归遍历缓存或访问配置中的链接目录。
            if !dir.file_type().map(|kind| kind.is_dir()).unwrap_or(false) {
                continue;
            }
            let label = state["profile"]["info_cache"][&name]["name"]
                .as_str()
                .unwrap_or(&name);
            add_source(
                sources,
                browser,
                &format!("{label} ({name})"),
                dir.path().join("Bookmarks"),
                false,
            );
        }
    }
}

fn read_chromium(path: &Path) -> Result<Vec<ImportedBookmark>, String> {
    use std::io::Read;
    let file =
        std::fs::File::open(path).map_err(|_| "无法读取收藏文件，请确认当前用户有访问权限")?;
    let mut bytes = Vec::new();
    file.take(32 * 1024 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > 32 * 1024 * 1024 {
        return Err("收藏文件超过 32 MB，无法导入".into());
    }
    let data: Value =
        serde_json::from_slice(&bytes).map_err(|_| "收藏文件正在更新或格式损坏，请稍后重试")?;
    parse_chromium(&data)
}

fn parse_chromium(data: &Value) -> Result<Vec<ImportedBookmark>, String> {
    let roots = data["roots"].as_object().ok_or("收藏文件缺少目录信息")?;
    let mut count = 0;
    let mut result = Vec::new();
    // 收藏夹栏、其他收藏及移动收藏按用户熟悉的顺序导入，同时保留新增的根目录。
    let mut keys: Vec<_> = roots.keys().collect();
    keys.sort_by_key(|key| match key.as_str() {
        "bookmark_bar" => 0,
        "other" => 1,
        "synced" => 2,
        _ => 3,
    });
    for key in keys {
        if let Some(node) = parse_chromium_node(&roots[key], 0, &mut count)? {
            result.push(node);
        }
    }
    Ok(result)
}

fn parse_chromium_node(
    node: &Value,
    depth: usize,
    count: &mut usize,
) -> Result<Option<ImportedBookmark>, String> {
    *count += 1;
    if depth > 64 || *count > 100_000 {
        return Err("收藏夹层级或数量过多，无法导入".into());
    }
    let title = node["name"].as_str().unwrap_or("未命名").to_string();
    match node["type"].as_str() {
        Some("url") => Ok(node["url"]
            .as_str()
            .filter(|url| !url.trim().is_empty())
            .map(|url| ImportedBookmark {
                title,
                url: Some(url.into()),
                children: vec![],
            })),
        Some("folder") => {
            let mut children = Vec::new();
            if let Some(items) = node["children"].as_array() {
                for item in items {
                    if let Some(child) = parse_chromium_node(item, depth + 1, count)? {
                        children.push(child);
                    }
                }
            }
            Ok(Some(ImportedBookmark {
                title,
                url: None,
                children,
            }))
        }
        _ => Ok(None),
    }
}

fn read_firefox(path: &Path) -> Result<Vec<ImportedBookmark>, String> {
    // 只读事务保留 WAL 中的最新收藏；不直接复制数据库，避免丢失未检查点的数据。
    let connection =
        rusqlite::Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|_| "无法读取 Firefox 收藏夹，请关闭 Firefox 后重试")?;
    connection
        .busy_timeout(std::time::Duration::from_secs(2))
        .map_err(|e| e.to_string())?;
    parse_firefox(&connection)
        .map_err(|error| format!("读取 Firefox 收藏失败：{error}。可以关闭 Firefox 后重试。"))
}

fn parse_firefox(connection: &rusqlite::Connection) -> Result<Vec<ImportedBookmark>, String> {
    let mut statement = connection.prepare("SELECT b.id,b.parent,b.type,COALESCE(b.title,''),p.url,b.guid FROM moz_bookmarks b LEFT JOIN moz_places p ON p.id=b.fk ORDER BY b.parent,b.position LIMIT 100001")
        .map_err(|e| e.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, String>(5)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    if rows.len() > 100_000 {
        return Err("收藏数量超过限制".into());
    }
    type Row = (i64, i64, i64, String, Option<String>, String);
    let mut children: HashMap<i64, Vec<&Row>> = HashMap::new();
    for row in &rows {
        children.entry(row.1).or_default().push(row);
    }
    fn build(
        row: &Row,
        children: &HashMap<i64, Vec<&Row>>,
        depth: usize,
    ) -> Result<Option<ImportedBookmark>, String> {
        if depth > 64 {
            return Err("收藏夹层级过深或存在循环".into());
        }
        if row.2 != 1 && row.2 != 2 {
            return Ok(None);
        }
        if row.2 == 1 && row.4.is_none() {
            return Ok(None);
        }
        let mut entries = Vec::new();
        if row.2 == 2 {
            for child in children.get(&row.0).into_iter().flatten() {
                if let Some(entry) = build(child, children, depth + 1)? {
                    entries.push(entry);
                }
            }
        }
        let title = if row.3.is_empty() {
            match row.5.as_str() {
                "toolbar_____" => "收藏夹栏",
                "menu________" => "书签菜单",
                "unfiled_____" => "其他收藏",
                "mobile______" => "移动收藏",
                _ => "未命名",
            }
            .into()
        } else {
            row.3.clone()
        };
        Ok(Some(ImportedBookmark {
            title,
            url: if row.2 == 1 { row.4.clone() } else { None },
            children: entries,
        }))
    }
    let mut result = Vec::new();
    for guid in [
        "toolbar_____",
        "menu________",
        "unfiled_____",
        "mobile______",
    ] {
        if let Some(row) = rows.iter().find(|row| row.5 == guid) {
            if let Some(node) = build(row, &children, 0)? {
                result.push(node);
            }
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scan_chromium_detects_multiple_profiles_without_modifying_source() {
        // 独立临时配置不读取用户资料；环境中的 TEMP 已统一指向 D 盘构建目录。
        let root = std::env::temp_dir().join(format!(
            "sia-bookmarks-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        for profile in ["Default", "Profile 1"] {
            std::fs::create_dir_all(root.join(profile)).unwrap();
            std::fs::write(root.join(profile).join("Bookmarks"), r#"{"roots":{}}"#).unwrap();
        }
        std::fs::write(
            root.join("Local State"),
            r#"{"profile":{"info_cache":{"Default":{"name":"个人"},"Profile 1":{"name":"公司"}}}}"#,
        )
        .unwrap();
        let mut sources = Vec::new();
        scan_chromium("Test Browser", &root, &mut sources);
        assert_eq!(sources.len(), 2);
        assert!(sources
            .iter()
            .any(|source| source.profile == "公司 (Profile 1)"));
        assert_ne!(sources[0].id, sources[1].id);
        assert_eq!(
            std::fs::read_to_string(root.join("Default/Bookmarks")).unwrap(),
            r#"{"roots":{}}"#
        );
        assert!(root.starts_with(std::env::temp_dir()));
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn chromium_preserves_chinese_hierarchy_and_order() {
        let data = serde_json::json!({"roots":{"bookmark_bar":{"type":"folder","name":"收藏夹栏","children":[{"type":"folder","name":"开发","children":[{"type":"url","name":"中文站点","url":"https://example.com/中文"}]}]}}});
        let result = parse_chromium(&data).unwrap();
        assert_eq!(result[0].children[0].children[0].title, "中文站点");
        assert_eq!(
            result[0].children[0].children[0].url.as_deref(),
            Some("https://example.com/中文")
        );
        assert!(parse_chromium(&serde_json::json!({})).is_err());
    }
    #[test]
    fn firefox_reads_bookmarks_but_not_history_or_tags() {
        let db = rusqlite::Connection::open_in_memory().unwrap();
        db.execute_batch("CREATE TABLE moz_places(id INTEGER,url TEXT); CREATE TABLE moz_bookmarks(id INTEGER,parent INTEGER,type INTEGER,title TEXT,fk INTEGER,guid TEXT,position INTEGER); INSERT INTO moz_places VALUES(1,'https://example.com'),(2,'https://history.test'); INSERT INTO moz_bookmarks VALUES(1,0,2,'',NULL,'root________',0),(2,1,2,'',NULL,'toolbar_____',0),(3,2,1,'中文书签',1,'test________',0),(4,1,2,'标签',NULL,'tags________',1),(5,4,1,'忽略标签',2,'tag_________',0);") .unwrap();
        let result = parse_firefox(&db).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].title, "收藏夹栏");
        assert_eq!(result[0].children.len(), 1);
        assert_eq!(result[0].children[0].title, "中文书签");
    }
}
