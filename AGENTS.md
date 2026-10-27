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
- All app state lives in `src/lib/store.tsx` (React context, cached in localStorage); signed-in users' whole state is mirrored as one JSON row in `public.user_state` — keeps one source of truth with simple sync.
- Real Windows file/Steam/download logic lives only in `src-tauri/src/commands.rs`; config read/write is restricted to absolute paths with text config extensions, and backups go to %APPDATA%\AfScripts\backups — limits what the app can touch on disk.
- Native/file operations go only through `src/services/` (`getServices()` → browser adapter in `mock/`, Tauri adapter in `tauri/` when `__TAURI_INTERNALS__` exists); command names in `commands.ts` must match `src-tauri/src/commands.rs`. Browser adapter throws `DesktopOnlyError` rather than faking files or Steam detection.
- Demo/sample content lives only in `src/mocks/` so it can be dropped once real native data is wired in.
- Errors use `fail()` from the store (always shown); `notify()` is only called after an operation has actually completed.
- Mobile (<md) uses a Sheet navigation drawer sharing `SidebarContent` with the desktop sidebar; wide tables scroll horizontally or collapse columns instead of overflowing the page.
- App chrome (sidebar, top bar, window controls) is `src/components/app/AppShell.tsx`, mounted once in `__root.tsx`.
- Simulated behaviour (downloads) must be labelled in the UI; the runtime is shown by `EnvironmentBadge`. Packaging steps live in `docs/DESKTOP.md`.
- The shared sidebar's WindowsDownload control must report installer unavailability until a real release artifact is hosted; never substitute source archives or placeholder downloads for an installer.
