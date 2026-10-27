import { createServerFn } from "@tanstack/react-start";

export interface SteamSearchResult { appId: number; name: string; image: string }

/** Searches Steam's public store catalog (no account needed). Server-side to avoid CORS. */
export const searchSteamStore = createServerFn({ method: "GET" })
  .inputValidator((input: { term: string }) => {
    const term = String(input?.term ?? "").trim().slice(0, 100);
    if (term.length < 2) throw new Error("Type at least 2 characters");
    return { term };
  })
  .handler(async ({ data }): Promise<SteamSearchResult[]> => {
    if (/^\d+$/.test(data.term)) {
      const r = await fetch(`https://store.steampowered.com/api/appdetails?appids=${data.term}&filters=basic`);
      if (!r.ok) throw new Error(`Steam store returned ${r.status}`);
      const j = (await r.json()) as Record<string, { success: boolean; data?: { name: string; header_image: string } }>;
      const d = j[data.term];
      return d?.success && d.data ? [{ appId: Number(data.term), name: d.data.name, image: d.data.header_image }] : [];
    }
    const r = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(data.term)}&l=english&cc=US`);
    if (!r.ok) throw new Error(`Steam store returned ${r.status}`);
    const j = (await r.json()) as { items?: { id: number; name: string; tiny_image: string }[] };
    return (j.items ?? []).slice(0, 10).map((i) => ({ appId: i.id, name: i.name, image: i.tiny_image }));
  });
