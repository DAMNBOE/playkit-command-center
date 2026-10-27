import { describe, expect, it } from "vitest";
import { DesktopOnlyError, getServices, NATIVE_COMMANDS } from "@/services";

describe("browser services", () => {
  it("reports browser preview without filesystem access", () => {
    const env = getServices().environment;
    expect(env.kind).toBe("browser");
    expect(env.canAccessFilesystem).toBe(false);
  });
  it("refuses Steam detection instead of faking a path", async () => {
    await expect(getServices().library.detectInstallPath(620, "Portal 2")).rejects.toBeInstanceOf(DesktopOnlyError);
  });
  it("refuses local file listing", async () => {
    await expect(getServices().library.listGameFiles("C:\\Games")).rejects.toBeInstanceOf(DesktopOnlyError);
  });
  it("names the native detection command", () => {
    expect(NATIVE_COMMANDS.detectInstallPath).toBe("detect_install_path");
  });
});
