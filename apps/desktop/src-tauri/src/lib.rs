use serde::Serialize;
use tauri::Manager;

mod database;
mod choose_box;
mod documents;
mod projects;
mod work_items;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeInfo {
    platform: &'static str,
    architecture: &'static str,
    app_version: String,
}

#[tauri::command]
fn runtime_info(app: tauri::AppHandle) -> RuntimeInfo {
    RuntimeInfo {
        platform: std::env::consts::OS,
        architecture: std::env::consts::ARCH,
        app_version: app.package_info().version.to_string(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let database =
                database::Database::initialize(app.handle()).map_err(std::io::Error::other)?;
            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            runtime_info,
            choose_box::choose_box_roots,
            choose_box::choose_box_read_directory,
            database::database_info,
            documents::get_document,
            documents::save_document,
            documents::list_documents,
            projects::list_projects,
            projects::get_project,
            projects::save_project,
            projects::archive_project,
            work_items::list_work_items,
            work_items::save_work_item,
            work_items::delete_work_item,
        ])
        .run(tauri::generate_context!())
        .expect("启动 Sia Desktop 失败");
}
