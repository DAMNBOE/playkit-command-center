# AfScripts desktop functionality completion

## Audit results

The existing design, pages, branding, and service architecture will be preserved. Native commands exist, but the application is not yet fully functional.

### Incomplete features
1. **Steam detection:** scans manifests, but disk size is taken from manifest metadata rather than measured. Missing folders can silently produce empty results; stale manifests and duplicate IDs are not reliably handled. Manual and sample entries can look installed without verification.
2. **Configuration discovery:** the game Files view lists files but cannot register supported files for editing. Imported files have synthetic paths that cannot be saved natively.
3. **Safe saves:** native writes do not automatically back up existing files. Path validation is extension-only, temporary filenames are predictable, and writes lack a content-size limit. The editor reports a backup based only on an in-app copy.
4. **Backup history and restore:** native backup paths are discarded by the UI. Restore changes app state, not the real file. Backup filenames can collide, reading failures can silently substitute editor content, and restore lacks replacement confirmation and a safety backup.
5. **Presets:** only names/descriptions/dates are stored. Actual file contents, import, and apply are missing. Native apply ignores the game identifier and can leave a partially applied preset.
6. **Downloads:** the browser still simulates progress. Native downloads exist, but can overwrite same-name files; cancellation can delete that destination. Progress listeners are tied to the Downloads page, and fast completion can arrive before a row exists. Timeouts, safe filenames, cleanup, and persistent restart state need attention.
7. **Dashboard:** values include sample/catalog/manual records. System information, Steam detection, storage capacity, and last-backup fallback are simulated or invented.
8. **Game launching:** no launch service or registered command exists.
9. **Windows settings:** settings are saved locally, but some advertised behaviors are disconnected, including auto-detection, startup page, launch-on-boot, tray behavior, and download directory/concurrency. Plugin execution/update is not implemented and must not be presented as real.
10. **Verification:** 22 existing frontend tests pass. They cover routing, auth, visibility, browser boundaries, and emulated Windows search—not native disk writes, restore, or downloads. No Rust command tests or explicit Tauri capability files are present.

### Existing foundations to keep
- Steam App ID-only search and search-gated visibility throughout the app.
- Shared state and settings persistence, account state sync, service contracts, runtime-specific adapters, and registered native commands.
- Native window minimize/maximize/close implementations, subject to Windows testing.
- Current installer workflow and asset-copy safeguards.

## Implementation stages

### Stage 1 — Real desktop state and Steam library
- Separate desktop device records from preview samples and cloud-synced catalog records. Never populate verified installations from sample data or another PC's saved paths.
- Improve Valve manifest parsing, Steam/library discovery, ID deduplication, and readable missing/inaccessible-folder results.
- Verify installation directories and measure their file sizes without following links outside the game folder.
- Feed verified results into existing game views and counts; retain the App ID-only visibility rule.
- Add Steam launching for verified installed App IDs using Steam's supported mechanism, not a raw game executable or ownership bypass.
- Test parsing, stale manifests, duplicate IDs, real temporary folder sizes, and bridge registration.

### Stage 2 — Configuration discovery and safe editing
- Add an action to open supported configuration files from the existing Files view, and a native selection flow for configurations outside the installation directory.
- Distinguish imported app-managed text from authorized on-disk configuration targets.
- Validate canonical paths, selected/approved locations, file types, content sizes, and link traversal. Reject executable/binary targets.
- Read disk content before editing. Preserve an existing file in a durable backup before every overwrite, regardless of the optional automatic-backup setting.
- Use unique temporary files and safe replacement; report failure without changing the saved UI state.
- Make rename/remove actions explicit about whether they affect tracked records or real files; never claim a disk operation that did not happen.
- Test real temporary-file read/write, backup-before-overwrite, invalid paths/types, and failed-write preservation.

### Stage 3 — Backup history and restore
- Store native backup references and original-path metadata, using collision-resistant timestamps/IDs.
- Read durable native backup history and show it through the existing history view.
- Require confirmation before replacing a file, preserve its current version, restore through the service, then read back the actual result.
- Validate backup paths and metadata; never replace unreadable disk content with a silent fallback.
- Test repeated backups, metadata failures, restore results, and traversal rejection.

### Stage 4 — Persistent configuration presets
- Store actual file snapshots with each user-created preset and show included files using existing controls.
- Add validated preset file import/export. Match games by Steam App ID; do not trust imported absolute paths as permission to write.
- Let users review target files before applying. Validate every target before changes and back up every existing destination.
- Roll back successful earlier writes if a later file fails, and report any rollback failure clearly.
- Test payload validation, round-trip import/export, target validation, and multi-file apply failure.

### Stage 5 — Authorized downloads and truthful metrics/settings
- Remove simulated download progression; browser native-download requests must report desktop-only availability.
- Register native progress handling at application scope and create queue records before starting jobs.
- Validate user-provided URLs and filenames, enforce safe destination directories, use unique partial files, and never overwrite unrelated existing files.
- Implement cancellation, cleanup, accurate received-byte progress, and error reporting; reconcile interrupted jobs after reopening. Persist configured download destination and enforce concurrency.
- Replace invented dashboard/system values with detected values or unavailable states. Counts and recent-management activity derive from verified installations and successful operations while retaining search-only visibility.
- Wire supported settings; keep unsupported platform/plugin controls visibly unavailable rather than implying they work. Startup/tray integration, if supported, must use Tauri-native facilities.
- Test progress state, cancellation, errors, queue limits, and browser isolation.

### Stage 6 — Verification and Windows packaging
- Keep focused frontend regression tests and Rust temporary-file tests in the repository.
- Add explicit least-privilege Tauri capabilities for required event/dialog/window operations and verify command names against registrations.
- Run relevant tests after each stage; check the automatically generated frontend build reports rather than manually running the Lovable build.
- Add native test checks to the Windows workflow before packaging, ensuring failed tests cannot publish an installer.
- Verify the end-to-end UI with the native bridge emulated where Windows is unavailable. Label that verification honestly.
- Build a new installer through the Windows workflow and verify on a real Windows PC: scan → select App ID → discover/read/edit/save → inspect backup → restore → create/import/apply preset → authorized download/cancel → launch through Steam.

## Technical approach
- Keep UI access to native operations exclusively behind `src/services/`, with matching TypeScript command contracts and Rust registrations.
- Maintain the shared React store as the presentation source of truth; device-local native state must not be overwritten by cloud state from another PC.
- Keep filesystem/Steam/download implementation in the existing Rust backend; introduce tested helper modules only where separation is necessary, recording structural rules in `AGENTS.md`.
- Preserve every content route's existing app-specific metadata and the static desktop packaging flow.
- No piracy tools, game unlocking, ownership bypasses, memory manipulation, or unauthorized Steam interception.

## Completion criteria and limits
- No success notification precedes completed native work.
- No sample installation or simulated completion counts as a real result.
- Existing-file changes always preserve a recoverable copy, and restores require confirmation.
- Browser tests and emulated bridge tests do not prove Windows behavior. Windows registry, permissions, Steam launch, window actions, and installer operation remain unverified until the Windows workflow/PC checks succeed.