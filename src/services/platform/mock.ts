import type { PlatformService } from "./types";

/**
 * Browser-preview implementation. Works on an in-memory map only and NEVER
 * touches the real Windows filesystem. All results are simulated.
 */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const memFs = new Map<string, string>();

export const MockPlatform: PlatformService = {
  kind: "mock",
  async readConfigFile(path) { await wait(80); return memFs.get(path) ?? null; },
  async writeConfigFile(path, content) { await wait(120); memFs.set(path, content); },
  async listFiles(dir) {
    await wait(250);
    const now = new Date().toISOString();
    return [
      { name: "bin", path: `${dir}\\bin`, sizeBytes: 0, isDirectory: true, modifiedAt: now },
      { name: "cfg", path: `${dir}\\cfg`, sizeBytes: 0, isDirectory: true, modifiedAt: now },
      { name: "steam_appid.txt", path: `${dir}\\steam_appid.txt`, sizeBytes: 8, isDirectory: false, modifiedAt: now },
      { name: "launcher.log", path: `${dir}\\launcher.log`, sizeBytes: 18_442, isDirectory: false, modifiedAt: now },
      { name: "game.exe", path: `${dir}\\game.exe`, sizeBytes: 84_211_712, isDirectory: false, modifiedAt: now },
    ];
  },
  async createBackup(path, content) {
    await wait(200);
    const backupPath = `${path}.${Date.now()}.bak`;
    memFs.set(backupPath, content);
    return { backupPath };
  },
  async restoreBackup(backupPath) { await wait(200); return memFs.get(backupPath) ?? null; },
  async detectInstallPath(_appId, name) {
    await wait(400);
    return `C:\\Program Files (x86)\\Steam\\steamapps\\common\\${name}`;
  },
  async startDownload() { await wait(50); },
  async pauseDownload() { await wait(50); },
  async cancelDownload() { await wait(50); },
  async windowAction() { return false; },
};
