import { canRegisterAppWorker } from "./pwa-context";

// The only app-shell service-worker registrar. Never run in SSR, desktop or preview.
export async function registerAppWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const allowed = canRegisterAppWorker({
    production: import.meta.env.PROD,
    hostname: window.location.hostname,
    framed: window.self !== window.top,
    search: window.location.search,
    protocol: window.location.protocol,
    desktop: "__TAURI_INTERNALS__" in window,
  });
  if (!allowed) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter((registration) =>
      [registration.active, registration.waiting, registration.installing].some((worker) =>
        worker && new URL(worker.scriptURL).origin === window.location.origin && new URL(worker.scriptURL).pathname === "/sw.js",
      ),
    ).map((registration) => registration.unregister()));
    return;
  }
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}