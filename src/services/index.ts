/**
 * Service entry point — the ONLY place UI code gets native/file access from.
 * Browser preview → browserServices. Packaged Windows app → tauriServices.
 */
import { browserServices } from "./mock";
import { tauriServices } from "./tauri";
import type { AppServices } from "./types";

export * from "./types";
export { NATIVE_COMMANDS } from "./commands";

export function isDesktopRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function getServices(): AppServices {
  return isDesktopRuntime() ? tauriServices : browserServices;
}

export const getEnvironment = () => getServices().environment;
