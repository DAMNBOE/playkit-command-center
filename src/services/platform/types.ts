/** Contracts shared by every platform implementation (browser mock, future Tauri). */
export interface LocalFileEntry {
  name: string;
  path: string;
  sizeBytes: number;
  isDirectory: boolean;
  modifiedAt: string;
}

/**
 * Native command names a future Tauri (Rust) backend must expose via `#[tauri::command]`.
 * Keep these in sync with `src-tauri/src/commands.rs` once packaging starts.
 */
export const NATIVE_COMMANDS = {
  readConfigFile: "read_config_file",
  writeConfigFile: "write_config_file",
  listFiles: "list_files",
  createBackup: "create_backup",
  restoreBackup: "restore_backup",
  detectInstallPath: "detect_install_path",
  startDownload: "start_download",
  pauseDownload: "pause_download",
  cancelDownload: "cancel_download",
  windowAction: "window_action",
} as const;

export type WindowAction = "minimize" | "maximize" | "close";

export interface PlatformService {
  readonly kind: "mock" | "tauri";
  readConfigFile(path: string): Promise<string | null>;
  writeConfigFile(path: string, content: string): Promise<void>;
  listFiles(dir: string): Promise<LocalFileEntry[]>;
  createBackup(path: string, content: string): Promise<{ backupPath: string }>;
  restoreBackup(backupPath: string): Promise<string | null>;
  detectInstallPath(appId: number, name: string): Promise<string | null>;
  startDownload(id: string, url: string): Promise<void>;
  pauseDownload(id: string): Promise<void>;
  cancelDownload(id: string): Promise<void>;
  /** Returns false when the action is unsupported (browser preview). */
  windowAction(action: WindowAction): Promise<boolean>;
}
