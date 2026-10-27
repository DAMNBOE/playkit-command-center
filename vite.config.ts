// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// Desktop (Tauri) builds need plain static files with an index.html; the web build stays SSR.
const desktop = process.env['AFSCRIPTS_DESKTOP'] === "1";

export default defineConfig({
  plugins: desktop ? [] : [VitePWA({
    strategies: "generateSW",
    filename: "sw.js",
    outDir: "dist/client",
    manifest: false,
    injectRegister: null,
    registerType: "autoUpdate",
    devOptions: { enabled: false },
    workbox: {
      // SSR HTML must be network-first, never included in the precache.
      globPatterns: ["assets/**/*.{js,css,woff,woff2,png,jpg,svg}", "icons/*.png", "favicon.png", "manifest.webmanifest"],
      navigateFallback: null,
      cleanupOutdatedCaches: true,
      skipWaiting: true,
      clientsClaim: true,
      runtimeCaching: [
        {
          urlPattern: ({ request, url, sameOrigin }) => sameOrigin && request.mode === "navigate" && !/^\/(?:~oauth|api|auth)(?:\/|$)/.test(url.pathname),
          handler: "NetworkFirst",
          options: { cacheName: "afscripts-pages", networkTimeoutSeconds: 4, cacheableResponse: { statuses: [200] }, expiration: { maxEntries: 24, maxAgeSeconds: 86400 } },
        },
        {
          urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/assets\/.*-[a-zA-Z0-9_-]{8,}\.(?:js|css|woff2?|png|jpg|svg)$/.test(url.pathname),
          handler: "CacheFirst",
          options: { cacheName: "afscripts-assets", cacheableResponse: { statuses: [200] }, expiration: { maxEntries: 160, maxAgeSeconds: 2592000 } },
        },
      ],
    },
  })],
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
