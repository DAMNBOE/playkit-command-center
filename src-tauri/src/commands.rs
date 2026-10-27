// Native commands for AfScripts. Names must match src/services/commands.ts (NATIVE_COMMANDS).
// Each one is a stub that returns an error until the real Windows logic is written.
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalFileEntry { name: String, path: String, size_bytes: u64, is_directory: bool, modified_at: String }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedGame { app_id: u32, name: String, install_path: String, size_bytes: u64 }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupResult { backup_path: String }

#[derive(Deserialize)]
pub struct PresetFile { pub path: String, pub content: String }

fn todo<T>(cmd: &str) -> Result<T, String> { Err(format!("{cmd} is not implemented yet")) }

#[tauri::command] pub fn scan_library(library_path: String) -> Result<Vec<DetectedGame>, String> { let _ = library_path; todo("scan_library") }
#[tauri::command] pub fn detect_install_path(app_id: u32, name: String) -> Result<Option<String>, String> { let _ = (app_id, name); todo("detect_install_path") }
#[tauri::command] pub fn list_game_files(install_path: String) -> Result<Vec<LocalFileEntry>, String> { let _ = install_path; todo("list_game_files") }
#[tauri::command] pub fn read_config_file(path: String) -> Result<Option<String>, String> { let _ = path; todo("read_config_file") }
#[tauri::command] pub fn write_config_file(path: String, content: String) -> Result<(), String> { let _ = (path, content); todo("write_config_file") }
#[tauri::command] pub fn create_backup(path: String, content: String) -> Result<BackupResult, String> { let _ = (path, content); todo("create_backup") }
#[tauri::command] pub fn restore_backup(backup_path: String) -> Result<Option<String>, String> { let _ = backup_path; todo("restore_backup") }
#[tauri::command] pub fn apply_preset(game_id: String, files: Vec<PresetFile>) -> Result<(), String> { let _ = (game_id, files); todo("apply_preset") }
#[tauri::command] pub fn start_download(id: String, url: String) -> Result<(), String> { let _ = (id, url); todo("start_download") }
#[tauri::command] pub fn pause_download(id: String) -> Result<(), String> { let _ = id; todo("pause_download") }
#[tauri::command] pub fn cancel_download(id: String) -> Result<(), String> { let _ = id; todo("cancel_download") }

#[tauri::command]
pub fn window_action(window: tauri::Window, action: String) -> Result<(), String> {
    match action.as_str() {
        "minimize" => window.minimize(),
        "maximize" => if window.is_maximized().unwrap_or(false) { window.unmaximize() } else { window.maximize() },
        "close" => window.close(),
        _ => return Err(format!("unknown window action {action}")),
    }.map_err(|e| e.to_string())
}
