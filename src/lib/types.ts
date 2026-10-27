export type ConfigStatus = "configured" | "partial" | "none";

export interface Game {
  id: string;
  name: string;
  appId: number;
  installed: boolean;
  configStatus: ConfigStatus;
  lastModified: string; // ISO
  installPath: string;
  sizeGb: number;
  genre: string;
  hue: number; // cover color seed
  favorite: boolean;
  developer: string;
}

export interface ConfigBackup {
  id: string;
  createdAt: string;
  content: string;
  label: string;
}

export interface ConfigFile {
  id: string;
  gameId: string;
  name: string;
  path: string;
  format: "ini" | "json" | "cfg" | "lua" | "xml";
  content: string;
  modifiedAt: string;
  backups: ConfigBackup[];
}

export interface Preset {
  id: string;
  name: string;
  gameId: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export type DownloadStatus = "queued" | "active" | "paused" | "completed" | "failed";

export interface Download {
  id: string;
  name: string;
  gameId?: string | undefined;
  sizeMb: number;
  progress: number; // 0-100
  speedMbps: number;
  status: DownloadStatus;
  addedAt: string;
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  enabled: boolean;
  category: "Utility" | "Visual" | "Performance" | "Integration";
  installedAt: string;
}

export type ActivityType = "config" | "import" | "export" | "backup" | "restore" | "preset" | "game" | "plugin" | "download";

export interface Activity {
  id: string;
  type: ActivityType;
  message: string;
  gameId?: string | undefined;
  at: string;
}

export interface Settings {
  startup: "dashboard" | "games" | "last";
  launchOnBoot: boolean;
  minimizeToTray: boolean;
  notifications: boolean;
  soundEffects: boolean;
  accent: "violet" | "blue" | "emerald" | "rose";
  compact: boolean;
  darkTheme: boolean;
  libraryPath: string;
  autoDetect: boolean;
  autoBackup: boolean;
  backupLimit: number;
  downloadPath: string;
  maxConcurrent: number;
  autoUpdatePlugins: boolean;
}
