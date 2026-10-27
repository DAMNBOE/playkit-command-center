# AfScripts desktop (Tauri) packaging

## Layout
- `src/services/types.ts` — interfaces for library, configs, backups, presets, downloads, window.
- `src/services/commands.ts` — native command names (must match `src-tauri/src/commands.rs`).
- `src/services/mock/` — browser adapter: no Windows file access, no Steam detection (throws `DesktopOnlyError`).
- `src/services/tauri/` — desktop adapter, calls Rust commands through `invoke`.
- `src/services/index.ts` — `getServices()` picks the adapter at runtime (`__TAURI_INTERNALS__`).
- `src-tauri/` — Rust shell with stub commands.

## Steps to a Windows installer
1. On Windows install Rust (rustup), Visual Studio C++ Build Tools, WebView2, Bun, then `bun add -D @tauri-apps/cli`.
2. Configure the web build as a static SPA (TanStack Start SPA/prerender mode) so it outputs plain files; point `frontendDist` in `tauri.conf.json` at that folder.
3. Add an app icon: `bunx tauri icon path/to/logo.png`.
4. Implement each stub in `src-tauri/src/commands.rs` (Steam `libraryfolders.vdf` + `appmanifest_*.acf` parsing, file read/write, backups, downloads). Restrict paths with Tauri capabilities.
5. Move persisted state from localStorage to files in the app data dir when ready.
6. `bunx tauri dev` to test, `bunx tauri build` to produce `.msi` / NSIS `.exe` in `src-tauri/target/release/bundle/`.
7. Code-sign the installer (Authenticode certificate) to avoid SmartScreen warnings.

## Automated build (GitHub Actions)
`.github/workflows/windows-release.yml` builds on a Windows runner: installs Bun + Rust, generates icons from `src/assets/logo-segmented.png`, runs `bun run build:desktop` (static SPA) and publishes `.exe`/`.msi` to a GitHub Release tagged `v<version>` (version from `tauri.conf.json`). Trigger via Actions → "Windows installer" → Run workflow, or push a `v*` tag. Copy the release asset URL into the WindowsDownload button.
