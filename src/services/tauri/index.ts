import { NATIVE_COMMANDS as C } from "../commands";
import type { AppServices } from "../types";

/**
 * Desktop adapter. Each method maps 1:1 to a Rust command in NATIVE_COMMANDS.
 * `invoke` is read lazily from the Tauri global, so the browser bundle has no
 * dependency on @tauri-apps/api and nothing runs in Lovable's preview.
 */
type Invoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const w = window as unknown as { __TAURI_INTERNALS__?: { invoke: Invoke } };
  if (!w.__TAURI_INTERNALS__) return Promise.reject(new Error("Tauri runtime not available"));
  return w.__TAURI_INTERNALS__.invoke<T>(cmd, args);
}

export const tauriServices: AppServices = {
  environment: {
    kind: "desktop",
    label: "Desktop app",
    canAccessFilesystem: true,
    canDetectGames: true,
    canControlWindow: true,
  },
  library: {
    scanLibrary: (libraryPath) => invoke(C.scanLibrary, { libraryPath }),
    detectInstallPath: (appId, name) => invoke(C.detectInstallPath, { appId, name }),
    listGameFiles: (installPath) => invoke(C.listGameFiles, { installPath }),
  },
  configs: {
    read: (path) => invoke(C.readConfigFile, { path }),
    write: (path, content) => invoke(C.writeConfigFile, { path, content }),
  },
  backups: {
    create: (path, content) => invoke(C.createBackup, { path, content }),
    restore: (backupPath) => invoke(C.restoreBackup, { backupPath }),
  },
  presets: { apply: (gameId, files) => invoke(C.applyPreset, { gameId, files }) },
  downloads: {
    start: (id, url) => invoke(C.startDownload, { id, url }),
    pause: (id) => invoke(C.pauseDownload, { id }),
    cancel: (id) => invoke(C.cancelDownload, { id }),
  },
  window: { action: async (action) => { await invoke(C.windowAction, { action }); return true; } },
};
