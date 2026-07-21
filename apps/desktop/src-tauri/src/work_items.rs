use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::database::Database;

const ITEM_TYPES: &[&str] = &["task", "bug"];
const ITEM_STATUSES: &[&str] = &[
    "backlog",
    "todo",
    "in_progress",
    "blocked",
    "done",
    "cancelled",
];
const ITEM_PRIORITIES: &[&str] = &["low", "medium", "high", "urgent"];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkItemRecord {
    id: String,
    title: String,
    item_type: String,
    status: String,
    priority: String,
    project_id: Option<String>,
    project_name: Option<String>,
    due_date: Option<String>,
    description: String,
    completed_at: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveWorkItemInput {
    id: String,
    title: String,
    item_type: String,
    status: String,
    priority: String,
    project_id: Option<String>,
    due_date: Option<String>,
    description: String,
}

impl SaveWorkItemInput {
    fn normalize(mut self) -> Result<Self, String> {
        self.id = self.id.trim().to_string();
        self.title = self.title.trim().to_string();
        self.project_id = normalized_optional(self.project_id);
        self.due_date = normalized_optional(self.due_date);
        self.description = self.description.trim().to_string();

        if self.id.is_empty() {
            return Err("任务 ID 不能为空".to_string());
        }
        if self.title.is_empty() {
            return Err("任务标题不能为空".to_string());
        }
        if self.title.chars().count() > 160 {
            return Err("任务标题不能超过 160 个字符".to_string());
        }
        if self.description.chars().count() > 5_000 {
            return Err("任务说明不能超过 5000 个字符".to_string());
        }
        if !ITEM_TYPES.contains(&self.item_type.as_str()) {
            return Err("任务类型不合法".to_string());
        }
        if !ITEM_STATUSES.contains(&self.status.as_str()) {
            return Err("任务状态不合法".to_string());
        }
        if !ITEM_PRIORITIES.contains(&self.priority.as_str()) {
            return Err("任务优先级不合法".to_string());
        }
        Ok(self)
    }
}

fn normalized_optional(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let normalized = item.trim().to_string();
        if normalized.is_empty() {
            None
        } else {
            Some(normalized)
        }
    })
}

fn read_work_item(row: &Row<'_>) -> rusqlite::Result<WorkItemRecord> {
    Ok(WorkItemRecord {
        id: row.get(0)?,
        title: row.get(1)?,
        item_type: row.get(2)?,
        status: row.get(3)?,
        priority: row.get(4)?,
        project_id: row.get(5)?,
        project_name: row.get(6)?,
        due_date: row.get(7)?,
        description: row.get(8)?,
        completed_at: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

const WORK_ITEM_SELECT: &str = r#"
    SELECT
        work_items.id,
        work_items.title,
        work_items.item_type,
        work_items.status,
        work_items.priority,
        work_items.project_id,
        projects.name,
        work_items.due_date,
        work_items.description,
        work_items.completed_at,
        work_items.created_at,
        work_items.updated_at
    FROM work_items
    LEFT JOIN projects ON projects.id = work_items.project_id
"#;

fn find_work_item(
    connection: &Connection,
    work_item_id: &str,
) -> rusqlite::Result<Option<WorkItemRecord>> {
    connection
        .query_row(
            &format!("{WORK_ITEM_SELECT} WHERE work_items.id = ?1"),
            [work_item_id],
            read_work_item,
        )
        .optional()
}

fn upsert_work_item(
    connection: &Connection,
    input: &SaveWorkItemInput,
) -> rusqlite::Result<WorkItemRecord> {
    connection.execute(
        r#"
        INSERT INTO work_items (
            id, title, item_type, status, priority, project_id, due_date, description, completed_at
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
            CASE WHEN ?4 = 'done' THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ELSE NULL END
        )
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            item_type = excluded.item_type,
            status = excluded.status,
            priority = excluded.priority,
            project_id = excluded.project_id,
            due_date = excluded.due_date,
            description = excluded.description,
            completed_at = CASE
                WHEN excluded.status = 'done' AND work_items.completed_at IS NULL
                    THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                WHEN excluded.status != 'done' THEN NULL
                ELSE work_items.completed_at
            END,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        "#,
        params![
            input.id,
            input.title,
            input.item_type,
            input.status,
            input.priority,
            input.project_id,
            input.due_date,
            input.description,
        ],
    )?;
    find_work_item(connection, &input.id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
}

#[tauri::command]
pub fn list_work_items(database: State<'_, Database>) -> Result<Vec<WorkItemRecord>, String> {
    database.with_connection(|connection| {
        let mut statement = connection.prepare(&format!(
            "{WORK_ITEM_SELECT} ORDER BY work_items.updated_at DESC, work_items.title ASC"
        ))?;
        let items = statement
            .query_map([], read_work_item)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(items)
    })
}

#[tauri::command]
pub fn save_work_item(
    input: SaveWorkItemInput,
    database: State<'_, Database>,
) -> Result<WorkItemRecord, String> {
    let input = input.normalize()?;
    database.with_connection(|connection| upsert_work_item(connection, &input))
}

#[tauri::command]
pub fn delete_work_item(
    work_item_id: String,
    database: State<'_, Database>,
) -> Result<bool, String> {
    database.with_connection(|connection| {
        let changed = connection.execute("DELETE FROM work_items WHERE id = ?1", [work_item_id])?;
        Ok(changed > 0)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::prepare_connection;

    fn sample_item() -> SaveWorkItemInput {
        SaveWorkItemInput {
            id: "work-item-1".to_string(),
            title: "完成任务中心".to_string(),
            item_type: "task".to_string(),
            status: "todo".to_string(),
            priority: "high".to_string(),
            project_id: None,
            due_date: Some("2026-07-31".to_string()),
            description: "完成任务和 BUG 管理闭环".to_string(),
        }
    }

    #[test]
    fn saves_updates_and_deletes_a_work_item() {
        let connection = Connection::open_in_memory().expect("create in-memory database");
        prepare_connection(&connection).expect("prepare schema");
        let mut input = sample_item().normalize().expect("normalize work item");

        let created = upsert_work_item(&connection, &input).expect("create work item");
        assert_eq!(created.status, "todo");
        assert!(created.completed_at.is_none());

        input.status = "done".to_string();
        let completed = upsert_work_item(&connection, &input).expect("complete work item");
        assert!(completed.completed_at.is_some());

        connection
            .execute("DELETE FROM work_items WHERE id = ?1", [&input.id])
            .expect("delete work item");
        assert!(find_work_item(&connection, &input.id)
            .expect("find deleted work item")
            .is_none());
    }

    #[test]
    fn rejects_invalid_work_item_values() {
        let mut input = sample_item();
        input.item_type = "unknown".to_string();
        assert_eq!(
            input.normalize().expect_err("reject invalid type"),
            "任务类型不合法"
        );
    }
}
