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
- All app state lives in `src/lib/store.tsx` (React context persisted to localStorage) — single source until a backend is added.
- Native/file operations go only through `src/services/platform/` (`getPlatform()` → `MockPlatform` in browser, `TauriPlatform` when `__TAURI_INTERNALS__` exists); Rust command names live in `NATIVE_COMMANDS` — never touch the filesystem elsewhere.
- Demo/sample content lives only in `src/mocks/` so it can be dropped once real native data is wired in.
- Errors use `fail()` from the store (always shown); `notify()` is only called after an operation has actually completed.
- Mobile (<md) uses a Sheet navigation drawer sharing `SidebarContent` with the desktop sidebar; wide tables scroll horizontally or collapse columns instead of overflowing the page.
- App chrome (sidebar, top bar, window controls) is `src/components/app/AppShell.tsx`, mounted once in `__root.tsx`.
- Simulated behaviour (downloads, path detection, file listings) must be labelled as simulated in the UI.
