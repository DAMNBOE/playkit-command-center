/**
 * Native command names the Tauri (Rust) backend must expose via `#[tauri::command]`.
 * Keep in sync with `src-tauri/src/commands.rs` once packaging starts.
 */
export const NATIVE_COMMANDS = {
  lookupSteamApp: "lookup_steam_app",
  scanLibrary: "scan_library",
  detectInstallPath: "detect_install_path",
  listGameFiles: "list_game_files",
  readConfigFile: "read_config_file",
  writeConfigFile: "write_config_file",
  createBackup: "create_backup",
  restoreBackup: "restore_backup",
  applyPreset: "apply_preset",
  startDownload: "start_download",
  pauseDownload: "pause_download",
  cancelDownload: "cancel_download",
  windowAction: "window_action",
} as const;

export type NativeCommand = (typeof NATIVE_COMMANDS)[keyof typeof NATIVE_COMMANDS];
