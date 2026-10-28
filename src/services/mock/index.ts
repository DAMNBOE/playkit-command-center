import { DesktopOnlyError, type AppServices } from "../types";

/**
 * Browser-preview adapter. It NEVER touches Windows files and never fakes
 * Steam detection. Config edits live only in this browser's app state; the
 * in-memory map below just mirrors writes so read-after-write works.
 */
const memory = new Map<string, string>();

export const browserServices: AppServices = {
  environment: {
    kind: "browser",
    label: "Browser preview",
    canAccessFilesystem: false,
    canDetectGames: false,
    canControlWindow: false,
  },
  library: {
    async lookupSteamApp() { throw new DesktopOnlyError("Native Steam store lookup"); },
    async scanLibrary() { throw new DesktopOnlyError("Steam library scanning"); },
    async detectInstallPath() { throw new DesktopOnlyError("Install path detection"); },
    async listGameFiles() { throw new DesktopOnlyError("Browsing local game files"); },
  },
  configs: {
    async read(path) { return memory.get(path) ?? null; },
    async write(path, content) { memory.set(path, content); },
  },
  backups: {
    async create(path, content) {
      const backupPath = `browser://${path}.${Date.now()}.bak`;
      memory.set(backupPath, content);
      return { backupPath };
    },
    async restore(backupPath) { return memory.get(backupPath) ?? null; },
  },
  presets: {
    async apply(_gameId, files) { files.forEach((f) => memory.set(f.path, f.content)); },
  },
  // Download progress in the browser is a UI simulation (see src/lib/downloads.ts).
  downloads: { onProgress: () => () => {}, async start() {}, async pause() {}, async cancel() {} },
  window: { async action() { return false; } },
};
