<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Steam identity linking uses authenticated server functions plus a public OpenID callback with Steam check_authentication, hashed HttpOnly-cookie-bound one-time attempts and durable nonce replay protection; only verified server writes populate owner-readable Steam accounts, separate from workspace/device state, because static installers cannot host callbacks.
- Steam catalog lookup uses a native library service command in Tauri and a server function on the web; never call web RPCs from the static desktop search because the installer contains no Start server.
- Web installability uses a static manifest; offline caching uses vite-plugin-pwa generateSW and only src/lib/pwa.ts registers /sw.js, refusing preview/dev/iframe/Tauri contexts and supporting ?sw=off — prevents stale editor and desktop assets. Never cache API/auth/OAuth responses or precache SSR HTML.
- Game visibility is derived by `useGameVisibility()` from a transient shared identity search; stored collections and mutation callbacks stay complete so filtering cannot delete hidden data. Never persist the search or use raw collections for game-related presentation.
- All app state lives in `src/lib/store.tsx`; browser accounts mirror one JSON row in `public.user_state`, while desktop uses a separate device-local key and no cloud overwrite — another PC's paths and sample installed flags must not become trusted device state.
- Native operations live in `src-tauri/src/commands.rs`, with filesystem primitives in `src-tauri/src/files.rs`; existing supported files require a detected Steam root or explicit native selection, and every disk replacement records one durable backup before mutation — keeps permissions and recovery at the native boundary.
- Presets store filename/content snapshots; imported paths are never write permissions and apply requires reviewed authorized targets plus an installed Steam App ID — prevents portable presets from silently writing arbitrary paths.
- Download queue and event subscriptions live at store scope, with queued records created before native start; progress comes only from native events, files use unique partial/final names, and interrupted jobs require retry — navigation and fast completions cannot lose results.
- Native compiled artifacts must never remain in the repository; local full-Cargo checks use a temporary target directory and Windows CI runs tests before installer packaging — avoids shipping generated binaries as source.
- Native/file operations go only through `src/services/` (`getServices()` → browser adapter in `mock/`, Tauri adapter in `tauri/` when `__TAURI_INTERNALS__` exists); command names in `commands.ts` must match `src-tauri/src/commands.rs`. Browser adapter throws `DesktopOnlyError` rather than faking files or Steam detection.
- Demo/sample content lives only in `src/mocks/` so it can be dropped once real native data is wired in.
- Errors use `fail()` from the store (always shown); `notify()` is only called after an operation has actually completed.
- Mobile (<md) uses a Sheet navigation drawer sharing `SidebarContent` with the desktop sidebar; wide tables scroll horizontally or collapse columns instead of overflowing the page.
- App chrome (sidebar, top bar, window controls) is `src/components/app/AppShell.tsx`, mounted once in `__root.tsx`.
- Browser native operations throw `DesktopOnlyError`; imported workspace text is edited in the store, never presented as a disk write, and download simulation is disabled. The runtime is shown by `EnvironmentBadge`. Packaging steps live in `docs/DESKTOP.md`; desktop builds use `bun run build:desktop` (static SPA via `AFSCRIPTS_DESKTOP=1`) and are produced by `.github/workflows/windows-release.yml` on a Windows runner, keeping the web build SSR. `scripts/desktop-index.mjs` copies the whole client output folder (it is `.output/public` on Windows CI) into `dist/client` and fails if any referenced asset is missing — copying only the html ships an unstyled app.
- The shared sidebar's WindowsDownload control links only to real GitHub Release installer assets (version + size in `RELEASE`); update it when a new release is published, never point it at source archives or placeholders.
