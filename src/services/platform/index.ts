/**
 * Platform service entry point — the ONLY place UI code gets native/file access from.
 * Browser preview → MockPlatform (simulated). Packaged Windows app → TauriPlatform.
 */
import { MockPlatform } from "./mock";
import { TauriPlatform } from "./tauri";
import type { PlatformService } from "./types";

export * from "./types";
export { MockPlatform, TauriPlatform };

export function getPlatform(): PlatformService {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) return TauriPlatform;
  return MockPlatform;
}

export const isNative = () => getPlatform().kind !== "mock";
