/**
 * Service contracts shared by every adapter (browser mock today, Tauri later).
 * UI code depends only on these interfaces — never on a concrete adapter.
 */

export type RuntimeKind = "browser" | "desktop";

export interface AppEnvironment {
  kind: RuntimeKind;
  label: string;
  /** True only when real Windows files can be read/written (desktop app). */
  canAccessFilesystem: boolean;
  canDetectGames: boolean;
  canControlWindow: boolean;
}

/** Thrown by browser adapters for operations that need the desktop app. */
export class DesktopOnlyError extends Error {
  constructor(feature: string) {
    super(`${feature} is only available in the AfScripts desktop app.`);
    this.name = "DesktopOnlyError";
  }
}

export interface LocalFileEntry {
  name: string;
  path: string;
  sizeBytes: number;
  isDirectory: boolean;
  modifiedAt: string;
}

export interface DetectedGame {
  appId: number;
  name: string;
  installPath: string;
  sizeBytes: number;
}

export interface SteamSearchResult { appId: number; name: string; image: string }

export interface GameLibraryService {
  /** Read Steam's public catalog through the native HTTP client. Desktop only. */
  launch(appId: number): Promise<void>;
  lookupSteamApp(appId: number): Promise<SteamSearchResult[]>;
  /** Scan Steam libraries for installed games. Desktop only. */
  scanLibrary(libraryPath: string): Promise<DetectedGame[]>;
  /** Resolve install folder for a game. Desktop only. */
  detectInstallPath(appId: number, name: string): Promise<string | null>;
  listGameFiles(installPath: string): Promise<LocalFileEntry[]>;
}

export interface ConfigFileService {
  select(): Promise<string | null>;
  read(path: string): Promise<string | null>;
  write(path: string, content: string): Promise<void>;
}

export interface BackupService {
  list(path: string): Promise<{ backupPath: string; createdAt: string; content: string }[]>;
  create(path: string, content: string): Promise<{ backupPath: string }>;
  restore(backupPath: string): Promise<string | null>;
}

export interface PresetFile { path: string; content: string }

export interface PresetService {
  /** Write every file of a preset to disk. */
  apply(gameId: string, files: PresetFile[]): Promise<void>;
}

export interface DownloadProgress {
  id: string; received: number; total: number;
  status: "active" | "completed" | "cancelled" | "failed";
  path: string; error?: string | null;
}

export interface DownloadService {
  /** Subscribe to real progress events (desktop). Returns an unsubscribe fn. */
  onProgress(cb: (p: DownloadProgress) => void): () => void;
  start(id: string, url: string, downloadPath?: string): Promise<void>;
  pause(id: string): Promise<void>;
  cancel(id: string): Promise<void>;
}

export type WindowAction = "minimize" | "maximize" | "close";

export interface WindowService {
  /** Returns false when unsupported (browser). */
  action(action: WindowAction): Promise<boolean>;
}

export interface AppServices {
  environment: AppEnvironment;
  library: GameLibraryService;
  configs: ConfigFileService;
  backups: BackupService;
  presets: PresetService;
  downloads: DownloadService;
  window: WindowService;
}
