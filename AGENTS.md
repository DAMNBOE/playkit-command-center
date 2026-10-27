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
- Native/file operations go only through `src/services/platform.ts` (`PlatformService`); the browser uses `MockPlatform`, a future Tauri build adds a `TauriPlatform` via `invoke()` — never touch the filesystem elsewhere.
- App chrome (sidebar, top bar, window controls) is `src/components/app/AppShell.tsx`, mounted once in `__root.tsx`.
- Simulated behaviour (downloads, path detection, file listings) must be labelled as simulated in the UI.
