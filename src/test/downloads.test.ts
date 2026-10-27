import { describe, expect, it } from "vitest";
import { tickDownloads } from "@/lib/downloads";
import type { Download } from "@/lib/types";

const mk = (id: string, status: Download["status"], progress = 0): Download => ({ id, name: id, sizeMb: 10, progress, speedMbps: 5, status, addedAt: "" });

describe("download simulation", () => {
  it("never runs more downloads than the concurrent limit", () => {
    const out = tickDownloads([mk("a", "active"), mk("b", "queued"), mk("c", "queued")], 2, () => 0.5);
    expect(out.filter((d) => d.status === "active")).toHaveLength(2);
  });
  it("marks a download completed when it reaches 100%", () => {
    const out = tickDownloads([mk("a", "active", 99)], 2, () => 0.5);
    expect(out[0].status).toBe("completed");
  });
  it("does not advance paused downloads", () => {
    const out = tickDownloads([mk("a", "paused", 40)], 2, () => 0.5);
    expect(out[0].progress).toBe(40);
  });
});
