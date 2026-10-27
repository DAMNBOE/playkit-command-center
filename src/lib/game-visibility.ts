import type { Game } from "./types";

export function matchesGameIdentity(game: Game, query: string): boolean {
  const identity = query.trim().toLowerCase();
  if (!identity) return false;
  // Numeric identities must be a complete App ID, not a broad numeric prefix.
  if (/^\d+$/.test(identity)) return String(game.appId) === identity;
  return game.name.toLowerCase().includes(identity);
}

export function visibleGameRecords<T extends { gameId?: string | undefined }>(records: T[], games: Game[], query: string): T[] {
  const ids = new Set(games.filter((g) => matchesGameIdentity(g, query)).map((g) => g.id));
  return records.filter((record) => !record.gameId || ids.has(record.gameId));
}