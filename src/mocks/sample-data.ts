/**
 * MOCK DATA — demo content for the browser preview only.
 * Real data will come from PlatformService (Tauri) once the Windows app is packaged.
 */
import type { Activity, ConfigFile, Download, Game, Plugin, Preset, Settings } from "@/lib/types";

const d = (daysAgo: number, h = 0) => new Date(Date.now() - daysAgo * 864e5 - h * 36e5).toISOString();

const g = (
  id: string, name: string, appId: number, installed: boolean, configStatus: Game["configStatus"],
  days: number, sizeGb: number, genre: string, hue: number, developer: string, favorite = false,
): Game => ({
  id, name, appId, installed, configStatus, lastModified: d(days, id.length), sizeGb, genre, hue, favorite, developer,
  installPath: installed ? `C:\\Program Files (x86)\\Steam\\steamapps\\common\\${name.replace(/[:']/g, "")}` : "—",
});

export const sampleGames: Game[] = [
  g("cs2", "Counter-Strike 2", 730, true, "configured", 0, 34.2, "Shooter", 35, "Valve", true),
  g("eldenring", "Elden Ring", 1245620, true, "configured", 1, 49.8, "Action RPG", 45, "FromSoftware", true),
  g("cyberpunk", "Cyberpunk 2077", 1091500, true, "partial", 2, 71.4, "RPG", 320, "CD PROJEKT RED"),
  g("bg3", "Baldur's Gate 3", 1086940, true, "configured", 3, 122.0, "RPG", 15, "Larian Studios", true),
  g("dota2", "Dota 2", 570, true, "partial", 5, 38.1, "MOBA", 0, "Valve"),
  g("rdr2", "Red Dead Redemption 2", 1174180, false, "none", 9, 119.6, "Adventure", 25, "Rockstar Games"),
  g("hades2", "Hades II", 1145350, true, "configured", 4, 9.3, "Roguelike", 290, "Supergiant Games"),
  g("stardew", "Stardew Valley", 413150, true, "none", 14, 0.6, "Simulation", 110, "ConcernedApe"),
  g("helldivers2", "Helldivers 2", 553850, false, "partial", 11, 68.2, "Shooter", 55, "Arrowhead"),
  g("factorio", "Factorio", 427520, true, "configured", 6, 3.1, "Strategy", 30, "Wube Software"),
  g("apex", "Apex Legends", 1172470, false, "none", 21, 75.0, "Shooter", 5, "Respawn"),
  g("palworld", "Palworld", 1623730, true, "partial", 8, 29.5, "Survival", 190, "Pocketpair"),
  g("witcher3", "The Witcher 3: Wild Hunt", 292030, true, "configured", 17, 50.2, "RPG", 0, "CD PROJEKT RED"),
  g("terraria", "Terraria", 105600, false, "none", 30, 0.5, "Sandbox", 140, "Re-Logic"),
];

const ini = (title: string, extra = "") => `; ${title}
[Display]
Resolution=2560x1440
Fullscreen=1
VSync=0
RefreshRate=165
FieldOfView=90

[Graphics]
Quality=High
TextureQuality=Ultra
Shadows=Medium
AntiAliasing=TAA
DLSS=Quality
${extra}
[Audio]
MasterVolume=0.8
MusicVolume=0.45
`;

export const sampleConfigs: ConfigFile[] = [
  {
    id: "cfg-cs2-autoexec", gameId: "cs2", name: "autoexec.cfg", format: "cfg", modifiedAt: d(0, 2),
    path: "game\\csgo\\cfg\\autoexec.cfg",
    content: `// AfScripts managed autoexec
sensitivity "1.25"
zoom_sensitivity_ratio "1.0"
fps_max "0"
cl_crosshairsize "2"
cl_crosshairgap "-2"
cl_crosshaircolor "1"
rate "786432"
// binds
bind "mouse4" "+voicerecord"
bind "f" "+lookatweapon"
echo "autoexec loaded"
`,
    backups: [
      { id: "b1", label: "Before sensitivity change", createdAt: d(3), content: `sensitivity "1.6"\nfps_max "400"\ncl_crosshairsize "3"\n` },
    ],
  },
  {
    id: "cfg-cs2-video", gameId: "cs2", name: "cs2_video.txt", format: "cfg", modifiedAt: d(4),
    path: "game\\csgo\\cfg\\cs2_video.txt",
    content: `"video.cfg"\n{\n\t"setting.defaultres"\t\t"1920"\n\t"setting.defaultresheight"\t\t"1080"\n\t"setting.fullscreen"\t\t"1"\n}\n`,
    backups: [],
  },
  {
    id: "cfg-er-graphics", gameId: "eldenring", name: "GraphicsConfig.xml", format: "xml", modifiedAt: d(1),
    path: "%APPDATA%\\EldenRing\\GraphicsConfig.xml",
    content: `<?xml version="1.0" encoding="UTF-8"?>
<CS_GRAPHICS_CONFIG>
  <ScreenMode>FULLSCREEN</ScreenMode>
  <Resolution width="2560" height="1440" />
  <RayTracingQuality>OFF</RayTracingQuality>
  <MotionBlur>OFF</MotionBlur>
  <ShadowQuality>HIGH</ShadowQuality>
</CS_GRAPHICS_CONFIG>
`,
    backups: [{ id: "b2", label: "Launch defaults", createdAt: d(20), content: `<CS_GRAPHICS_CONFIG>\n  <MotionBlur>ON</MotionBlur>\n</CS_GRAPHICS_CONFIG>\n` }],
  },
  {
    id: "cfg-cp-user", gameId: "cyberpunk", name: "UserSettings.json", format: "json", modifiedAt: d(2),
    path: "%LOCALAPPDATA%\\CD Projekt Red\\Cyberpunk 2077\\UserSettings.json",
    content: JSON.stringify({ version: 2, graphics: { preset: "RayTracingUltra", dlss: "Balanced", frameGen: true, fov: 85 }, gameplay: { subtitles: true, hud: "minimal" } }, null, 2) + "\n",
    backups: [],
  },
  {
    id: "cfg-bg3-graphics", gameId: "bg3", name: "graphicSettings.lsx", format: "xml", modifiedAt: d(3),
    path: "%LOCALAPPDATA%\\Larian Studios\\Baldur's Gate 3\\graphicSettings.lsx",
    content: `<save>\n  <region id="GraphicSettings">\n    <attribute id="VSync" value="false" />\n    <attribute id="FSR" value="Quality" />\n  </region>\n</save>\n`,
    backups: [],
  },
  {
    id: "cfg-hades-ini", gameId: "hades2", name: "Profile.ini", format: "ini", modifiedAt: d(4),
    path: "Documents\\Saved Games\\Hades II\\Profile.ini", content: ini("Hades II profile"), backups: [],
  },
  {
    id: "cfg-factorio-lua", gameId: "factorio", name: "settings.lua", format: "lua", modifiedAt: d(6),
    path: "%APPDATA%\\Factorio\\mods\\settings.lua",
    content: `-- AfScripts preset: megabase
local settings = {
  autosave_interval = 10,
  autosave_slots = 5,
  ui_scale = 1.25,
  show_grid = true,
}

for key, value in pairs(settings) do
  print(key, value)
end

return settings
`,
    backups: [],
  },
  {
    id: "cfg-w3-user", gameId: "witcher3", name: "user.settings", format: "ini", modifiedAt: d(17),
    path: "Documents\\The Witcher 3\\user.settings", content: ini("Witcher 3 user settings", "HairWorks=Off\nFoliageDistance=Ultra\n"), backups: [],
  },
];

export const samplePresets: Preset[] = [
  { id: "p1", name: "Competitive Low-Latency", gameId: "cs2", description: "Uncapped FPS, minimal visual clutter and tuned network rates.", createdAt: d(40), updatedAt: d(2) },
  { id: "p2", name: "Cinematic 1440p", gameId: "eldenring", description: "High fidelity visuals with motion blur off and stable 60 FPS.", createdAt: d(28), updatedAt: d(5) },
  { id: "p3", name: "Path Tracing Showcase", gameId: "cyberpunk", description: "Overdrive mode with DLSS Balanced and frame generation.", createdAt: d(18), updatedAt: d(3) },
  { id: "p4", name: "Steam Deck Docked", gameId: "bg3", description: "FSR Quality, medium shadows and 1080p target.", createdAt: d(12), updatedAt: d(12) },
  { id: "p5", name: "Megabase Performance", gameId: "factorio", description: "Long autosave interval, reduced UI scale for big screens.", createdAt: d(9), updatedAt: d(6) },
];

export const sampleDownloads: Download[] = [
  { id: "dl1", name: "CS2 Pro Config Pack v3.2", gameId: "cs2", sizeMb: 48, progress: 42, speedMbps: 6.4, status: "active", addedAt: d(0, 1) },
  { id: "dl2", name: "Elden Ring Seamless Profile", gameId: "eldenring", sizeMb: 212, progress: 18, speedMbps: 9.1, status: "active", addedAt: d(0, 1) },
  { id: "dl3", name: "Cyberpunk HD Reworked Settings", gameId: "cyberpunk", sizeMb: 860, progress: 0, speedMbps: 0, status: "queued", addedAt: d(0, 2) },
  { id: "dl4", name: "Factorio Megabase Blueprints", gameId: "factorio", sizeMb: 12, progress: 64, speedMbps: 0, status: "paused", addedAt: d(0, 3) },
  { id: "dl5", name: "BG3 Camera Tweaks", gameId: "bg3", sizeMb: 3, progress: 100, speedMbps: 0, status: "completed", addedAt: d(1) },
  { id: "dl6", name: "Witcher 3 Next-Gen INI", gameId: "witcher3", sizeMb: 1, progress: 100, speedMbps: 0, status: "completed", addedAt: d(2) },
  { id: "dl7", name: "Palworld Server Template", gameId: "palworld", sizeMb: 26, progress: 37, speedMbps: 0, status: "failed", addedAt: d(1, 4) },
];

export const samplePlugins: Plugin[] = [
  { id: "pl1", name: "Steam Library Sync", description: "Reads Steam library folders and keeps installation paths in sync.", version: "2.4.1", author: "AfScripts Team", enabled: true, category: "Integration", installedAt: d(60) },
  { id: "pl2", name: "Config Diff Pro", description: "Side-by-side comparisons with word-level highlighting for config versions.", version: "1.8.0", author: "kestrel.dev", enabled: true, category: "Utility", installedAt: d(45) },
  { id: "pl3", name: "Auto Backup Scheduler", description: "Creates timed backups of configuration files before every change.", version: "3.0.2", author: "AfScripts Team", enabled: true, category: "Utility", installedAt: d(44) },
  { id: "pl4", name: "Shader Cache Cleaner", description: "Clears stale DirectX shader caches to fix stutter after driver updates.", version: "0.9.5", author: "Northbyte", enabled: false, category: "Performance", installedAt: d(20) },
  { id: "pl5", name: "Cover Art Fetcher", description: "Downloads high resolution library covers for every managed game.", version: "1.2.0", author: "pixelgrid", enabled: true, category: "Visual", installedAt: d(15) },
  { id: "pl6", name: "Discord Presence", description: "Shows the game you are configuring in your Discord status.", version: "1.0.4", author: "lumen", enabled: false, category: "Integration", installedAt: d(8) },
  { id: "pl7", name: "FPS Profile Switcher", description: "Swaps between performance and quality profiles with one hotkey.", version: "2.1.3", author: "Northbyte", enabled: true, category: "Performance", installedAt: d(5) },
];

export const sampleActivity: Activity[] = [
  { id: "a1", type: "config", message: "Edited autoexec.cfg", gameId: "cs2", at: d(0, 2) },
  { id: "a2", type: "download", message: "Started download: CS2 Pro Config Pack v3.2", gameId: "cs2", at: d(0, 1) },
  { id: "a3", type: "backup", message: "Backup created for GraphicsConfig.xml", gameId: "eldenring", at: d(1) },
  { id: "a4", type: "import", message: "Imported UserSettings.json", gameId: "cyberpunk", at: d(2) },
  { id: "a5", type: "preset", message: "Updated preset Path Tracing Showcase", gameId: "cyberpunk", at: d(3) },
  { id: "a6", type: "export", message: "Exported graphicSettings.lsx", gameId: "bg3", at: d(3, 5) },
  { id: "a7", type: "plugin", message: "Enabled FPS Profile Switcher", at: d(5) },
  { id: "a8", type: "restore", message: "Restored backup of settings.lua", gameId: "factorio", at: d(6) },
  { id: "a9", type: "game", message: "Added Palworld to library", gameId: "palworld", at: d(8) },
  { id: "a10", type: "preset", message: "Created preset Megabase Performance", gameId: "factorio", at: d(9) },
];

export const defaultSettings: Settings = {
  startup: "dashboard", launchOnBoot: false, minimizeToTray: true, notifications: true, soundEffects: false,
  accent: "violet", compact: false, darkTheme: true,
  libraryPath: "C:\\Program Files (x86)\\Steam\\steamapps", autoDetect: true,
  autoBackup: true, backupLimit: 10,
  downloadPath: "C:\\Users\\Player\\Downloads\\AfScripts", maxConcurrent: 2,
  autoUpdatePlugins: true,
};
