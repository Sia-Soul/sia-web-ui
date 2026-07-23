fn main() {
    let resource_dir = std::path::Path::new("resources");
    let database_host = resource_dir.join("Sia.DataStudio.DatabaseHost.exe");
    if !database_host.exists() {
        std::fs::create_dir_all(resource_dir).expect("创建数据库服务资源目录失败");
        std::fs::write(database_host, []).expect("创建数据库服务占位资源失败");
    }
    tauri_build::build()
}
