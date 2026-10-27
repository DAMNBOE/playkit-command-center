import { describe, expect, it } from "vitest";
import { canRegisterAppWorker } from "@/lib/pwa-context";

const published = { production: true, hostname: "info.handicraftglobal.in", framed: false, search: "", protocol: "https:", desktop: false };

describe("app service-worker safety", () => {
  it("allows published custom and Lovable domains", () => {
    expect(canRegisterAppWorker(published)).toBe(true);
    expect(canRegisterAppWorker({ ...published, hostname: "playkit-command-center.lovable.app" })).toBe(true);
    expect(canRegisterAppWorker({ ...published, hostname: "preview-v2--shop.example.com" })).toBe(true);
  });
  it("blocks every supported preview hostname even in production", () => {
    for (const hostname of ["id-preview--df5e9a3d-0cbc-4ab9-8b32-4df8bba1d35d.lovable.app", "preview-2--app.gpt-eng.com", "preview--app.gptengineer.run", "project--df5e9a3d-0cbc-4ab9-8b32-4df8bba1d35d-dev.lovable.app", "a.lovableproject.com", "lovableproject-dev.com", "a.beta.lovable.dev", "LOCALHOST"]) {
      expect(canRegisterAppWorker({ ...published, hostname })).toBe(false);
    }
  });
  it("blocks development, iframes, desktop and the kill switch", () => {
    expect(canRegisterAppWorker({ ...published, production: false })).toBe(false);
    expect(canRegisterAppWorker({ ...published, framed: true })).toBe(false);
    expect(canRegisterAppWorker({ ...published, desktop: true })).toBe(false);
    expect(canRegisterAppWorker({ ...published, protocol: "tauri:" })).toBe(false);
    expect(canRegisterAppWorker({ ...published, search: "?sw=off" })).toBe(false);
  });
});