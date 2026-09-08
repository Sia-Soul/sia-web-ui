use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use std::{
    env, fs,
    io::Write,
    net::IpAddr,
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
    time::{Duration, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};

#[cfg(target_os = "windows")]
use winreg::{
    enums::{HKEY_CURRENT_USER, REG_NONE},
    RegKey, RegValue,
};

#[cfg(target_os = "windows")]
use std::{ffi::OsStr, os::windows::ffi::OsStrExt};

#[cfg(target_os = "windows")]
const FILE_ASSOCIATION_ICONS: &[(&str, &[u8])] = &[
    ("txt", include_bytes!("../filetype-icons/txt.ico")),
    ("json", include_bytes!("../filetype-icons/json.ico")),
    ("md", include_bytes!("../filetype-icons/md.ico")),
    ("markdown", include_bytes!("../filetype-icons/markdown.ico")),
    ("cs", include_bytes!("../filetype-icons/cs.ico")),
    ("js", include_bytes!("../filetype-icons/js.ico")),
    ("jsx", include_bytes!("../filetype-icons/jsx.ico")),
    ("mjs", include_bytes!("../filetype-icons/mjs.ico")),
    ("cjs", include_bytes!("../filetype-icons/cjs.ico")),
    ("ts", include_bytes!("../filetype-icons/ts.ico")),
    ("tsx", include_bytes!("../filetype-icons/tsx.ico")),
    ("html", include_bytes!("../filetype-icons/html.ico")),
    ("htm", include_bytes!("../filetype-icons/htm.ico")),
    ("css", include_bytes!("../filetype-icons/css.ico")),
    ("xml", include_bytes!("../filetype-icons/xml.ico")),
    ("yaml", include_bytes!("../filetype-icons/yaml.ico")),
    ("yml", include_bytes!("../filetype-icons/yml.ico")),
    ("ini", include_bytes!("../filetype-icons/ini.ico")),
    ("sh", include_bytes!("../filetype-icons/sh.ico")),
    ("bash", include_bytes!("../filetype-icons/bash.ico")),
    ("zsh", include_bytes!("../filetype-icons/zsh.ico")),
    ("ps1", include_bytes!("../filetype-icons/ps1.ico")),
    ("bat", include_bytes!("../filetype-icons/bat.ico")),
    ("cmd", include_bytes!("../filetype-icons/cmd.ico")),
    ("py", include_bytes!("../filetype-icons/py.ico")),
    ("sql", include_bytes!("../filetype-icons/sql.ico")),
    ("php", include_bytes!("../filetype-icons/php.ico")),
    ("rb", include_bytes!("../filetype-icons/rb.ico")),
    ("pl", include_bytes!("../filetype-icons/pl.ico")),
    ("lua", include_bytes!("../filetype-icons/lua.ico")),
];

#[cfg(target_os = "windows")]
#[link(name = "shell32")]
extern "system" {
    fn SHChangeNotify(
        event_id: i32,
        flags: u32,
        item1: *const std::ffi::c_void,
        item2: *const std::ffi::c_void,
    );
    fn ShellExecuteW(
        window: *mut std::ffi::c_void,
        operation: *const u16,
        file: *const u16,
        parameters: *const u16,
        directory: *const u16,
        show_command: i32,
    ) -> isize;
}

const FILE_ASSOCIATION_EXTENSIONS: &[&str] = &[
    "txt", "json", "md", "markdown", "cs", "js", "jsx", "mjs", "cjs", "ts", "tsx", "html", "htm",
    "css", "xml", "yaml", "yml", "ini", "py", "sql", "php", "rb", "pl", "lua",
];

#[cfg(target_os = "windows")]
const COMMAND_LINE_ASSOCIATION_EXTENSIONS: &[&str] =
    &["bat", "cmd", "sh", "bash", "zsh", "ksh", "ps1"];

const SUPPORTED_TEXT_EXTENSIONS: &[&str] = &[
    "txt",
    "apdl",
    "ans",
    "mac",
    "asp",
    "aspx",
    "ascx",
    "master",
    "asmx",
    "ashx",
    "cshtml",
    "razor",
    "asm",
    "s",
    "bat",
    "cmd",
    "sh",
    "bash",
    "zsh",
    "ksh",
    "bib",
    "c",
    "h",
    "cs",
    "cpp",
    "cc",
    "cxx",
    "hpp",
    "hh",
    "hxx",
    "clj",
    "cljs",
    "cljc",
    "edn",
    "cmake",
    "coffee",
    "css",
    "cu",
    "cuh",
    "d",
    "dart",
    "diff",
    "patch",
    "dockerfile",
    "env",
    "edi",
    "edifact",
    "fs",
    "fsi",
    "fsx",
    "fsscript",
    "f",
    "for",
    "f90",
    "f95",
    "f03",
    "f08",
    "f77",
    "gcode",
    "nc",
    "tap",
    "go",
    "graphql",
    "gql",
    "groovy",
    "gradle",
    "hbs",
    "handlebars",
    "hlsl",
    "fx",
    "fxh",
    "html",
    "htm",
    "idl",
    "ini",
    "hex",
    "ihex",
    "java",
    "jav",
    "js",
    "mjs",
    "cjs",
    "jsx",
    "json",
    "jsonl",
    "ndjson",
    "jsonc",
    "jsp",
    "jspx",
    "jl",
    "jmd",
    "kt",
    "kts",
    "tex",
    "latex",
    "less",
    "lisp",
    "lsp",
    "cl",
    "log",
    "lua",
    "mk",
    "mak",
    "md",
    "markdown",
    "m",
    "nsi",
    "nsh",
    "mm",
    "pas",
    "p",
    "pp",
    "pl",
    "pm",
    "php",
    "phtml",
    "po",
    "pot",
    "ps",
    "eps",
    "pov",
    "ps1",
    "psm1",
    "psd1",
    "properties",
    "proto",
    "pug",
    "jade",
    "py",
    "pyw",
    "r",
    "rprofile",
    "rhistory",
    "raku",
    "rakumod",
    "p6",
    "pm6",
    "rc",
    "rst",
    "rb",
    "rs",
    "scala",
    "sc",
    "scss",
    "shader",
    "sol",
    "spice",
    "cir",
    "sql",
    "swift",
    "tcl",
    "toml",
    "ts",
    "tsx",
    "vb",
    "vbs",
    "vhd",
    "vhdl",
    "v",
    "vh",
    "sv",
    "svh",
    "vue",
    "wat",
    "wast",
    "wgsl",
    "xaml",
    "xml",
    "xsl",
    "xslt",
    "yaml",
    "yml",
];
const SAVE_FILE_FILTERS: &[(&str, &[&str])] = &[
    ("纯文本与日志", &["txt", "log"]),
    (
        "Markdown 与文档",
        &["md", "markdown", "jmd", "rst", "po", "pot"],
    ),
    (
        "Web 页面与模板",
        &[
            "html",
            "htm",
            "asp",
            "aspx",
            "ascx",
            "master",
            "asmx",
            "ashx",
            "cshtml",
            "razor",
            "jsp",
            "jspx",
            "hbs",
            "handlebars",
            "pug",
            "jade",
            "vue",
        ],
    ),
    ("样式表", &["css", "scss", "less"]),
    (
        "JavaScript 与 TypeScript",
        &["js", "mjs", "cjs", "jsx", "ts", "tsx", "coffee"],
    ),
    ("JSON 数据", &["json", "jsonc", "jsonl", "ndjson"]),
    ("XML、XAML 与 XSL", &["xml", "xaml", "xsl", "xslt"]),
    (
        "配置文件",
        &["yaml", "yml", "toml", "ini", "properties", "env"],
    ),
    (
        "C、C++ 与 CUDA",
        &[
            "c", "h", "cpp", "cc", "cxx", "hpp", "hh", "hxx", "cu", "cuh", "rc",
        ],
    ),
    (
        ".NET 源代码",
        &["cs", "fs", "fsi", "fsx", "fsscript", "vb", "vbs"],
    ),
    (
        "JVM 与 Clojure 源代码",
        &[
            "java", "jav", "kt", "kts", "scala", "sc", "groovy", "gradle", "clj", "cljs", "cljc",
            "edn",
        ],
    ),
    (
        "脚本文件",
        &[
            "bat", "cmd", "sh", "bash", "zsh", "ksh", "ps1", "psm1", "psd1", "py", "pyw", "rb",
            "pl", "pm", "php", "phtml", "lua", "r", "rprofile", "rhistory", "raku", "rakumod",
            "p6", "pm6", "tcl",
        ],
    ),
    (
        "其他编程语言",
        &[
            "rs", "go", "d", "dart", "swift", "pas", "p", "pp", "jl", "m", "mm", "lisp", "lsp",
            "cl", "sol",
        ],
    ),
    (
        "数据库与接口",
        &["sql", "graphql", "gql", "proto", "edi", "edifact"],
    ),
    (
        "工程与构建文件",
        &["cmake", "mk", "mak", "dockerfile", "nsi", "nsh"],
    ),
    (
        "汇编、硬件与着色器",
        &[
            "asm", "s", "v", "vh", "sv", "svh", "vhd", "vhdl", "hlsl", "fx", "fxh", "shader",
            "wgsl", "wat", "wast",
        ],
    ),
    (
        "科学与工程文件",
        &[
            "apdl", "ans", "mac", "f", "for", "f90", "f95", "f03", "f08", "f77", "gcode", "nc",
            "tap", "hex", "ihex", "spice", "cir", "pov",
        ],
    ),
    ("TeX 与 BibTeX", &["tex", "latex", "bib"]),
    ("差异与补丁", &["diff", "patch"]),
    ("PostScript", &["ps", "eps"]),
];
const MAX_REMOTE_IMAGE_BYTES: u64 = 15 * 1024 * 1024;

#[cfg(target_os = "windows")]
fn install_file_association_icons() -> Result<PathBuf, String> {
    let icon_directory = env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(env::temp_dir)
        .join("Sia")
        .join("Notepad")
        .join("file-icons");
    fs::create_dir_all(&icon_directory).map_err(|error| {
        format!(
            "无法创建文件关联图标目录 {}：{error}",
            icon_directory.display()
        )
    })?;

    for (extension, bytes) in FILE_ASSOCIATION_ICONS {
        let icon_path = icon_directory.join(format!("{extension}.ico"));
        let needs_write = fs::read(&icon_path)
            .map(|current| current.as_slice() != *bytes)
            .unwrap_or(true);
        if needs_write {
            fs::write(&icon_path, bytes).map_err(|error| {
                format!("无法写入文件关联图标 {}：{error}", icon_path.display())
            })?;
        }
    }

    Ok(icon_directory)
}

#[cfg(target_os = "windows")]
fn notify_windows_association_changed() {
    const SHCNE_ASSOCCHANGED: i32 = 0x0800_0000;
    const SHCNF_IDLIST: u32 = 0;
    unsafe {
        SHChangeNotify(
            SHCNE_ASSOCCHANGED,
            SHCNF_IDLIST,
            std::ptr::null(),
            std::ptr::null(),
        );
    }
}

#[cfg(target_os = "windows")]
fn register_windows_file_associations() -> Result<(), String> {
    const APPLICATION_NAME: &str = "Sia 记事本";
    const LEGACY_PROG_ID: &str = "SiaNotepad.TextFile";

    let executable = env::current_exe().map_err(|error| format!("无法获取程序路径：{error}"))?;
    let executable_name = executable
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "无法获取程序文件名".to_string())?;
    let executable_path = executable.to_string_lossy();
    let open_command = format!("\"{executable_path}\" \"%1\"");
    let application_icon = format!("{executable_path},0");
    let file_icon_directory = install_file_association_icons()?;
    let current_user = RegKey::predef(HKEY_CURRENT_USER);

    let application_key_path = format!(r"Software\Classes\Applications\{executable_name}");
    let (application_key, _) = current_user
        .create_subkey(&application_key_path)
        .map_err(|error| format!("无法注册打开方式：{error}"))?;
    application_key
        .set_value("FriendlyAppName", &APPLICATION_NAME)
        .map_err(|error| format!("无法写入应用名称：{error}"))?;
    application_key
        .set_value(
            "ApplicationDescription",
            &"轻量级、多标签、自动保存的文本编辑器",
        )
        .map_err(|error| format!("无法写入应用说明：{error}"))?;

    let (application_icon_key, _) = current_user
        .create_subkey(format!(r"{application_key_path}\DefaultIcon"))
        .map_err(|error| format!("无法注册应用图标：{error}"))?;
    application_icon_key
        .set_value("", &application_icon)
        .map_err(|error| format!("无法写入应用图标：{error}"))?;

    let (application_command_key, _) = current_user
        .create_subkey(format!(r"{application_key_path}\shell\open\command"))
        .map_err(|error| format!("无法注册文件打开命令：{error}"))?;
    application_command_key
        .set_value("", &open_command)
        .map_err(|error| format!("无法写入文件打开命令：{error}"))?;

    let (supported_types_key, _) = current_user
        .create_subkey(format!(r"{application_key_path}\SupportedTypes"))
        .map_err(|error| format!("无法注册支持的文件类型：{error}"))?;

    let (capabilities_key, _) = current_user
        .create_subkey(r"Software\Sia\Notepad\Capabilities")
        .map_err(|error| format!("无法注册应用功能：{error}"))?;
    capabilities_key
        .set_value("ApplicationName", &APPLICATION_NAME)
        .map_err(|error| format!("无法写入应用功能名称：{error}"))?;
    capabilities_key
        .set_value(
            "ApplicationDescription",
            &"轻量级、多标签、自动保存的文本编辑器",
        )
        .map_err(|error| format!("无法写入应用功能说明：{error}"))?;

    let (capability_associations_key, _) = current_user
        .create_subkey(r"Software\Sia\Notepad\Capabilities\FileAssociations")
        .map_err(|error| format!("无法注册应用文件关联：{error}"))?;

    let (registered_applications_key, _) = current_user
        .create_subkey(r"Software\RegisteredApplications")
        .map_err(|error| format!("无法注册默认应用入口：{error}"))?;
    registered_applications_key
        .set_value(APPLICATION_NAME, &r"Software\Sia\Notepad\Capabilities")
        .map_err(|error| format!("无法写入默认应用入口：{error}"))?;

    let empty_reg_none = RegValue {
        bytes: Vec::new(),
        vtype: REG_NONE,
    };

    // 命令行脚本仍可在应用内打开，但不主动加入 Windows“打开方式”候选，
    // 同时清理旧版本可能留下的注册项，避免影响这些文件的系统默认行为。
    for extension in COMMAND_LINE_ASSOCIATION_EXTENSIONS {
        let extension_with_dot = format!(".{extension}");
        let prog_id = format!("SiaDesktop.NotepadFile.{extension}");
        let superseded_prog_id = format!("SiaNotepad.{extension}File");
        let extension_key_path = format!(r"Software\Classes\{extension_with_dot}");

        let _ = supported_types_key.delete_value(&extension_with_dot);
        let _ = capability_associations_key.delete_value(&extension_with_dot);
        if let Ok(open_with_prog_ids_key) = current_user.open_subkey_with_flags(
            format!(r"{extension_key_path}\OpenWithProgids"),
            winreg::enums::KEY_WRITE,
        ) {
            let _ = open_with_prog_ids_key.delete_value(LEGACY_PROG_ID);
            let _ = open_with_prog_ids_key.delete_value(&superseded_prog_id);
            let _ = open_with_prog_ids_key.delete_value(&prog_id);
        }
        let _ = current_user.delete_subkey_all(format!(
            r"{extension_key_path}\OpenWithList\{executable_name}"
        ));
        let _ = current_user.delete_subkey_all(format!(r"Software\Classes\{prog_id}"));
        let _ = current_user.delete_subkey_all(format!(r"Software\Classes\{superseded_prog_id}"));
    }

    for extension in FILE_ASSOCIATION_EXTENSIONS {
        let extension_with_dot = format!(".{extension}");
        let prog_id = format!("SiaDesktop.NotepadFile.{extension}");
        let superseded_prog_id = format!("SiaNotepad.{extension}File");
        let extension_label = extension.to_ascii_uppercase();
        let icon_path = file_icon_directory.join(format!("{extension}.ico"));
        let file_icon = format!("\"{}\",0", icon_path.to_string_lossy());
        let prog_id_key_path = format!(r"Software\Classes\{prog_id}");
        let (prog_id_key, _) = current_user
            .create_subkey(&prog_id_key_path)
            .map_err(|error| format!("无法注册 {extension_with_dot} 文件类型：{error}"))?;
        prog_id_key
            .set_value("", &format!("Sia 记事本 {extension_label} 文件"))
            .map_err(|error| format!("无法写入 {extension_with_dot} 文件类型名称：{error}"))?;

        let (prog_id_icon_key, _) = current_user
            .create_subkey(format!(r"{prog_id_key_path}\DefaultIcon"))
            .map_err(|error| format!("无法注册 {extension_with_dot} 文件图标：{error}"))?;
        prog_id_icon_key
            .set_value("", &file_icon)
            .map_err(|error| format!("无法写入 {extension_with_dot} 文件图标：{error}"))?;

        let (prog_id_command_key, _) = current_user
            .create_subkey(format!(r"{prog_id_key_path}\shell\open\command"))
            .map_err(|error| format!("无法注册 {extension_with_dot} 打开命令：{error}"))?;
        prog_id_command_key
            .set_value("", &open_command)
            .map_err(|error| format!("无法写入 {extension_with_dot} 打开命令：{error}"))?;

        supported_types_key
            .set_value(&extension_with_dot, &"")
            .map_err(|error| format!("无法注册 {extension_with_dot} 支持类型：{error}"))?;
        capability_associations_key
            .set_value(&extension_with_dot, &prog_id)
            .map_err(|error| format!("无法注册 {extension_with_dot} 文件关联：{error}"))?;

        let extension_key_path = format!(r"Software\Classes\{extension_with_dot}");
        let (open_with_prog_ids_key, _) = current_user
            .create_subkey(format!(r"{extension_key_path}\OpenWithProgids"))
            .map_err(|error| format!("无法添加 {extension_with_dot} 打开方式：{error}"))?;
        let _ = open_with_prog_ids_key.delete_value(LEGACY_PROG_ID);
        let _ = open_with_prog_ids_key.delete_value(&superseded_prog_id);
        open_with_prog_ids_key
            .set_raw_value(&prog_id, &empty_reg_none)
            .map_err(|error| format!("无法写入 {extension_with_dot} 打开方式：{error}"))?;

        current_user
            .create_subkey(format!(
                r"{extension_key_path}\OpenWithList\{executable_name}"
            ))
            .map_err(|error| format!("无法添加 {extension_with_dot} 应用列表：{error}"))?;
    }

    notify_windows_association_changed();
    Ok(())
}

fn file_paths_from_args<I, S>(args: I) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: Into<PathBuf>,
{
    args.into_iter()
        .skip(1)
        .map(Into::into)
        .filter(|path| path.is_file())
        .map(|path| fs::canonicalize(&path).unwrap_or(path))
        .map(|path| path.to_string_lossy().into_owned())
        .collect()
}

struct PendingOpenFiles(Mutex<Vec<String>>);

fn notebook_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法获取应用数据目录：{error}"))?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("无法创建应用数据目录 {}：{error}", directory.display()))?;
    Ok(directory.join("notebook.json"))
}

#[tauri::command]
fn load_notebook(app: AppHandle) -> Result<Option<String>, String> {
    let path = notebook_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(&path)
        .map(Some)
        .map_err(|error| format!("无法读取笔记文件 {}：{error}", path.display()))
}

#[tauri::command]
fn save_notebook(app: AppHandle, contents: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&contents)
        .map_err(|error| format!("笔记数据格式无效：{error}"))?;
    let path = notebook_path(&app)?;
    let mut file = fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&path)
        .map_err(|error| format!("无法打开笔记文件 {}：{error}", path.display()))?;
    file.write_all(contents.as_bytes())
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("无法保存笔记文件 {}：{error}", path.display()))
}

#[tauri::command]
fn notebook_storage_path(app: AppHandle) -> Result<String, String> {
    Ok(notebook_path(&app)?.to_string_lossy().into_owned())
}

#[tauri::command]
fn open_notebook_directory(app: AppHandle) -> Result<(), String> {
    let path = notebook_path(&app)?;
    let directory = path
        .parent()
        .ok_or_else(|| "无法获取笔记文件所在目录".to_string())?;

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer.exe")
            .arg(directory)
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("无法打开笔记文件夹 {}：{error}", directory.display()))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = directory;
        Err("当前平台暂不支持打开笔记文件夹".to_string())
    }
}

fn modified_at_millis(path: &Path) -> Option<u64> {
    path.metadata()
        .ok()?
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis() as u64)
}

fn encode_text(content: &str, encoding: &str) -> Result<Vec<u8>, String> {
    match encoding {
        "utf-8" => Ok(content.as_bytes().to_vec()),
        "utf-8-bom" => {
            let mut bytes = vec![0xef, 0xbb, 0xbf];
            bytes.extend_from_slice(content.as_bytes());
            Ok(bytes)
        }
        "utf-16le" => {
            let mut bytes = vec![0xff, 0xfe];
            for unit in content.encode_utf16() {
                bytes.extend_from_slice(&unit.to_le_bytes());
            }
            Ok(bytes)
        }
        "utf-16be" => {
            let mut bytes = vec![0xfe, 0xff];
            for unit in content.encode_utf16() {
                bytes.extend_from_slice(&unit.to_be_bytes());
            }
            Ok(bytes)
        }
        "gb18030" => {
            let (bytes, _, had_errors) = encoding_rs::GBK.encode(content);
            if had_errors {
                Err("当前内容包含 GB18030 无法表示的字符，请先另存为 UTF-8 文件".to_string())
            } else {
                Ok(bytes.into_owned())
            }
        }
        _ => Err(format!("不支持的文本编码：{encoding}")),
    }
}

#[tauri::command]
fn take_pending_open_files(pending: State<'_, PendingOpenFiles>) -> Vec<String> {
    let mut paths = pending
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    std::mem::take(&mut *paths)
}

#[tauri::command]
fn read_external_file(path: String) -> Result<serde_json::Value, String> {
    let file_path = PathBuf::from(&path);
    if !file_path.is_file() {
        return Err(format!("文件不存在或不是普通文件：{}", file_path.display()));
    }
    let bytes = fs::read(&file_path)
        .map_err(|error| format!("无法读取文件 {}：{error}", file_path.display()))?;
    Ok(serde_json::json!({
        "bytes": bytes,
        "modifiedAt": modified_at_millis(&file_path),
    }))
}

#[tauri::command]
fn stat_external_files(paths: Vec<String>) -> Vec<serde_json::Value> {
    paths
        .into_iter()
        .map(|path| {
            let file_path = PathBuf::from(&path);
            let exists = file_path.is_file();
            serde_json::json!({
                "path": path,
                "exists": exists,
                "modifiedAt": if exists { modified_at_millis(&file_path) } else { None },
            })
        })
        .collect()
}

fn remote_image_url_allowed(url: &reqwest::Url) -> bool {
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return false;
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    if host.eq_ignore_ascii_case("localhost") || host.ends_with(".localhost") {
        return false;
    }
    match host.parse::<IpAddr>() {
        Ok(IpAddr::V4(address)) => {
            !(address.is_private()
                || address.is_loopback()
                || address.is_link_local()
                || address.is_broadcast()
                || address.is_documentation()
                || address.is_unspecified())
        }
        Ok(IpAddr::V6(address)) => {
            !(address.is_loopback()
                || address.is_unspecified()
                || address.is_unique_local()
                || address.is_unicast_link_local())
        }
        Err(_) => true,
    }
}

#[tauri::command]
async fn fetch_remote_image(url: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let parsed = reqwest::Url::parse(&url).map_err(|error| format!("图片地址无效：{error}"))?;
        if !remote_image_url_allowed(&parsed) {
            return Err("仅支持公开的 HTTP 或 HTTPS 图片地址".to_string());
        }
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(20))
            .redirect(reqwest::redirect::Policy::custom(|attempt| {
                if attempt.previous().len() >= 5 || !remote_image_url_allowed(attempt.url()) {
                    attempt.stop()
                } else {
                    attempt.follow()
                }
            }))
            .user_agent("SiaNotepad/0.1")
            .build()
            .map_err(|error| format!("无法创建图片请求：{error}"))?;
        let response = client
            .get(parsed)
            .send()
            .map_err(|error| format!("无法下载图片：{error}"))?;
        if !response.status().is_success() {
            return Err(format!("图片服务器返回状态码 {}", response.status()));
        }
        if response
            .content_length()
            .is_some_and(|length| length > MAX_REMOTE_IMAGE_BYTES)
        {
            return Err("图片超过 15 MB，已停止加载".to_string());
        }
        let mime_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.split(';').next())
            .map(str::trim)
            .filter(|value| value.starts_with("image/"))
            .ok_or_else(|| "远程地址返回的不是图片".to_string())?
            .to_string();
        let bytes = response
            .bytes()
            .map_err(|error| format!("无法读取图片数据：{error}"))?;
        if bytes.len() as u64 > MAX_REMOTE_IMAGE_BYTES {
            return Err("图片超过 15 MB，已停止加载".to_string());
        }
        Ok(format!(
            "data:{mime_type};base64,{}",
            BASE64_STANDARD.encode(bytes)
        ))
    })
    .await
    .map_err(|error| format!("图片加载任务失败：{error}"))?
}

#[tauri::command]
fn list_directory(path: String) -> Result<serde_json::Value, String> {
    let directory_path = PathBuf::from(&path);
    if !directory_path.is_dir() {
        return Err(format!(
            "文件夹不存在或无法访问：{}",
            directory_path.display()
        ));
    }
    let mut entries = fs::read_dir(&directory_path)
        .map_err(|error| format!("无法读取文件夹 {}：{error}", directory_path.display()))?
        .map(|entry| {
            let entry = entry.map_err(|error| format!("无法读取文件夹项目：{error}"))?;
            let file_type = entry
                .file_type()
                .map_err(|error| format!("无法读取文件类型 {}：{error}", entry.path().display()))?;
            Ok((
                entry.file_name().to_string_lossy().into_owned(),
                entry.path(),
                file_type.is_dir(),
            ))
        })
        .collect::<Result<Vec<_>, String>>()?;
    entries.sort_by(|left, right| {
        right
            .2
            .cmp(&left.2)
            .then_with(|| left.0.to_lowercase().cmp(&right.0.to_lowercase()))
            .then_with(|| left.0.cmp(&right.0))
    });
    Ok(serde_json::Value::Array(
        entries
            .into_iter()
            .map(|(name, path, is_directory)| {
                serde_json::json!({
                    "name": name,
                    "path": path.to_string_lossy(),
                    "isDirectory": is_directory,
                })
            })
            .collect(),
    ))
}

#[tauri::command]
fn rename_directory(path: String, new_name: String) -> Result<String, String> {
    let directory_path = PathBuf::from(&path);
    if !directory_path.is_dir() {
        return Err(format!(
            "文件夹不存在或无法访问：{}",
            directory_path.display()
        ));
    }
    let trimmed_name = new_name.trim();
    if trimmed_name.is_empty()
        || trimmed_name == "."
        || trimmed_name == ".."
        || trimmed_name.contains(['/', '\\'])
    {
        return Err("文件夹名称无效，请输入不包含路径分隔符的名称".to_string());
    }
    let parent = directory_path
        .parent()
        .ok_or_else(|| "无法重命名文件系统根目录".to_string())?;
    let target_path = parent.join(trimmed_name);
    let same_path = if cfg!(target_os = "windows") {
        directory_path
            .to_string_lossy()
            .eq_ignore_ascii_case(&target_path.to_string_lossy())
    } else {
        directory_path == target_path
    };
    if same_path && directory_path == target_path {
        return Ok(directory_path.to_string_lossy().into_owned());
    }
    if target_path.exists() && !same_path {
        return Err(format!("目标文件夹已存在：{}", target_path.display()));
    }
    fs::rename(&directory_path, &target_path).map_err(|error| {
        format!(
            "无法将文件夹 {} 重命名为 {}：{error}",
            directory_path.display(),
            target_path.display()
        )
    })?;
    Ok(target_path.to_string_lossy().into_owned())
}

#[tauri::command]
fn write_external_file(
    path: String,
    file_name: String,
    content: String,
    encoding: String,
    expected_modified_at: Option<u64>,
) -> Result<serde_json::Value, String> {
    let file_path = PathBuf::from(&path);
    if !file_path.is_file() {
        return Err(format!("源文件不存在：{}", file_path.display()));
    }
    if let (Some(expected), Some(current)) = (expected_modified_at, modified_at_millis(&file_path))
    {
        if current != expected {
            return Err("源文件已被其他程序修改，请先还原源文件或另存为后再继续".to_string());
        }
    }

    let bytes = encode_text(&content, &encoding)?;
    let trimmed_file_name = file_name.trim();
    if trimmed_file_name.is_empty()
        || trimmed_file_name == "."
        || trimmed_file_name == ".."
        || trimmed_file_name.contains(['/', '\\'])
    {
        return Err("文件名无效，请输入不包含路径分隔符的文件名".to_string());
    }
    let parent = file_path
        .parent()
        .ok_or_else(|| "无法获取源文件所在目录".to_string())?;
    let target_path = parent.join(trimmed_file_name);
    let same_path = if cfg!(target_os = "windows") {
        file_path
            .to_string_lossy()
            .eq_ignore_ascii_case(&target_path.to_string_lossy())
    } else {
        file_path == target_path
    };

    if same_path {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .truncate(true)
            .open(&file_path)
            .map_err(|error| format!("无法打开源文件 {}：{error}", file_path.display()))?;
        file.write_all(&bytes)
            .and_then(|_| file.sync_all())
            .map_err(|error| format!("无法保存源文件 {}：{error}", file_path.display()))?;
    } else {
        if target_path.exists() {
            return Err(format!("目标文件已存在：{}", target_path.display()));
        }
        let write_result = fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&target_path)
            .and_then(|mut file| file.write_all(&bytes).and_then(|_| file.sync_all()));
        if let Err(error) = write_result {
            let _ = fs::remove_file(&target_path);
            return Err(format!(
                "无法保存重命名后的文件 {}：{error}",
                target_path.display()
            ));
        }
        if let Err(error) = fs::remove_file(&file_path) {
            let _ = fs::remove_file(&target_path);
            return Err(format!(
                "无法移除重命名前的源文件 {}：{error}",
                file_path.display()
            ));
        }
    }

    let saved_path = if same_path { file_path } else { target_path };
    let modified_at = modified_at_millis(&saved_path)
        .ok_or_else(|| "无法读取保存后的文件修改时间".to_string())?;
    Ok(serde_json::json!({
        "path": saved_path.to_string_lossy(),
        "modifiedAt": modified_at,
    }))
}

#[tauri::command]
async fn save_new_external_file(
    app: AppHandle,
    file_name: String,
    extension: String,
    filter_name: String,
    filter_extensions: Vec<String>,
    content: String,
    encoding: String,
) -> Result<Option<serde_json::Value>, String> {
    let parent_window = app.get_webview_window("main");
    tauri::async_runtime::spawn_blocking(move || -> Result<Option<serde_json::Value>, String> {
        let trimmed_extension = extension.trim().trim_start_matches('.');
        let current_extensions = filter_extensions
            .iter()
            .map(|item| item.trim().trim_start_matches('.'))
            .filter(|item| !item.is_empty())
            .collect::<Vec<_>>();
        let mut dialog = rfd::FileDialog::new().set_file_name(file_name.trim());
        if let Some(window) = parent_window.as_ref() {
            dialog = dialog.set_parent(window);
        }
        if !current_extensions.is_empty() {
            dialog = dialog.add_filter(filter_name.trim(), &current_extensions);
        } else if !trimmed_extension.is_empty() {
            dialog = dialog.add_filter(filter_name.trim(), &[trimmed_extension]);
        }
        for (name, extensions) in SAVE_FILE_FILTERS {
            dialog = dialog.add_filter(*name, extensions);
        }
        dialog = dialog.add_filter("所有文件", &["*"]);

        let Some(path) = dialog.save_file() else {
            return Ok(None);
        };
        let bytes = encode_text(&content, &encoding)?;
        let mut file = fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&path)
            .map_err(|error| format!("无法创建文件 {}：{error}", path.display()))?;
        file.write_all(&bytes)
            .and_then(|_| file.sync_all())
            .map_err(|error| format!("无法保存文件 {}：{error}", path.display()))?;
        let modified_at =
            modified_at_millis(&path).ok_or_else(|| "无法读取保存后的文件修改时间".to_string())?;

        Ok(Some(serde_json::json!({
            "path": path.to_string_lossy(),
            "modifiedAt": modified_at,
        })))
    })
    .await
    .map_err(|error| format!("无法打开保存文件窗口：{error}"))?
}

#[tauri::command]
fn open_file_directory(path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err(format!("文件不存在：{}", file_path.display()));
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer.exe")
            .arg("/select,")
            .arg(&file_path)
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("无法打开文件所在目录 {}：{error}", file_path.display()))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = file_path;
        Err("当前平台暂不支持打开文件所在目录".to_string())
    }
}

fn resolve_external_link_target(href: &str, source_path: Option<&str>) -> Result<String, String> {
    let href = href.trim();
    if href.is_empty() || href.starts_with('#') {
        return Err("链接地址为空".to_string());
    }

    let direct_path = PathBuf::from(href);
    if direct_path.is_absolute() {
        return if direct_path.exists() {
            Ok(direct_path.to_string_lossy().into_owned())
        } else {
            Err(format!("链接指向的文件不存在：{}", direct_path.display()))
        };
    }

    if let Ok(url) = reqwest::Url::parse(href) {
        return match url.scheme() {
            "http" | "https" | "mailto" | "ftp" => Ok(href.to_string()),
            "file" => url
                .to_file_path()
                .map_err(|_| "无法解析本地文件链接".to_string())
                .and_then(|path| {
                    if path.exists() {
                        Ok(path.to_string_lossy().into_owned())
                    } else {
                        Err(format!("链接指向的文件不存在：{}", path.display()))
                    }
                }),
            scheme => Err(format!("不支持打开 {scheme} 类型的链接")),
        };
    }

    let path_part = href.split(['#', '?']).next().unwrap_or(href).trim();
    let path = PathBuf::from(path_part);
    let resolved = if path.is_absolute() {
        path
    } else {
        let source_path =
            source_path.ok_or_else(|| "当前笔记没有源文件，无法解析相对链接".to_string())?;
        PathBuf::from(source_path)
            .parent()
            .ok_or_else(|| "无法获取当前 Markdown 文件所在目录".to_string())?
            .join(path)
    };
    if !resolved.exists() {
        return Err(format!("链接指向的文件不存在：{}", resolved.display()));
    }
    Ok(resolved.to_string_lossy().into_owned())
}

#[cfg(target_os = "windows")]
fn open_with_system_default(target: &str) -> Result<(), String> {
    let operation = OsStr::new("open")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let target = OsStr::new(target)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            operation.as_ptr(),
            target.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            1,
        )
    };
    if result > 32 {
        Ok(())
    } else {
        Err(format!("系统默认程序启动失败，错误码：{result}"))
    }
}

#[cfg(not(target_os = "windows"))]
fn open_with_system_default(target: &str) -> Result<(), String> {
    let program = if cfg!(target_os = "macos") {
        "open"
    } else {
        "xdg-open"
    };
    Command::new(program)
        .arg(target)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("无法调用系统默认程序：{error}"))
}

#[tauri::command]
fn open_external_link(href: String, source_path: Option<String>) -> Result<(), String> {
    let target = resolve_external_link_target(&href, source_path.as_deref())?;
    open_with_system_default(&target)
}

#[tauri::command]
async fn pick_text_files() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new()
            .add_filter("文本文件", SUPPORTED_TEXT_EXTENSIONS)
            .pick_files()
            .unwrap_or_default()
            .into_iter()
            .map(|path| path.to_string_lossy().into_owned())
            .collect()
    })
    .await
    .map_err(|error| format!("无法打开文件选择窗口：{error}"))
}

#[tauri::command]
async fn pick_folder() -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        Ok::<_, String>(
            rfd::FileDialog::new()
                .pick_folder()
                .map(|path| path.to_string_lossy().into_owned()),
        )
    })
    .await
    .map_err(|error| format!("无法打开文件夹选择窗口：{error}"))?
}

#[tauri::command]
fn notepad_window_action(app: AppHandle, action: String) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "找不到记事本主窗口".to_string())?;
    match action.as_str() {
        "start-dragging" => window.start_dragging(),
        "minimize" => window.minimize(),
        "toggle-maximize" => {
            if window.is_maximized().map_err(|error| error.to_string())? {
                window.unmaximize()
            } else {
                window.maximize()
            }
        }
        "close" => window.close(),
        _ => return Err(format!("未知窗口操作：{action}")),
    }
    .map_err(|error| error.to_string())
}

pub fn run() {
    #[cfg(target_os = "windows")]
    if let Err(error) = register_windows_file_associations() {
        eprintln!("注册 Windows 文件打开方式失败：{error}");
    }

    let startup_files = file_paths_from_args(env::args_os());
    let mut builder = tauri::Builder::default().manage(PendingOpenFiles(Mutex::new(startup_files)));

    #[cfg(target_os = "windows")]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let paths = file_paths_from_args(args);
            if !paths.is_empty() {
                let pending = app.state::<PendingOpenFiles>();
                pending
                    .0
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner())
                    .extend(paths);
                let _ = app.emit("open-files-pending", ());
            }

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            load_notebook,
            save_notebook,
            notebook_storage_path,
            open_notebook_directory,
            take_pending_open_files,
            read_external_file,
            stat_external_files,
            fetch_remote_image,
            list_directory,
            rename_directory,
            write_external_file,
            save_new_external_file,
            open_file_directory,
            open_external_link,
            pick_text_files,
            pick_folder,
            notepad_window_action,
        ])
        .run(tauri::generate_context!())
        .expect("启动 Sia 记事本失败");
}

#[cfg(test)]
mod tests {
    use super::{
        encode_text, file_paths_from_args, list_directory, modified_at_millis,
        remote_image_url_allowed, rename_directory, resolve_external_link_target,
        write_external_file,
    };
    use std::{env, fs, path::PathBuf};

    #[test]
    fn startup_arguments_keep_existing_unicode_file_paths_only() {
        let file_path =
            env::temp_dir().join(format!("Sia记事本-启动参数-{}.txt", std::process::id()));
        fs::write(&file_path, "中文内容").expect("应能创建启动参数测试文件");
        let missing_path = file_path.with_extension("missing");

        let paths = file_paths_from_args(vec![
            PathBuf::from("sia-notepad.exe"),
            file_path.clone(),
            missing_path,
        ]);

        assert_eq!(
            paths,
            vec![file_path
                .canonicalize()
                .unwrap()
                .to_string_lossy()
                .into_owned()]
        );
        let _ = fs::remove_file(file_path);
    }

    #[test]
    fn saving_external_file_preserves_utf16le_and_chinese_text() {
        let file_path =
            env::temp_dir().join(format!("Sia记事本-源文件保存-{}.txt", std::process::id()));
        fs::write(&file_path, encode_text("初始中文", "utf-16le").unwrap())
            .expect("应能创建 UTF-16LE 测试文件");
        let modified_at = modified_at_millis(&file_path).expect("应能读取测试文件修改时间");

        write_external_file(
            file_path.to_string_lossy().into_owned(),
            file_path
                .file_name()
                .unwrap()
                .to_string_lossy()
                .into_owned(),
            "修改后的中文内容".to_string(),
            "utf-16le".to_string(),
            Some(modified_at),
        )
        .expect("应能按原编码写回源文件");

        let bytes = fs::read(&file_path).expect("应能读取保存后的源文件");
        assert_eq!(&bytes[..2], &[0xff, 0xfe]);
        let units = bytes[2..]
            .chunks_exact(2)
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
            .collect::<Vec<_>>();
        assert_eq!(String::from_utf16(&units).unwrap(), "修改后的中文内容");
        let _ = fs::remove_file(file_path);
    }

    #[test]
    fn saving_external_file_with_a_new_name_moves_the_source_path() {
        let directory =
            env::temp_dir().join(format!("Sia记事本-重命名保存-{}", std::process::id()));
        fs::create_dir_all(&directory).expect("应能创建重命名测试目录");
        let source_path = directory.join("原文件.txt");
        let renamed_path = directory.join("新文件.md");
        fs::write(&source_path, "原始内容").expect("应能创建待重命名源文件");
        let modified_at = modified_at_millis(&source_path).expect("应能读取测试文件修改时间");

        let result = write_external_file(
            source_path.to_string_lossy().into_owned(),
            "新文件.md".to_string(),
            "重命名后的中文内容".to_string(),
            "utf-8".to_string(),
            Some(modified_at),
        )
        .expect("保存时应能同步更新源文件路径");

        assert!(!source_path.exists());
        assert_eq!(
            fs::read_to_string(&renamed_path).unwrap(),
            "重命名后的中文内容"
        );
        assert_eq!(result["path"], renamed_path.to_string_lossy().as_ref());
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn gb18030_encoding_round_trips_chinese_text() {
        let bytes = encode_text("简体中文内容", "gb18030").expect("应能编码 GB18030 中文");
        let (decoded, _, had_errors) = encoding_rs::GBK.decode(&bytes);
        assert!(!had_errors);
        assert_eq!(decoded, "简体中文内容");
    }

    #[test]
    fn directory_listing_keeps_unicode_names_and_sorts_folders_first() {
        let directory = env::temp_dir().join(format!("Sia记事本-文件树-{}", std::process::id()));
        let child_directory = directory.join("中文文件夹");
        fs::create_dir_all(&child_directory).expect("应能创建中文测试文件夹");
        fs::write(directory.join("说明.md"), "内容").expect("应能创建中文测试文件");

        let result =
            list_directory(directory.to_string_lossy().into_owned()).expect("应能读取文件夹树节点");
        let entries = result.as_array().expect("目录结果应为数组");
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0]["name"], "中文文件夹");
        assert_eq!(entries[0]["isDirectory"], true);
        assert_eq!(entries[1]["name"], "说明.md");
        assert_eq!(entries[1]["isDirectory"], false);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn renaming_directory_preserves_unicode_children() {
        let parent = env::temp_dir().join(format!("Sia记事本-文件夹重命名-{}", std::process::id()));
        let source = parent.join("原文件夹");
        fs::create_dir_all(&source).expect("应能创建待重命名文件夹");
        fs::write(source.join("中文内容.md"), "内容").expect("应能创建中文子文件");

        let result = rename_directory(
            source.to_string_lossy().into_owned(),
            "新文件夹".to_string(),
        )
        .expect("应能重命名中文文件夹");
        let target = parent.join("新文件夹");

        assert_eq!(result, target.to_string_lossy());
        assert!(!source.exists());
        assert_eq!(
            fs::read_to_string(target.join("中文内容.md")).unwrap(),
            "内容"
        );
        let _ = fs::remove_dir_all(parent);
    }

    #[test]
    fn remote_image_fallback_rejects_local_network_addresses() {
        assert!(remote_image_url_allowed(
            &reqwest::Url::parse("https://cdn.nlark.com/image.png").unwrap()
        ));
        assert!(!remote_image_url_allowed(
            &reqwest::Url::parse("http://localhost/image.png").unwrap()
        ));
        assert!(!remote_image_url_allowed(
            &reqwest::Url::parse("http://127.0.0.1/image.png").unwrap()
        ));
        assert!(!remote_image_url_allowed(
            &reqwest::Url::parse("http://192.168.1.10/image.png").unwrap()
        ));
    }

    #[test]
    fn relative_markdown_link_resolves_from_source_file_directory() {
        let directory = env::temp_dir().join(format!("Sia记事本-预览链接-{}", std::process::id()));
        fs::create_dir_all(&directory).expect("应能创建预览链接测试目录");
        let markdown_path = directory.join("产品文档.md");
        let linked_path = directory.join("页面原型.html");
        fs::write(&markdown_path, "[页面原型](页面原型.html)").expect("应能创建 Markdown 文件");
        fs::write(&linked_path, "<h1>页面原型</h1>").expect("应能创建链接目标文件");

        let resolved = resolve_external_link_target(
            "页面原型.html",
            Some(markdown_path.to_string_lossy().as_ref()),
        )
        .expect("应从 Markdown 源文件目录解析相对链接");

        assert_eq!(PathBuf::from(resolved), linked_path);
        let _ = fs::remove_dir_all(directory);
    }
}
