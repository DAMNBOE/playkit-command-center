import { describe, expect, it } from "vitest";
import { matchesGameIdentity, visibleGameRecords } from "@/lib/game-visibility";
import { sampleGames } from "@/mocks/sample-data";

describe("Search-only game visibility everywhere", () => {
  it("hides every game for empty or whitespace searches", () => {
    for (const query of ["", "   "]) expect(sampleGames.filter((g) => matchesGameIdentity(g, query))).toEqual([]);
  });
  it("reveals only a matching game name, case-insensitively", () => {
    expect(sampleGames.filter((g) => matchesGameIdentity(g, " ELDEN RING ")).map((g) => g.id)).toEqual(["eldenring"]);
  });
  it("requires the complete Steam App ID and does not match genres", () => {
    expect(sampleGames.filter((g) => matchesGameIdentity(g, "730")).map((g) => g.id)).toEqual(["cs2"]);
    expect(sampleGames.filter((g) => matchesGameIdentity(g, "73"))).toEqual([]);
    expect(sampleGames.filter((g) => matchesGameIdentity(g, "Uncategorized"))).toEqual([]);
  });
  it("hides related records until their game matches without removing unrelated records", () => {
    const records = [{ id: "cs", gameId: "cs2" }, { id: "er", gameId: "eldenring" }, { id: "other" }];
    expect(visibleGameRecords(records, sampleGames, "").map((r) => r.id)).toEqual(["other"]);
    expect(visibleGameRecords(records, sampleGames, "730").map((r) => r.id)).toEqual(["cs", "other"]);
    expect(visibleGameRecords(records, sampleGames, "no matching game").map((r) => r.id)).toEqual(["other"]);
    expect(visibleGameRecords(records, sampleGames, " ").map((r) => r.id)).toEqual(["other"]);
    expect(records).toHaveLength(3);
  });
});
import { parseAppId } from "@/lib/game-visibility";
describe("parseAppId", () => {
  it("accepts App ID formats", () => {
    expect(parseAppId("730")).toBe("730");
    expect(parseAppId(" App ID 578080 ")).toBe("578080");
    expect(parseAppId("https://store.steampowered.com/app/570/Dota_2/")).toBe("570");
    expect(parseAppId("Portal 2")).toBeNull();
  });
});
