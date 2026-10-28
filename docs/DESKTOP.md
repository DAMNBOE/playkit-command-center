# AfScripts desktop (Tauri) packaging

## Layout
- `src/services/types.ts` — interfaces for library, configs, backups, presets, downloads, window.
- `src/services/commands.ts` — native command names (must match `src-tauri/src/commands.rs`).
- `src/services/mock/` — browser adapter: no Windows file access, no Steam detection (throws `DesktopOnlyError`).
- `src/services/tauri/` — desktop adapter, calls Rust commands through `invoke`.
- `src/services/index.ts` — `getServices()` picks the adapter at runtime (`__TAURI_INTERNALS__`).
- `src-tauri/` — native commands, tested filesystem core, and local-window event capability.

## Steps to a Windows installer
1. On Windows install Rust (rustup), Visual Studio C++ Build Tools, WebView2, Bun, then `bun add -D @tauri-apps/cli`.
2. Configure the web build as a static SPA (TanStack Start SPA/prerender mode) so it outputs plain files; point `frontendDist` in `tauri.conf.json` at that folder.
3. Add an app icon: `bunx tauri icon path/to/logo.png`.
4. Native commands now implement Steam manifest detection, actual file-size measurement, authorized text configuration read/write, durable backup history and restore, preset application/rollback, HTTP(S) downloads/cancellation, Steam launch requests and window controls. Verify them on Windows; source and Linux helper tests are not proof of Windows operation.
5. Desktop state uses a separate localStorage key and never loads web/cloud sample installations. Installed flags reset until a successful local scan. External configuration files selected outside Steam directories require native selection again after restarting.
6. `bunx tauri dev` to test, `bunx tauri build` to produce `.msi` / NSIS `.exe` in `src-tauri/target/release/bundle/`.
7. Code-sign the installer (Authenticode certificate) to avoid SmartScreen warnings.

## Automated build (GitHub Actions)
`.github/workflows/windows-release.yml` builds on a Windows runner: installs Bun + Rust, generates icons from `src-tauri/app-icon.png`, runs `bun run build:desktop` (static SPA) and publishes `.exe`/`.msi` to a GitHub Release tagged `v<version>` (version from `tauri.conf.json`). Trigger via Actions → "Windows installer" → Run workflow, or push a `v*` tag. Copy the release asset URL into the WindowsDownload button.

## Verification and remaining limits
- The workflow now runs frontend tests and `cargo test` before building/publishing installers.
- Local checks: `bunx vitest run`; platform-independent filesystem tests: `rustc --edition=2021 --test src-tauri/src/files.rs -o /tmp/afscripts-files-tests` then run that binary. For full local Cargo checks use `CARGO_TARGET_DIR=/tmp/afscripts-cargo-target cargo test --manifest-path src-tauri/Cargo.toml`; never retain `src-tauri/target` in source.
- This sandbox lacks the Linux GUI libraries required by full Tauri compilation. Native command bodies were compiled/tested separately with the window/event bridge stubbed; those results do not validate Tauri registration, Windows APIs, registry access, or installer operation.
- Native safety backups are retained on disk; the configured backup limit applies only to app-managed workspace snapshots. Files are not deleted when removed from the tracked workspace.
- Download progress is native only. Transfers are not resumed across application restarts; interrupted transfers are marked failed and retry starts a fresh file. Partial files use unique names and can remain after a hard process/PC crash; normal cancellation/errors clean them up.
- Launch-on-boot, system tray, sounds, and plugin installation/update are unavailable and their controls are disabled. Startup-page preference, scanning on launch, notifications, appearance, download folder and queue concurrency are connected.
- Run the Windows checklist before claiming completion: detect/scan Steam → search installed App ID → open config → edit/save → inspect disk backup → confirm restore → create/export/import/apply preset → download an authorized file and cancel a slow transfer → launch through Steam → minimize/maximize/close → reopen and inspect persistence.
- No new Windows installer has been built or published by this implementation turn; current download links still refer to the existing released installer.
