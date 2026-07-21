use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::database::Database;

const PROJECT_STATUSES: &[&str] = &["planning", "active", "paused", "completed"];
const PROJECT_PRIORITIES: &[&str] = &["low", "medium", "high", "urgent"];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRecord {
    id: String,
    name: String,
    code: String,
    description: String,
    status: String,
    priority: String,
    company_id: Option<String>,
    company_name: Option<String>,
    start_date: Option<String>,
    due_date: Option<String>,
    archived_at: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveProjectInput {
    id: String,
    name: String,
    code: String,
    description: String,
    status: String,
    priority: String,
    company_id: Option<String>,
    company_name: Option<String>,
    start_date: Option<String>,
    due_date: Option<String>,
}

impl SaveProjectInput {
    fn normalize(mut self) -> Result<Self, String> {
        self.id = self.id.trim().to_string();
        self.name = self.name.trim().to_string();
        self.code = self.code.trim().to_string();
        self.description = self.description.trim().to_string();
        self.company_id = normalized_optional(self.company_id);
        self.company_name = normalized_optional(self.company_name);
        self.start_date = normalized_optional(self.start_date);
        self.due_date = normalized_optional(self.due_date);

        if self.id.is_empty() {
            return Err("项目 ID 不能为空".to_string());
        }
        if self.name.is_empty() {
            return Err("项目名称不能为空".to_string());
        }
        if self.name.chars().count() > 120 {
            return Err("项目名称不能超过 120 个字符".to_string());
        }
        if self.code.chars().count() > 40 {
            return Err("项目编号不能超过 40 个字符".to_string());
        }
        if self.description.chars().count() > 2_000 {
            return Err("项目说明不能超过 2000 个字符".to_string());
        }
        if !PROJECT_STATUSES.contains(&self.status.as_str()) {
            return Err("项目状态不合法".to_string());
        }
        if !PROJECT_PRIORITIES.contains(&self.priority.as_str()) {
            return Err("项目优先级不合法".to_string());
        }
        if self.company_name.is_some() && self.company_id.is_none() {
            return Err("新公司缺少 ID".to_string());
        }
        if let (Some(start_date), Some(due_date)) = (&self.start_date, &self.due_date) {
            if start_date > due_date {
                return Err("项目结束日期不能早于开始日期".to_string());
            }
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

fn read_project(row: &Row<'_>) -> rusqlite::Result<ProjectRecord> {
    Ok(ProjectRecord {
        id: row.get(0)?,
        name: row.get(1)?,
        code: row.get(2)?,
        description: row.get(3)?,
        status: row.get(4)?,
        priority: row.get(5)?,
        company_id: row.get(6)?,
        company_name: row.get(7)?,
        start_date: row.get(8)?,
        due_date: row.get(9)?,
        archived_at: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

const PROJECT_SELECT: &str = r#"
    SELECT
        projects.id,
        projects.name,
        projects.code,
        projects.description,
        projects.status,
        projects.priority,
        projects.company_id,
        companies.name,
        projects.start_date,
        projects.due_date,
        projects.archived_at,
        projects.created_at,
        projects.updated_at
    FROM projects
    LEFT JOIN companies ON companies.id = projects.company_id
"#;

fn find_project(
    connection: &Connection,
    project_id: &str,
) -> rusqlite::Result<Option<ProjectRecord>> {
    connection
        .query_row(
            &format!("{PROJECT_SELECT} WHERE projects.id = ?1"),
            [project_id],
            read_project,
        )
        .optional()
}

fn resolve_company(
    connection: &Connection,
    input: &SaveProjectInput,
) -> rusqlite::Result<Option<String>> {
    let Some(company_name) = input.company_name.as_deref() else {
        return Ok(None);
    };
    let existing = connection
        .query_row(
            "SELECT id FROM companies WHERE name = ?1 COLLATE NOCASE",
            [company_name],
            |row| row.get::<_, String>(0),
        )
        .optional()?;
    if existing.is_some() {
        return Ok(existing);
    }

    let company_id = input
        .company_id
        .as_deref()
        .ok_or_else(|| rusqlite::Error::InvalidParameterName("companyId".to_string()))?;
    connection.execute(
        "INSERT INTO companies(id, name) VALUES (?1, ?2)",
        params![company_id, company_name],
    )?;
    Ok(Some(company_id.to_string()))
}

fn upsert_project(
    connection: &Connection,
    input: &SaveProjectInput,
) -> rusqlite::Result<ProjectRecord> {
    let company_id = resolve_company(connection, input)?;
    connection.execute(
        r#"
        INSERT INTO projects (
            id, name, code, description, status, priority,
            company_id, start_date, due_date
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            code = excluded.code,
            description = excluded.description,
            status = excluded.status,
            priority = excluded.priority,
            company_id = excluded.company_id,
            start_date = excluded.start_date,
            due_date = excluded.due_date,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        "#,
        params![
            input.id,
            input.name,
            input.code,
            input.description,
            input.status,
            input.priority,
            company_id,
            input.start_date,
            input.due_date,
        ],
    )?;
    find_project(connection, &input.id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
}

#[tauri::command]
pub fn list_projects(
    include_archived: bool,
    database: State<'_, Database>,
) -> Result<Vec<ProjectRecord>, String> {
    database.with_connection(|connection| {
        let query = if include_archived {
            format!("{PROJECT_SELECT} ORDER BY projects.updated_at DESC, projects.name ASC")
        } else {
            format!(
                "{PROJECT_SELECT} WHERE projects.archived_at IS NULL ORDER BY projects.updated_at DESC, projects.name ASC"
            )
        };
        let mut statement = connection.prepare(&query)?;
        let projects = statement
            .query_map([], read_project)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(projects)
    })
}

#[tauri::command]
pub fn get_project(
    project_id: String,
    database: State<'_, Database>,
) -> Result<Option<ProjectRecord>, String> {
    database.with_connection(|connection| find_project(connection, &project_id))
}

#[tauri::command]
pub fn save_project(
    input: SaveProjectInput,
    database: State<'_, Database>,
) -> Result<ProjectRecord, String> {
    let input = input.normalize()?;
    database.with_connection(|connection| upsert_project(connection, &input))
}

#[tauri::command]
pub fn archive_project(
    project_id: String,
    archived: bool,
    database: State<'_, Database>,
) -> Result<ProjectRecord, String> {
    database.with_connection(|connection| {
        let changed = connection.execute(
            r#"
            UPDATE projects
            SET archived_at = CASE
                    WHEN ?2 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                    ELSE NULL
                END,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?1
            "#,
            params![project_id, archived],
        )?;
        if changed == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        find_project(connection, &project_id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::prepare_connection;

    fn sample_project() -> SaveProjectInput {
        SaveProjectInput {
            id: "project-1".to_string(),
            name: "Sia 工作台".to_string(),
            code: "SIA".to_string(),
            description: "个人工作台客户端".to_string(),
            status: "active".to_string(),
            priority: "high".to_string(),
            company_id: Some("company-1".to_string()),
            company_name: Some("Sia Studio".to_string()),
            start_date: Some("2026-07-01".to_string()),
            due_date: Some("2026-12-31".to_string()),
        }
    }

    #[test]
    fn saves_updates_and_archives_a_project() {
        let connection = Connection::open_in_memory().expect("create in-memory database");
        prepare_connection(&connection).expect("prepare schema");
        let mut input = sample_project().normalize().expect("normalize project");

        let created = upsert_project(&connection, &input).expect("create project");
        assert_eq!(created.company_name.as_deref(), Some("Sia Studio"));

        input.status = "completed".to_string();
        let updated = upsert_project(&connection, &input).expect("update project");
        assert_eq!(updated.status, "completed");

        connection
            .execute(
                "UPDATE projects SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1",
                [&input.id],
            )
            .expect("archive project");
        let archived = find_project(&connection, &input.id)
            .expect("find project")
            .expect("project exists");
        assert!(archived.archived_at.is_some());
    }

    #[test]
    fn rejects_an_invalid_date_range() {
        let mut input = sample_project();
        input.start_date = Some("2026-12-31".to_string());
        input.due_date = Some("2026-01-01".to_string());
        assert_eq!(
            input.normalize().expect_err("reject invalid dates"),
            "项目结束日期不能早于开始日期"
        );
    }
}
