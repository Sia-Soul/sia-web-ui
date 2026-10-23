use std::path::PathBuf;

/// 将标识编码为小写十六进制，避免路径字符替换和 Windows 大小写折叠造成隔离目录碰撞。
fn encode_identifier(value: &str) -> String {
    value
        .as_bytes()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// 小分组数据目录使用版本化命名空间；无小分组的标签共享所属大分组的独立默认目录。
/// 不复用旧版大分组目录，避免将已混合的登录状态带入新的隔离空间。
pub fn relative_profile_path(group_id: &str, small_group_id: Option<&str>) -> PathBuf {
    let group =
        PathBuf::from("browser-profiles-v2").join(format!("g-{}", encode_identifier(group_id)));
    match small_group_id {
        Some(id) => group.join(format!("s-{}", encode_identifier(id))),
        None => group.join("default"),
    }
}

/// 解码受管目录的稳定 ID；拒绝非法十六进制和损坏的 UTF-8，避免误判其他目录。
fn decode_identifier(value: &str) -> Option<String> {
    if value.len() % 2 != 0 || !value.is_ascii() {
        return None;
    }
    let bytes = (0..value.len())
        .step_by(2)
        .map(|index| u8::from_str_radix(&value[index..index + 2], 16).ok())
        .collect::<Option<Vec<_>>>()?;
    String::from_utf8(bytes).ok()
}

/// 枚举已经创建的隔离空间，包含关闭和休眠的标签；不跟随目录符号链接。
pub fn existing_profile_scopes(
    base: &std::path::Path,
) -> Result<Vec<(String, Option<String>, PathBuf)>, String> {
    let root = base.join("browser-profiles-v2");
    if !root.exists() {
        return Ok(Vec::new());
    }
    let mut result = Vec::new();
    for group in std::fs::read_dir(root).map_err(|error| error.to_string())? {
        let group = group.map_err(|error| error.to_string())?;
        if !group
            .file_type()
            .map_err(|error| error.to_string())?
            .is_dir()
        {
            continue;
        }
        let name = group.file_name().to_string_lossy().to_string();
        let Some(id) = name.strip_prefix("g-").and_then(decode_identifier) else {
            continue;
        };
        for profile in std::fs::read_dir(group.path()).map_err(|error| error.to_string())? {
            let profile = profile.map_err(|error| error.to_string())?;
            if !profile
                .file_type()
                .map_err(|error| error.to_string())?
                .is_dir()
            {
                continue;
            }
            let name = profile.file_name().to_string_lossy().to_string();
            let small = if name == "default" {
                None
            } else {
                let Some(small) = name.strip_prefix("s-").and_then(decode_identifier) else {
                    continue;
                };
                Some(small)
            };
            result.push((id.clone(), small, profile.path()));
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 休眠空间扫描必须能还原中文 ID，同时拒绝损坏的目录名。
    #[test]
    fn profile_ids_round_trip() {
        for id in ["管理后台", "group-dev", "A/a", ""] {
            assert_eq!(
                decode_identifier(&encode_identifier(id)).as_deref(),
                Some(id)
            );
        }
        for invalid in ["g-12", "a", "zz", "ff", "中文"] {
            assert_eq!(decode_identifier(invalid), None);
        }
    }

    #[test]
    fn same_scope_reuses_profile() {
        assert_eq!(
            relative_profile_path("dev", Some("admin")),
            relative_profile_path("dev", Some("admin"))
        );
        assert_eq!(
            relative_profile_path("dev", None),
            PathBuf::from("browser-profiles-v2/g-646576/default")
        );
    }

    #[test]
    fn parent_and_sibling_scopes_are_distinct() {
        let paths = [
            relative_profile_path("dev", None),
            relative_profile_path("dev", Some("admin")),
            relative_profile_path("dev", Some("brand")),
            relative_profile_path("pre", Some("admin")),
            relative_profile_path("dev", Some("default")),
            relative_profile_path("dev", Some("")),
        ];
        assert_eq!(
            paths.iter().collect::<std::collections::HashSet<_>>().len(),
            paths.len()
        );
    }

    #[test]
    fn identifiers_do_not_collide_on_windows() {
        let ids = [
            "A",
            "a",
            "a/b",
            "a_b",
            "a\\b",
            "../admin",
            "管理后台",
            "品牌方端",
        ];
        let paths = ids.map(|id| {
            relative_profile_path("dev", Some(id))
                .to_string_lossy()
                .to_lowercase()
        });
        assert_eq!(
            paths.iter().collect::<std::collections::HashSet<_>>().len(),
            ids.len()
        );
        assert!(paths.iter().all(|path| !path.contains("..")));
    }
}
