import { DesktopOnlyError, type AppServices } from "../types";

/** Browser adapter rejects all native filesystem operations. App-managed text stays in the React store. */
export const browserServices: AppServices = {
  environment: {
    kind: "browser",
    label: "Browser preview",
    canAccessFilesystem: false,
    canDetectGames: false,
    canControlWindow: false,
  },
  library: {
    async launch() { throw new DesktopOnlyError("Steam game launching"); },
    async lookupSteamApp() { throw new DesktopOnlyError("Native Steam store lookup"); },
    async scanLibrary() { throw new DesktopOnlyError("Steam library scanning"); },
    async detectInstallPath() { throw new DesktopOnlyError("Install path detection"); },
    async listGameFiles() { throw new DesktopOnlyError("Browsing local game files"); },
  },
  configs: {
    async select() { throw new DesktopOnlyError("Selecting local configuration paths"); },
    async read() { throw new DesktopOnlyError("Reading Windows files"); },
    async write() { throw new DesktopOnlyError("Saving Windows files"); },
  },
  backups: {
    async list() { throw new DesktopOnlyError("Native backup history"); },
    async create() { throw new DesktopOnlyError("Native backups"); },
    async restore() { throw new DesktopOnlyError("Native restore"); },
  },
  presets: { async apply() { throw new DesktopOnlyError("Applying presets to Windows files"); } },
  downloads: { onProgress: () => () => {}, async start() { throw new DesktopOnlyError("Windows downloads"); }, async pause() { throw new DesktopOnlyError("Windows downloads"); }, async cancel() { throw new DesktopOnlyError("Windows downloads"); } },
  window: { async action() { return false; } },
};
