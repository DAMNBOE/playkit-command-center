// Filesystem core: also compiled directly by rustc --test on non-Windows hosts.
use std::{fs, io::Write, path::{Path, PathBuf}, sync::atomic::{AtomicU64, Ordering}};
const EXTS: &[&str] = &["ini", "cfg", "json", "xml", "lua", "txt", "lsx", "settings", "yaml", "yml", "toml", "vdf"];
pub const MAX_BYTES: usize = 4 * 1024 * 1024;
pub fn unique() -> String {
    static N: AtomicU64 = AtomicU64::new(0);
    format!("{}-{}-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos(), std::process::id(), N.fetch_add(1, Ordering::Relaxed))
}
pub fn is_link(md: &fs::Metadata) -> bool {
    #[cfg(windows)] { use std::os::windows::fs::MetadataExt; md.file_type().is_symlink() || md.file_attributes() & 0x400 != 0 }
    #[cfg(not(windows))] { md.file_type().is_symlink() }
}
pub fn validate(path: &Path) -> Result<PathBuf, String> {
    if !path.is_absolute() { return Err("Path must be absolute".into()); }
    let ext = path.extension().and_then(|x| x.to_str()).unwrap_or("").to_ascii_lowercase();
    if !EXTS.contains(&ext.as_str()) { return Err("Unsupported text configuration file".into()); }
    let mut ancestor = Some(path);
    while let Some(p) = ancestor {
        if fs::symlink_metadata(p).map(|m| is_link(&m)).unwrap_or(false) { return Err("Linked configuration paths are not supported".into()); }
        ancestor = p.parent();
    }
    let canonical = fs::canonicalize(path).map_err(|e| e.to_string())?;
    if !canonical.is_file() { return Err("Select an existing configuration file".into()); }
    if fs::metadata(&canonical).map_err(|e| e.to_string())?.len() > MAX_BYTES as u64 { return Err("File is larger than 4 MB".into()); }
    Ok(canonical)
}
pub fn read(path: &Path) -> Result<String, String> { fs::read_to_string(validate(path)?).map_err(|e| e.to_string()) }
pub fn backup(path: &Path, dir: &Path) -> Result<PathBuf, String> {
    let data = read(path)?;
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let dest = dir.join(format!("{}.bak", unique()));
    let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&dest).map_err(|e| e.to_string())?;
    file.write_all(data.as_bytes()).and_then(|_| file.sync_all()).map_err(|e| e.to_string())?;
    Ok(dest)
}
/// Make one durable backup, optionally record metadata, then replace the existing file.
pub fn replace_recorded<F>(path: &Path, content: &str, backups: &Path, record: F) -> Result<PathBuf, String>
where F: FnOnce(&Path, &Path) -> Result<(), String> {
    if content.len() > MAX_BYTES { return Err("Content is larger than 4 MB".into()); }
    let p = validate(path)?;
    let saved = backup(&p, backups)?;
    record(&p, &saved)?;
    let tmp = p.with_extension(format!("{}.afscripts-tmp", unique()));
    let result = (|| {
        let mut out = fs::OpenOptions::new().create_new(true).write(true).open(&tmp).map_err(|e| e.to_string())?;
        out.write_all(content.as_bytes()).and_then(|_| out.sync_all()).map_err(|e| e.to_string())?;
        fs::set_permissions(&tmp, fs::metadata(&p).map_err(|e| e.to_string())?.permissions()).map_err(|e| e.to_string())?;
        drop(out);
        atomic_replace(&tmp, &p)
    })();
    if result.is_err() { let _ = fs::remove_file(tmp); }
    result.map(|_| saved)
}
pub fn replace(path: &Path, content: &str, backups: &Path) -> Result<PathBuf, String> { replace_recorded(path, content, backups, |_,_| Ok(())) }
#[cfg(not(windows))]
fn atomic_replace(tmp: &Path, dest: &Path) -> Result<(), String> { fs::rename(tmp,dest).map_err(|e| e.to_string()) }
#[cfg(windows)]
fn atomic_replace(tmp: &Path, dest: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    #[link(name="kernel32")]
    extern "system" { fn ReplaceFileW(replaced: *const u16, replacement: *const u16, backup: *const u16, flags: u32, exclude: *mut std::ffi::c_void, reserved: *mut std::ffi::c_void) -> i32; }
    let replaced: Vec<u16> = dest.as_os_str().encode_wide().chain(Some(0)).collect();
    let replacement: Vec<u16> = tmp.as_os_str().encode_wide().chain(Some(0)).collect();
    let ok = unsafe { ReplaceFileW(replaced.as_ptr(),replacement.as_ptr(),std::ptr::null(),0,std::ptr::null_mut(),std::ptr::null_mut()) };
    if ok == 0 { Err(std::io::Error::last_os_error().to_string()) } else { Ok(()) }
}
pub fn disk_usage(root: &Path) -> Result<u64, String> {
    let mut total = 0u64;
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        for item in fs::read_dir(dir).map_err(|e| e.to_string())? {
            let item = item.map_err(|e| e.to_string())?;
            let md = fs::symlink_metadata(item.path()).map_err(|e| e.to_string())?;
            if is_link(&md) { continue; }
            if md.is_dir() { stack.push(item.path()); } else if md.is_file() { total = total.saturating_add(md.len()); }
        }
    }
    Ok(total)
}
/// Quoted Valve KeyValues token parser, preserving escaped Windows paths and ignoring comments/braces.
pub fn pairs(text: &str) -> Vec<(String, String)> {
    let mut tokens: Vec<Option<String>> = Vec::new();
    let mut it = text.chars().peekable();
    while let Some(c) = it.next() {
        match c {
            '/' if it.peek() == Some(&'/') => { for c in it.by_ref() { if c == '\n' { break; } } }
            '{' | '}' => tokens.push(None),
            '"' => {
                let mut s = String::new();
                while let Some(c) = it.next() {
                    if c == '"' { break; }
                    if c == '\\' { if let Some(n) = it.next() { s.push(n); } } else { s.push(c); }
                }
                tokens.push(Some(s));
            }
            _ => {}
        }
    }
    let mut pairs = Vec::new();
    let mut i = 0;
    while i + 1 < tokens.len() {
        if let (Some(k), Some(v)) = (&tokens[i], &tokens[i+1]) { pairs.push((k.to_ascii_lowercase(), v.clone())); i += 2; } else { i += 1; }
    }
    pairs
}
pub fn safe_filename(name: &str) -> Result<String, String> {
    if name.is_empty() || name == "." || name == ".." || name.ends_with('.') || name.ends_with(' ') || name.chars().any(|c| c.is_control() || "<>:\"/\\|?*".contains(c)) { return Err("Unsafe download filename".into()); }
    let stem = name.split('.').next().unwrap_or("").to_ascii_uppercase();
    if ["CON", "PRN", "AUX", "NUL"].contains(&stem.as_str()) || (stem.starts_with("COM") || stem.starts_with("LPT")) && stem[3..].parse::<u8>().map(|n| (1..=9).contains(&n)).unwrap_or(false) { return Err("Reserved Windows filename".into()); }
    Ok(name.to_string())
}
#[cfg(test)] mod tests {
    use super::*;
    fn fixture() -> (PathBuf, PathBuf) { let dir = std::env::temp_dir().join(format!("afscripts-test-{}", unique())); fs::create_dir_all(&dir).unwrap(); let file = dir.join("game.cfg"); fs::write(&file, "original").unwrap(); (dir, file) }
    #[test] fn preserves_backup_before_write_and_restore() { let (dir,p) = fixture(); let b = replace(&p,"edited",&dir.join("backups")).unwrap(); assert_eq!(fs::read_to_string(&b).unwrap(), "original"); assert_eq!(read(&p).unwrap(), "edited"); let b2 = replace(&p,&fs::read_to_string(b).unwrap(),&dir.join("backups")).unwrap(); assert_eq!(read(&p).unwrap(),"original"); assert_eq!(fs::read_to_string(b2).unwrap(),"edited"); fs::remove_dir_all(dir).unwrap(); }
    #[test] fn one_backup_per_write_and_metadata_failure_prevents_overwrite() { let (dir,p)=fixture(); let bdir=dir.join("b"); replace_recorded(&p,"new",&bdir,|_,_| Ok(())).unwrap(); assert_eq!(fs::read_dir(&bdir).unwrap().count(),1); assert!(replace_recorded(&p,"bad",&bdir,|_,_| Err("metadata failed".into())).is_err()); assert_eq!(read(&p).unwrap(),"new"); fs::remove_dir_all(dir).unwrap(); }
    #[test] fn rejects_binary_and_relative_paths() { assert!(validate(Path::new("game.cfg")).is_err()); let (dir,_) = fixture(); let bin=dir.join("game.exe"); fs::write(&bin,"binary").unwrap(); assert!(validate(&bin).is_err()); fs::remove_dir_all(dir).unwrap(); }
    #[test] fn failed_validation_preserves_file() { let (dir,p)=fixture(); assert!(replace(&p,&"x".repeat(MAX_BYTES+1),&dir.join("backups")).is_err()); assert_eq!(read(&p).unwrap(),"original"); fs::remove_dir_all(dir).unwrap(); }
    #[test] fn backups_never_collide() { let (dir,p)=fixture(); assert_ne!(backup(&p,&dir.join("b")).unwrap(),backup(&p,&dir.join("b")).unwrap()); fs::remove_dir_all(dir).unwrap(); }
    #[test] fn measures_actual_bytes() { let (dir,_)=fixture(); fs::create_dir(dir.join("sub")).unwrap(); fs::write(dir.join("sub/data"),[0u8;12]).unwrap(); assert_eq!(disk_usage(&dir).unwrap(),20); fs::remove_dir_all(dir).unwrap(); }
    #[test] fn parses_compact_nested_valve_manifest() { let p=pairs(r#""AppState" { "appid" "730" "name" "Counter-Strike 2" "installdir" "Counter-Strike Global Offensive" }"#); assert!(p.contains(&("appid".into(),"730".into()))); assert!(p.contains(&("name".into(),"Counter-Strike 2".into()))); }
    #[test] fn rejects_download_path_escape_and_windows_devices() { for n in ["..","../a","C:\\bad","CON.txt","LPT1.cfg","a."] { assert!(safe_filename(n).is_err(),"{n}"); } assert_eq!(safe_filename("settings.zip").unwrap(),"settings.zip"); }
    #[cfg(unix)] #[test] fn rejects_links() { let (dir,p)=fixture(); let link=dir.join("link.cfg"); std::os::unix::fs::symlink(p, &link).unwrap(); assert!(validate(&link).is_err()); fs::remove_dir_all(dir).unwrap(); }
}
