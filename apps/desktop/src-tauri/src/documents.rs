use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::database::Database;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentRecord {
    id: String,
    title: String,
    content: String,
    document_type: String,
    status: String,
    project_id: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDocumentInput {
    id: String,
    title: String,
    content: String,
    document_type: String,
    status: String,
    project_id: Option<String>,
}

fn read_document(row: &Row<'_>) -> rusqlite::Result<DocumentRecord> {
    Ok(DocumentRecord {
        id: row.get(0)?,
        title: row.get(1)?,
        content: row.get(2)?,
        document_type: row.get(3)?,
        status: row.get(4)?,
        project_id: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

fn find_document(
    connection: &Connection,
    document_id: &str,
) -> rusqlite::Result<Option<DocumentRecord>> {
    connection
        .query_row(
            r#"
            SELECT id, title, content, document_type, status, project_id, created_at, updated_at
            FROM documents
            WHERE id = ?1
            "#,
            [document_id],
            read_document,
        )
        .optional()
}

fn upsert_document(
    connection: &Connection,
    input: &SaveDocumentInput,
) -> rusqlite::Result<DocumentRecord> {
    connection.execute(
        r#"
        INSERT INTO documents (
            id, title, content, document_type, status, project_id
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            content = excluded.content,
            document_type = excluded.document_type,
            status = excluded.status,
            project_id = excluded.project_id,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        "#,
        params![
            input.id,
            input.title,
            input.content,
            input.document_type,
            input.status,
            input.project_id,
        ],
    )?;

    find_document(connection, &input.id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
}

#[tauri::command]
pub fn get_document(
    document_id: String,
    database: State<'_, Database>,
) -> Result<Option<DocumentRecord>, String> {
    database.with_connection(|connection| find_document(connection, &document_id))
}

#[tauri::command]
pub fn save_document(
    input: SaveDocumentInput,
    database: State<'_, Database>,
) -> Result<DocumentRecord, String> {
    database.with_connection(|connection| upsert_document(connection, &input))
}

#[tauri::command]
pub fn list_documents(database: State<'_, Database>) -> Result<Vec<DocumentRecord>, String> {
    database.with_connection(|connection| {
        let mut statement = connection.prepare(
            r#"
            SELECT id, title, content, document_type, status, project_id, created_at, updated_at
            FROM documents
            ORDER BY updated_at DESC, title ASC
            "#,
        )?;
        let documents = statement
            .query_map([], read_document)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(documents)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::prepare_connection;

    #[test]
    fn saves_and_updates_a_document() {
        let connection = Connection::open_in_memory().expect("create in-memory database");
        prepare_connection(&connection).expect("prepare schema");

        let mut input = SaveDocumentInput {
            id: "document-1".to_string(),
            title: "需求文档".to_string(),
            content: "# 初稿".to_string(),
            document_type: "prd".to_string(),
            status: "draft".to_string(),
            project_id: None,
        };
        let created = upsert_document(&connection, &input).expect("insert document");
        input.content = "# 已更新".to_string();
        let updated = upsert_document(&connection, &input).expect("update document");

        assert_eq!(created.id, updated.id);
        assert_eq!(updated.content, "# 已更新");
        assert_eq!(updated.document_type, "prd");
    }
}
