// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Desktop (Tauri) builds need plain static files with an index.html; the web build stays SSR.
const desktop = process.env['AFSCRIPTS_DESKTOP'] === "1";

export default defineConfig({
  // Tauri serves the app from a custom protocol, so absolute "/assets/..." URLs fail to load
  // (white, unstyled window). Relative paths keep CSS/JS/images working inside the desktop app.
  vite: desktop ? { base: "./" } : {},
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    ...(desktop ? { spa: { enabled: true } } : {}),
  },
});
