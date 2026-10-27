import type { Game } from "./types";

/** Accepts "730", "App ID 730", "#730", or a Steam store URL and returns the bare App ID. */
export function parseAppId(query: string): string | null {
  const q = query.trim();
  const url = q.match(/\/app\/(\d+)/i);
  if (url) return url[1] ?? null;
  const m = q.match(/^(?:app\s*id\s*[:#]?\s*|#)?\s*(\d+)$/i);
  return m ? m[1] ?? null : null;
}

export function matchesGameIdentity(game: Game, query: string): boolean {
  const appId = parseAppId(query);
  // Games are revealed only by Steam App ID, never by name.
  return appId !== null && String(game.appId) === appId;
}

export function visibleGameRecords<T extends { gameId?: string | undefined }>(records: T[], games: Game[], query: string): T[] {
  const ids = new Set(games.filter((g) => matchesGameIdentity(g, query)).map((g) => g.id));
  return records.filter((record) => !record.gameId || ids.has(record.gameId));
}