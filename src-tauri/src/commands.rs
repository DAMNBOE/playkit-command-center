// Native commands for AfScripts. Names must match src/services/commands.ts (NATIVE_COMMANDS).
// These run only inside the packaged Windows app.
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, Emitter};

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

const MAX_CONFIG_BYTES: u64 = 4 * 1024 * 1024;
const CONFIG_EXTS: &[&str] = &["ini", "cfg", "json", "xml", "lua", "txt", "lsx", "settings", "yaml", "yml", "toml", "vdf"];

fn err<E: std::fmt::Display>(e: E) -> String { e.to_string() }

fn iso(t: std::time::SystemTime) -> String {
    chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339()
}

/// Only plain-text config files may be read or written — never executables or arbitrary binaries.
fn check_config_path(path: &str) -> Result<PathBuf, String> {
    let p = PathBuf::from(path);
    if !p.is_absolute() { return Err("Path must be absolute".into()); }
    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
    if !CONFIG_EXTS.contains(&ext.as_str()) { return Err(format!("'.{ext}' files are not editable config files")); }
    Ok(p)
}

// ---------------- Steam library ----------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamSearchResult { app_id: u32, name: String, image: String }

/// A static desktop bundle has no web RPC server. Fetch public metadata natively.
#[tauri::command]
pub async fn lookup_steam_app(app_id: u32) -> Result<Vec<SteamSearchResult>, String> {
    if app_id == 0 { return Ok(vec![]); }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build().map_err(err)?;
    let response = client.get("https://store.steampowered.com/api/appdetails")
        .query(&[("appids", app_id.to_string()), ("filters", "basic".to_string())])
        .send().await.map_err(|_| "Could not reach Steam. Check your connection and try again.".to_string())?
        .error_for_status().map_err(|_| "Steam is temporarily unavailable. Try again.".to_string())?;
    let text = response.text().await.map_err(err)?;
    let catalog: serde_json::Value = serde_json::from_str(&text).map_err(|_| "Steam returned an invalid response.".to_string())?;
    let entry = &catalog[app_id.to_string()];
    if entry["success"].as_bool() != Some(true) { return Ok(vec![]); }
    let data = &entry["data"];
    let name = data["name"].as_str().ok_or("Steam returned an invalid game name.")?;
    let image = data["header_image"].as_str().unwrap_or("");
    Ok(vec![SteamSearchResult { app_id, name: name.to_string(), image: image.to_string() }])
}

fn steam_root() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        use winreg::{enums::HKEY_CURRENT_USER, RegKey};
        if let Ok(k) = RegKey::predef(HKEY_CURRENT_USER).open_subkey("Software\\Valve\\Steam") {
            if let Ok(p) = k.get_value::<String, _>("SteamPath") { return Some(PathBuf::from(p.replace('/', "\\"))); }
        }
        let def = PathBuf::from("C:\\Program Files (x86)\\Steam");
        if def.exists() { return Some(def); }
    }
    None
}

/// Pull every `"key" "value"` pair out of a Valve KeyValues (.vdf / .acf) file.
fn vdf_pairs(text: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    for line in text.lines() {
        let parts: Vec<&str> = line.split('"').collect();
        if parts.len() >= 5 { out.push((parts[1].to_ascii_lowercase(), parts[3].replace("\\\\", "\\"))); }
    }
    out
}

fn library_folders(extra: &str) -> Vec<PathBuf> {
    let mut libs: Vec<PathBuf> = Vec::new();
    if !extra.trim().is_empty() { libs.push(PathBuf::from(extra.trim())); }
    if let Some(root) = steam_root() {
        libs.push(root.clone());
        if let Ok(t) = fs::read_to_string(root.join("steamapps").join("libraryfolders.vdf")) {
            for (k, v) in vdf_pairs(&t) { if k == "path" { libs.push(PathBuf::from(v)); } }
        }
    }
    let mut seen = std::collections::HashSet::new();
    libs.into_iter()
        .map(|p| if p.ends_with("steamapps") { p.parent().map(Path::to_path_buf).unwrap_or(p) } else { p })
        .filter(|p| seen.insert(p.to_string_lossy().to_ascii_lowercase()))
        .collect()
}

fn read_manifests(lib: &Path) -> Vec<DetectedGame> {
    let apps = lib.join("steamapps");
    let Ok(rd) = fs::read_dir(&apps) else { return vec![] };
    rd.flatten().filter_map(|e| {
        let name = e.file_name().to_string_lossy().to_string();
        if !(name.starts_with("appmanifest_") && name.ends_with(".acf")) { return None; }
        let kv: HashMap<String, String> = vdf_pairs(&fs::read_to_string(e.path()).ok()?).into_iter().collect();
        Some(DetectedGame {
            app_id: kv.get("appid")?.parse().ok()?,
            name: kv.get("name")?.clone(),
            install_path: apps.join("common").join(kv.get("installdir")?).to_string_lossy().to_string(),
            size_bytes: kv.get("sizeondisk").and_then(|s| s.parse().ok()).unwrap_or(0),
        })
    }).collect()
}

#[tauri::command]
pub fn scan_library(library_path: String) -> Result<Vec<DetectedGame>, String> {
    let libs = library_folders(&library_path);
    if libs.is_empty() { return Err("Steam was not found on this PC. Set the library folder in Settings.".into()); }
    let mut games: Vec<DetectedGame> = libs.iter().flat_map(|l| read_manifests(l)).collect();
    games.sort_by(|a, b| a.name.cmp(&b.name));
    games.dedup_by_key(|g| g.app_id);
    Ok(games)
}

#[tauri::command]
pub fn detect_install_path(app_id: u32, name: String) -> Result<Option<String>, String> {
    let _ = name;
    Ok(scan_library(String::new()).unwrap_or_default().into_iter().find(|g| g.app_id == app_id).map(|g| g.install_path))
}

#[tauri::command]
pub fn list_game_files(install_path: String) -> Result<Vec<LocalFileEntry>, String> {
    let root = PathBuf::from(&install_path);
    if !root.is_dir() { return Err(format!("Folder not found: {install_path}")); }
    let mut out = Vec::new();
    let mut stack = vec![(root, 0u8)];
    while let Some((dir, depth)) = stack.pop() {
        for e in fs::read_dir(&dir).map_err(err)?.flatten() {
            let Ok(md) = e.metadata() else { continue };
            let path = e.path();
            if md.is_dir() && depth < 3 { stack.push((path.clone(), depth + 1)); }
            out.push(LocalFileEntry {
                name: e.file_name().to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
                size_bytes: md.len(),
                is_directory: md.is_dir(),
                modified_at: md.modified().map(iso).unwrap_or_default(),
            });
            if out.len() >= 2000 { return Ok(out); }
        }
    }
    Ok(out)
}

// ---------------- Config files & backups ----------------

#[tauri::command]
pub fn read_config_file(path: String) -> Result<Option<String>, String> {
    let p = check_config_path(&path)?;
    if !p.exists() { return Ok(None); }
    if fs::metadata(&p).map_err(err)?.len() > MAX_CONFIG_BYTES { return Err("File is larger than 4 MB".into()); }
    fs::read_to_string(&p).map(Some).map_err(err)
}

#[tauri::command]
pub fn write_config_file(path: String, content: String) -> Result<(), String> {
    let p = check_config_path(&path)?;
    if let Some(dir) = p.parent() { fs::create_dir_all(dir).map_err(err)?; }
    // Write to a temp file then rename so a crash never leaves a half-written config.
    let tmp = p.with_extension("afscripts-tmp");
    fs::write(&tmp, content).map_err(err)?;
    fs::rename(&tmp, &p).map_err(err)
}

fn backup_dir() -> Result<PathBuf, String> {
    let d = dirs::data_dir().ok_or("No AppData folder")?.join("AfScripts").join("backups");
    fs::create_dir_all(&d).map_err(err)?;
    Ok(d)
}

#[tauri::command]
pub fn create_backup(path: String, content: String) -> Result<BackupResult, String> {
    let p = check_config_path(&path)?;
    let file = p.file_name().map(|f| f.to_string_lossy().to_string()).unwrap_or_else(|| "config".into());
    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let dest = backup_dir()?.join(format!("{file}.{stamp}.bak"));
    // Back up what is on disk if it exists; otherwise the editor's current content.
    let data = fs::read_to_string(&p).unwrap_or(content);
    let meta = serde_json::json!({ "original": path });
    fs::write(&dest, data).map_err(err)?;
    fs::write(dest.with_extension("bak.json"), meta.to_string()).map_err(err)?;
    Ok(BackupResult { backup_path: dest.to_string_lossy().to_string() })
}

#[tauri::command]
pub fn restore_backup(backup_path: String) -> Result<Option<String>, String> {
    let p = PathBuf::from(&backup_path);
    if !p.starts_with(backup_dir()?) { return Err("Not an AfScripts backup".into()); }
    if !p.exists() { return Ok(None); }
    let content = fs::read_to_string(&p).map_err(err)?;
    if let Ok(meta) = fs::read_to_string(p.with_extension("bak.json")) {
        if let Some(orig) = serde_json::from_str::<serde_json::Value>(&meta).ok().and_then(|v| v["original"].as_str().map(String::from)) {
            write_config_file(orig, content.clone())?;
        }
    }
    Ok(Some(content))
}

#[tauri::command]
pub fn apply_preset(game_id: String, files: Vec<PresetFile>) -> Result<(), String> {
    let _ = game_id;
    for f in &files { check_config_path(&f.path)?; }
    for f in files {
        if Path::new(&f.path).exists() { create_backup(f.path.clone(), String::new())?; }
        write_config_file(f.path, f.content)?;
    }
    Ok(())
}

// ---------------- Downloads (plain HTTP(S) files into Downloads\AfScripts) ----------------
// state: 0 = running, 1 = paused, 2 = cancelled

fn jobs() -> &'static Mutex<HashMap<String, Arc<AtomicU8>>> {
    static J: OnceLock<Mutex<HashMap<String, Arc<AtomicU8>>>> = OnceLock::new();
    J.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Progress { id: String, received: u64, total: u64, status: &'static str, path: String, error: Option<String> }

#[tauri::command]
pub fn start_download(app: AppHandle, id: String, url: String) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) { return Err("Only http(s) links can be downloaded".into()); }
    if let Some(flag) = jobs().lock().unwrap().get(&id) { flag.store(0, Ordering::SeqCst); return Ok(()); } // resume
    let flag = Arc::new(AtomicU8::new(0));
    jobs().lock().unwrap().insert(id.clone(), flag.clone());
    let dir = dirs::download_dir().ok_or("No Downloads folder")?.join("AfScripts");
    fs::create_dir_all(&dir).map_err(err)?;
    let name = url.rsplit('/').next().filter(|s| !s.is_empty()).unwrap_or("download").split('?').next().unwrap_or("download").to_string();
    let dest = dir.join(name);
    std::thread::spawn(move || {
        let emit = |received, total, status, error: Option<String>| {
            let _ = app.emit("download://progress", Progress { id: id.clone(), received, total, status, path: dest.to_string_lossy().to_string(), error });
        };
        let result = (|| -> Result<Option<(u64, u64)>, String> {
            let mut resp = reqwest::blocking::get(&url).map_err(err)?.error_for_status().map_err(err)?;
            let total = resp.content_length().unwrap_or(0);
            let mut out = fs::File::create(&dest).map_err(err)?;
            let (mut got, mut buf, mut last) = (0u64, vec![0u8; 64 * 1024], std::time::Instant::now());
            loop {
                match flag.load(Ordering::SeqCst) {
                    2 => { drop(out); let _ = fs::remove_file(&dest); return Ok(None); }
                    1 => { std::thread::sleep(std::time::Duration::from_millis(200)); continue; }
                    _ => {}
                }
                let n = resp.read(&mut buf).map_err(err)?;
                if n == 0 { break; }
                out.write_all(&buf[..n]).map_err(err)?;
                got += n as u64;
                if last.elapsed().as_millis() > 300 { emit(got, total, "active", None); last = std::time::Instant::now(); }
            }
            Ok(Some((got, total)))
        })();
        match result {
            Ok(Some((g, t))) => emit(g, t.max(g), "completed", None),
            Ok(None) => emit(0, 0, "cancelled", None),
            Err(e) => emit(0, 0, "failed", Some(e)),
        }
        jobs().lock().unwrap().remove(&id);
    });
    Ok(())
}

#[tauri::command]
pub fn pause_download(id: String) -> Result<(), String> {
    jobs().lock().unwrap().get(&id).ok_or("Download is not running")?.store(1, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn cancel_download(id: String) -> Result<(), String> {
    if let Some(f) = jobs().lock().unwrap().get(&id) { f.store(2, Ordering::SeqCst); }
    Ok(())
}

#[tauri::command]
pub fn window_action(window: tauri::Window, action: String) -> Result<(), String> {
    match action.as_str() {
        "minimize" => window.minimize(),
        "maximize" => if window.is_maximized().unwrap_or(false) { window.unmaximize() } else { window.maximize() },
        "close" => window.close(),
        _ => return Err(format!("unknown window action {action}")),
    }.map_err(|e| e.to_string())
}
