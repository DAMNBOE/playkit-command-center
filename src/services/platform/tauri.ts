import { NATIVE_COMMANDS as C, type PlatformService } from "./types";

/**
 * Tauri implementation skeleton. Each method maps 1:1 to a Rust command in
 * NATIVE_COMMANDS. `invoke` is resolved lazily from the Tauri global so the
 * browser bundle has no dependency on @tauri-apps/api.
 */
type Invoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const w = window as unknown as { __TAURI_INTERNALS__?: { invoke: Invoke } };
  if (!w.__TAURI_INTERNALS__) return Promise.reject(new Error("Tauri runtime not available"));
  return w.__TAURI_INTERNALS__.invoke<T>(cmd, args);
}

export const TauriPlatform: PlatformService = {
  kind: "tauri",
  readConfigFile: (path) => invoke(C.readConfigFile, { path }),
  writeConfigFile: (path, content) => invoke(C.writeConfigFile, { path, content }),
  listFiles: (dir) => invoke(C.listFiles, { dir }),
  createBackup: (path, content) => invoke(C.createBackup, { path, content }),
  restoreBackup: (backupPath) => invoke(C.restoreBackup, { backupPath }),
  detectInstallPath: (appId, name) => invoke(C.detectInstallPath, { appId, name }),
  startDownload: (id, url) => invoke(C.startDownload, { id, url }),
  pauseDownload: (id) => invoke(C.pauseDownload, { id }),
  cancelDownload: (id) => invoke(C.cancelDownload, { id }),
  windowAction: async (action) => { await invoke(C.windowAction, { action }); return true; },
};
