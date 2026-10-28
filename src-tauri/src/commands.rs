// Native commands for AfScripts. Names must match src/services/commands.ts (NATIVE_COMMANDS).
// These run only inside the packaged Windows app.
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
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

fn err<E: std::fmt::Display>(e: E) -> String { e.to_string() }
fn iso(t: std::time::SystemTime) -> String { chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339() }
fn authorized() -> &'static Mutex<std::collections::HashSet<PathBuf>> {
    static A: OnceLock<Mutex<std::collections::HashSet<PathBuf>>> = OnceLock::new();
    A.get_or_init(|| Mutex::new(std::collections::HashSet::new()))
}
fn check_config_path(path: &str) -> Result<PathBuf, String> {
    let p = crate::files::validate(Path::new(path))?;
    let selected = authorized().lock().map_err(err)?.contains(&p);
    let installed = library_folders("").iter().flat_map(|l| read_manifests(l)).any(|g| fs::canonicalize(g.install_path).map(|root| p.starts_with(root)).unwrap_or(false));
    if !selected && !installed { return Err("Select this configuration file in AfScripts before accessing it".into()); }
    Ok(p)
}
#[tauri::command]
pub fn select_config_file() -> Result<Option<String>, String> {
    #[cfg(windows)] {
        let selected = rfd::FileDialog::new().add_filter("Text configurations", &["ini","cfg","json","xml","lua","txt","lsx","settings","yaml","yml","toml","vdf"]).pick_file();
        if let Some(path) = selected { let p = crate::files::validate(&path)?; authorized().lock().map_err(err)?.insert(p.clone()); return Ok(Some(p.to_string_lossy().into_owned())); }
        return Ok(None);
    }
    #[cfg(not(windows))] { Err("Configuration selection requires Windows".into()) }
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
fn vdf_pairs(text: &str) -> Vec<(String, String)> { crate::files::pairs(text) }

fn remembered_libraries() -> &'static Mutex<Vec<PathBuf>> {
    static L: OnceLock<Mutex<Vec<PathBuf>>> = OnceLock::new(); L.get_or_init(|| Mutex::new(Vec::new()))
}
fn library_folders(extra: &str) -> Vec<PathBuf> {
    let mut libs: Vec<PathBuf> = remembered_libraries().lock().map(|l|l.clone()).unwrap_or_default();
    if !extra.trim().is_empty() { libs.push(PathBuf::from(extra.trim())); }
    if let Some(root) = steam_root() {
        libs.push(root.clone());
        if let Ok(t) = fs::read_to_string(root.join("steamapps").join("libraryfolders.vdf")) {
            for (k, v) in vdf_pairs(&t) { if k == "path" || k.parse::<u32>().is_ok() && Path::new(&v).is_absolute() { libs.push(PathBuf::from(v)); } }
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
        let folder = PathBuf::from(kv.get("installdir")?);
        if folder.components().count() != 1 || !matches!(folder.components().next(), Some(std::path::Component::Normal(_))) { return None; }
        let install = fs::canonicalize(apps.join("common").join(folder)).ok()?;
        let common=fs::canonicalize(apps.join("common")).ok()?;
        if !install.is_dir() || !install.starts_with(common) { return None; }
        Some(DetectedGame {
            app_id: kv.get("appid")?.parse().ok()?,
            name: kv.get("name")?.clone(),
            install_path: install.to_string_lossy().to_string(),
            size_bytes: 0,
        })
    }).collect()
}

#[tauri::command]
pub fn scan_library(library_path: String) -> Result<Vec<DetectedGame>, String> {
    let libs = library_folders(&library_path);
    if libs.is_empty() { return Err("Steam was not found on this PC. Set the library folder in Settings.".into()); }
    *remembered_libraries().lock().map_err(err)?=libs.clone();
    let mut games: Vec<DetectedGame> = libs.iter().flat_map(|l| read_manifests(l)).collect();
    let mut seen = std::collections::HashSet::new();
    games.retain(|g| seen.insert(g.app_id));
    for game in &mut games { game.size_bytes = crate::files::disk_usage(Path::new(&game.install_path)).map_err(|e| format!("Could not measure {}: {e}", game.name))?; }
    if !libs.iter().any(|p| p.join("steamapps").is_dir()) { return Err("No accessible Steam library folders were found".into()); }
    games.sort_by(|a,b| a.name.cmp(&b.name));
    Ok(games)
}

#[tauri::command]
pub fn detect_install_path(app_id: u32, name: String) -> Result<Option<String>, String> {
    let _ = name;
    Ok(scan_library(String::new())?.into_iter().find(|g| g.app_id == app_id).map(|g| g.install_path))
}

#[tauri::command]
pub fn list_game_files(install_path: String) -> Result<Vec<LocalFileEntry>, String> {
    let root = fs::canonicalize(&install_path).map_err(err)?;
    let valid = library_folders("").iter().flat_map(|l| read_manifests(l)).any(|g| fs::canonicalize(g.install_path).map(|p| p == root).unwrap_or(false));
    if !valid { return Err("Folder is not a detected Steam installation".into()); }
    if !root.is_dir() { return Err(format!("Folder not found: {install_path}")); }
    let mut out = Vec::new();
    let mut stack = vec![(root, 0u8)];
    while let Some((dir, depth)) = stack.pop() {
        for e in fs::read_dir(&dir).map_err(err)?.flatten() {
            let Ok(md) = fs::symlink_metadata(e.path()) else { continue };
            if crate::files::is_link(&md) { continue; }
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
pub fn read_config_file(path: String) -> Result<Option<String>, String> { crate::files::read(&check_config_path(&path)?).map(Some) }
fn backup_dir() -> Result<PathBuf, String> {
    let d = dirs::data_dir().ok_or("No AppData folder")?.join("AfScripts").join("backups");
    fs::create_dir_all(&d).map_err(err)?; Ok(d)
}
fn record_backup(path: &Path, dest: &Path) -> Result<(), String> {
    let meta = serde_json::json!({ "original": path.to_string_lossy(), "createdAt": iso(std::time::SystemTime::now()) });
    fs::write(dest.with_extension("bak.json"), meta.to_string()).map_err(err)
}
#[tauri::command]
pub fn create_backup(path: String, content: String) -> Result<BackupResult, String> {
    let _ = content; let p = check_config_path(&path)?;
    let dest = crate::files::backup(&p, &backup_dir()?)?;
    record_backup(&p, &dest)?; Ok(BackupResult { backup_path: dest.to_string_lossy().into_owned() })
}
#[tauri::command]
pub fn write_config_file(path: String, content: String) -> Result<(), String> {
    let p = check_config_path(&path)?;
    crate::files::replace_recorded(&p, &content, &backup_dir()?, record_backup)?; Ok(())
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupEntry { backup_path: String, created_at: String, content: String }
#[tauri::command]
pub fn list_backups(path: String) -> Result<Vec<BackupEntry>, String> {
    let p = check_config_path(&path)?;
    let mut result = Vec::new();
    for entry in fs::read_dir(backup_dir()?).map_err(err)? {
        let entry=entry.map_err(err)?; let file=entry.path();
        if file.extension().and_then(|e| e.to_str()) != Some("bak") { continue; }
        let Ok(meta) = fs::read_to_string(file.with_extension("bak.json")) else { continue; };
        let meta: serde_json::Value=serde_json::from_str(&meta).map_err(err)?;
        if meta["original"].as_str() != Some(p.to_string_lossy().as_ref()) { continue; }
        result.push(BackupEntry { backup_path:file.to_string_lossy().into_owned(), created_at:meta["createdAt"].as_str().unwrap_or("").into(), content:fs::read_to_string(file).map_err(err)? });
    }
    result.sort_by(|a,b| b.created_at.cmp(&a.created_at)); Ok(result)
}
#[tauri::command]
pub fn restore_backup(backup_path: String) -> Result<Option<String>, String> {
    let raw = PathBuf::from(&backup_path);
    if raw.components().any(|c| matches!(c, std::path::Component::ParentDir)) { return Err("Invalid backup path".into()); }
    let p=fs::canonicalize(raw).map_err(err)?;
    if p.parent() != Some(fs::canonicalize(backup_dir()?).map_err(err)?.as_path()) || p.extension().and_then(|e|e.to_str()) != Some("bak") { return Err("Not an AfScripts backup".into()); }
    let meta: serde_json::Value=serde_json::from_str(&fs::read_to_string(p.with_extension("bak.json")).map_err(err)?).map_err(err)?;
    let orig=meta["original"].as_str().ok_or("Missing original backup path")?;
    let content=fs::read_to_string(&p).map_err(err)?;
    write_config_file(orig.into(), content)?;
    read_config_file(orig.into())
}
#[tauri::command]
pub fn apply_preset(game_id: String, files: Vec<PresetFile>) -> Result<(), String> {
    let app_id=game_id.parse::<u32>().map_err(|_| "Invalid Steam App ID")?;
    if !library_folders("").iter().flat_map(|l| read_manifests(l)).any(|g| g.app_id==app_id) { return Err("Game is not installed through Steam".into()); }
    if files.is_empty() { return Err("Preset contains no files".into()); }
    let mut seen=std::collections::HashSet::new();
    let mut previous=Vec::new();
    for f in &files { let p=check_config_path(&f.path)?; if !seen.insert(p.clone()) { return Err("Duplicate preset target".into()); } if f.content.len()>crate::files::MAX_BYTES { return Err("Preset file exceeds 4 MB".into()); } previous.push(crate::files::read(&p)?); }
    for (i,f) in files.iter().enumerate() {
        if let Err(e)=write_config_file(f.path.clone(),f.content.clone()) {
            let mut failures=Vec::new();
            for j in (0..i).rev() { if let Err(r)=write_config_file(files[j].path.clone(),previous[j].clone()) { failures.push(r); } }
            return Err(format!("Preset failed: {e}. Rollback errors: {}", failures.join("; ")));
        }
    }
    Ok(())
}
#[tauri::command]
pub fn launch_game(app_id: u32) -> Result<(), String> {
    if !library_folders("").iter().flat_map(|l| read_manifests(l)).any(|g| g.app_id==app_id) { return Err("Game is not installed through Steam".into()); }
    #[cfg(windows)] { let exe=steam_root().ok_or("Steam not found")?.join("steam.exe"); std::process::Command::new(exe).arg(format!("steam://run/{app_id}")).spawn().map_err(err)?; Ok(()) }
    #[cfg(not(windows))] { Err("Steam launch requires Windows".into()) }
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

fn blocked_ip(ip: std::net::IpAddr) -> bool {
    match ip {
        std::net::IpAddr::V4(v) => v.is_private() || v.is_loopback() || v.is_link_local() || v.is_unspecified() || v.is_multicast() || v.is_broadcast() || v.octets()[0]==0 || v.octets()[0]>=240 || v.octets()[0]==100 && (64..=127).contains(&v.octets()[1]),
        std::net::IpAddr::V6(v) => v.is_loopback() || v.is_unspecified() || v.is_multicast() || (v.segments()[0] & 0xfe00)==0xfc00 || (v.segments()[0] & 0xffc0)==0xfe80 || v.to_ipv4_mapped().map(|v|blocked_ip(std::net::IpAddr::V4(v))).unwrap_or(false),
    }
}
struct PublicDns;
impl reqwest::dns::Resolve for PublicDns {
    fn resolve(&self, name: reqwest::dns::Name) -> reqwest::dns::Resolving {
        let host=name.as_str().to_string();
        Box::pin(async move {
            let resolved: Vec<_> = tokio::net::lookup_host((host.as_str(),0)).await?.collect();
            if resolved.is_empty() || resolved.iter().any(|a|blocked_ip(a.ip())) { return Err(Box::new(std::io::Error::new(std::io::ErrorKind::PermissionDenied,"DNS resolved to a local or reserved network")) as Box<dyn std::error::Error+Send+Sync>); }
            Ok(Box::new(resolved.into_iter()) as reqwest::dns::Addrs)
        })
    }
}
fn validate_download_url(url: &reqwest::Url) -> Result<(), String> {
    if !["http","https"].contains(&url.scheme()) || !url.username().is_empty() || url.password().is_some() { return Err("Only public HTTP(S) file links without credentials are supported".into()); }
    let host=url.host_str().ok_or("URL has no host")?;
    let lower=host.to_ascii_lowercase();
    if lower=="localhost" || lower.ends_with(".localhost") || lower.ends_with(".local") || !lower.contains('.') && !lower.contains(':') { return Err("Local network downloads are not supported".into()); }
    if let Ok(ip)=host.trim_matches(|c| c=='[' || c==']').parse::<std::net::IpAddr>() {
        let blocked = blocked_ip(ip);
        if blocked { return Err("Local network downloads are not supported".into()); }
    }
    Ok(())
}
#[tauri::command]
pub fn start_download(app: AppHandle, id: String, url: String, download_path: String) -> Result<(), String> {
    let parsed = reqwest::Url::parse(&url).map_err(err)?;
    validate_download_url(&parsed)?;
    if !parsed.username().is_empty() || parsed.password().is_some() { return Err("Download URL must not contain credentials".into()); }
    if !(url.starts_with("https://") || url.starts_with("http://")) { return Err("Only http(s) links can be downloaded".into()); }
    if let Some(flag) = jobs().lock().unwrap().get(&id) { flag.store(0, Ordering::SeqCst); return Ok(()); } // resume
    let flag = Arc::new(AtomicU8::new(0));

    let dir = if download_path.trim().is_empty() { dirs::download_dir().ok_or("No Downloads folder")?.join("AfScripts") } else { let p=PathBuf::from(download_path); if !p.is_absolute() { jobs().lock().map_err(err)?.remove(&id); return Err("Download folder must be absolute".into()); } p };
    let dir = fs::canonicalize(&dir).or_else(|_| { fs::create_dir_all(&dir)?; fs::canonicalize(&dir) }).map_err(err)?;
    fs::create_dir_all(&dir).map_err(err)?;
    let name = crate::files::safe_filename(parsed.path_segments().and_then(|s|s.last()).filter(|s| !s.is_empty()).unwrap_or("download"))?;
    let dest = dir.join(format!("{}-{name}", crate::files::unique()));
    let partial = dest.with_extension("afscripts-part");
    jobs().lock().map_err(err)?.insert(id.clone(), flag.clone());
    tauri::async_runtime::spawn(async move {
        let emit = |received, total, status, error: Option<String>| {
            let _ = app.emit("download://progress", Progress { id: id.clone(), received, total, status, path: dest.to_string_lossy().to_string(), error });
        };
        let result = async {
            let client = reqwest::Client::builder().no_proxy().dns_resolver(Arc::new(PublicDns)).timeout(std::time::Duration::from_secs(3600)).connect_timeout(std::time::Duration::from_secs(15))
                .redirect(reqwest::redirect::Policy::custom(|attempt| {
                    if attempt.previous().len() >= 5 { return attempt.error("Too many redirects"); }
                    match validate_download_url(attempt.url()) { Ok(()) => attempt.follow(), Err(e) => attempt.error(e) }
                })).build().map_err(err)?;
            let request = client.get(&url).send();
            tokio::pin!(request);
            let mut response = loop {
                tokio::select! {
                    r = &mut request => break r.map_err(err)?.error_for_status().map_err(err)?,
                    _ = tokio::time::sleep(std::time::Duration::from_millis(100)) => { if flag.load(Ordering::SeqCst)==2 { return Ok(None); } }
                }
            };
            let total = response.content_length().unwrap_or(0);
            let mut out = fs::OpenOptions::new().write(true).create_new(true).open(&partial).map_err(err)?;
            let mut got = 0u64;
            let mut last = std::time::Instant::now();
            loop {
                while flag.load(Ordering::SeqCst)==1 { tokio::time::sleep(std::time::Duration::from_millis(100)).await; }
                if flag.load(Ordering::SeqCst)==2 { return Ok(None); }
                let chunk = response.chunk();
                tokio::pin!(chunk);
                let deadline = tokio::time::sleep(std::time::Duration::from_secs(60));
                tokio::pin!(deadline);
                let data = loop {
                    tokio::select! {
                        r = &mut chunk => break r.map_err(err)?,
                        _ = &mut deadline => return Err("Download stalled for 60 seconds".into()),
                        _ = tokio::time::sleep(std::time::Duration::from_millis(100)) => { if flag.load(Ordering::SeqCst)==2 { return Ok(None); } }
                    }
                };
                let Some(data)=data else { break; };
                out.write_all(&data).map_err(err)?;
                got += data.len() as u64;
                if last.elapsed().as_millis() >= 300 { emit(got,total,"active",None); last=std::time::Instant::now(); }
            }
            if flag.load(Ordering::SeqCst)==2 { return Ok(None); }
            out.sync_all().map_err(err)?; drop(out);
            fs::rename(&partial,&dest).map_err(err)?;
            Ok(Some((got,total)))
        }.await;
        jobs().lock().map(|mut j| j.remove(&id)).ok();
        match result {
            Ok(Some((g,t))) => emit(g,t.max(g),"completed",None),
            Ok(None) => { let _=fs::remove_file(&partial); emit(0,0,"cancelled",None); }
            Err(e) => { let _=fs::remove_file(&partial); emit(0,0,"failed",Some(e)); }
        }
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

#[cfg(test)] mod tests {
    use super::*;
    #[test] fn manifests_ignore_missing_and_escaping_installs() {
        let dir=std::env::temp_dir().join(crate::files::unique()); let apps=dir.join("steamapps");
        fs::create_dir_all(apps.join("common/Valid")).unwrap();
        fs::write(apps.join("appmanifest_730.acf"),r#""AppState" { "appid" "730" "name" "Counter-Strike 2" "installdir" "Valid" }"#).unwrap();
        fs::write(apps.join("appmanifest_1.acf"),r#""AppState" { "appid" "1" "name" "Missing" "installdir" "Missing" }"#).unwrap();
        fs::write(apps.join("appmanifest_2.acf"),r#""AppState" { "appid" "2" "name" "Escape" "installdir" "../outside" }"#).unwrap();
        let games=read_manifests(&dir); assert_eq!(games.len(),1); assert_eq!(games[0].app_id,730);
        fs::remove_dir_all(dir).unwrap();
    }
    #[test] fn downloads_reject_local_targets() { for u in ["file:///C:/a.cfg","http://localhost/a","http://127.0.0.1/a","http://192.168.1.2/a","http://[::1]/a"] { assert!(validate_download_url(&reqwest::Url::parse(u).unwrap()).is_err(),"{u}"); } assert!(validate_download_url(&reqwest::Url::parse("https://example.org/settings.zip").unwrap()).is_ok()); }
}
