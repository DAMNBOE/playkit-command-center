import { createServerFn } from "@tanstack/react-start";
import { parseAppId } from "./game-visibility";
import type { SteamSearchResult } from "@/services/types";
export type { SteamSearchResult } from "@/services/types";

/** Searches Steam's public store catalog (no account needed). Server-side to avoid CORS. */
export const searchSteamStore = createServerFn({ method: "GET" })
  .inputValidator((input: { term: string }) => {
    const term = String(input?.term ?? "").trim().slice(0, 100);
    if (term.length < 2) throw new Error("Type at least 2 characters");
    return { term };
  })
  .handler(async ({ data }): Promise<SteamSearchResult[]> => {
    const appId = parseAppId(data.term);
    if (appId) {
      const r = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic`);
      if (!r.ok) throw new Error(`Steam store returned ${r.status}`);
      const j = (await r.json()) as Record<string, { success: boolean; data?: { name: string; header_image: string } }>;
      const d = j[appId];
      return d?.success && d.data ? [{ appId: Number(appId), name: d.data.name, image: d.data.header_image }] : [];
    }
    return []; // Name searches are not allowed; only Steam App IDs.
  });
