use std::{fs, path::PathBuf, sync::Mutex};

use rusqlite::Connection;
use serde::Serialize;
use tauri::{AppHandle, Manager, State};

pub const CURRENT_SCHEMA_VERSION: i64 = 3;

const MIGRATIONS: &[(i64, &str)] = &[
    (
        1,
        r#"
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            document_type TEXT NOT NULL DEFAULT 'note',
            status TEXT NOT NULL DEFAULT 'draft',
            project_id TEXT,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE INDEX IF NOT EXISTS idx_documents_updated_at
            ON documents(updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_documents_project_id
            ON documents(project_id)
            WHERE project_id IS NOT NULL;
        "#,
    ),
    (
        2,
        r#"
        CREATE TABLE IF NOT EXISTS companies (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL COLLATE NOCASE UNIQUE,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            code TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'planning'
                CHECK (status IN ('planning', 'active', 'paused', 'completed')),
            priority TEXT NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
            company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
            start_date TEXT,
            due_date TEXT,
            archived_at TEXT,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date)
        );

        CREATE INDEX IF NOT EXISTS idx_projects_status_updated_at
            ON projects(status, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_projects_company_id
            ON projects(company_id)
            WHERE company_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_projects_archived_at
            ON projects(archived_at)
            WHERE archived_at IS NOT NULL;
        "#,
    ),
    (
        3,
        r#"
        CREATE TABLE IF NOT EXISTS work_items (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            item_type TEXT NOT NULL DEFAULT 'task'
                CHECK (item_type IN ('task', 'bug')),
            status TEXT NOT NULL DEFAULT 'todo'
                CHECK (status IN ('backlog', 'todo', 'in_progress', 'blocked', 'done', 'cancelled')),
            priority TEXT NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
            project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
            due_date TEXT,
            description TEXT NOT NULL DEFAULT '',
            completed_at TEXT,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        CREATE INDEX IF NOT EXISTS idx_work_items_status_updated_at
            ON work_items(status, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_work_items_project_id
            ON work_items(project_id)
            WHERE project_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_work_items_due_date
            ON work_items(due_date)
            WHERE due_date IS NOT NULL;
        "#,
    ),
];

pub struct Database {
    connection: Mutex<Connection>,
    path: PathBuf,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseInfo {
    path: String,
    schema_version: i64,
}

impl Database {
    pub fn initialize(app: &AppHandle) -> Result<Self, String> {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| format!("无法获取应用数据目录：{error}"))?;
        fs::create_dir_all(&app_data_dir)
            .map_err(|error| format!("无法创建应用数据目录：{error}"))?;

        Self::open(app_data_dir.join("workbench.sqlite3"))
    }

    fn open(path: PathBuf) -> Result<Self, String> {
        let connection =
            Connection::open(&path).map_err(|error| format!("无法打开工作台数据库：{error}"))?;
        prepare_connection(&connection)
            .map_err(|error| format!("无法初始化工作台数据库：{error}"))?;

        Ok(Self {
            connection: Mutex::new(connection),
            path,
        })
    }

    pub fn with_connection<T>(
        &self,
        operation: impl FnOnce(&Connection) -> rusqlite::Result<T>,
    ) -> Result<T, String> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| "工作台数据库连接状态异常".to_string())?;
        operation(&connection).map_err(|error| format!("数据库操作失败：{error}"))
    }
}

#[tauri::command]
pub fn database_info(database: State<'_, Database>) -> DatabaseInfo {
    DatabaseInfo {
        path: database.path.to_string_lossy().into_owned(),
        schema_version: CURRENT_SCHEMA_VERSION,
    }
}

pub(crate) fn prepare_connection(connection: &Connection) -> rusqlite::Result<()> {
    connection.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 5000;

        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
        "#,
    )?;

    let current_version = connection.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |row| row.get::<_, i64>(0),
    )?;

    for (version, sql) in MIGRATIONS {
        if *version <= current_version {
            continue;
        }
        let transaction = connection.unchecked_transaction()?;
        transaction.execute_batch(sql)?;
        transaction.execute(
            "INSERT INTO schema_migrations(version) VALUES (?1)",
            [version],
        )?;
        transaction.commit()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn applies_all_migrations_once() {
        let connection = Connection::open_in_memory().expect("create in-memory database");
        prepare_connection(&connection).expect("apply migrations");
        prepare_connection(&connection).expect("reapply migrations");

        let version: i64 = connection
            .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| {
                row.get(0)
            })
            .expect("read schema version");
        assert_eq!(version, CURRENT_SCHEMA_VERSION);
        assert!(connection
            .table_exists(None, "projects")
            .expect("check projects table"));
        assert!(connection
            .table_exists(None, "work_items")
            .expect("check work items table"));
    }
}
