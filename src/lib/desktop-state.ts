import type { Game, Download } from './types';
import type { DetectedGame, DownloadProgress } from '@/services/types';
export function mergeDetectedGames(games: Game[], found: DetectedGame[]): Game[] {
  const byApp = new Map(games.map(g => [g.appId, g]));
  const next = games.map(g => ({ ...g, installed: false, verified: false, installPath: '', sizeGb: 0 }));
  for (const f of found) {
    const existing = byApp.get(f.appId);
    const detected: Game = { ...(existing ?? { id: `steam-${f.appId}`, configStatus: 'none', lastModified: '', genre: 'Uncategorized', hue: (f.appId * 37) % 360, favorite: false, developer: '—' }), name: f.name, appId: f.appId, installed: true, verified: true, installPath: f.installPath, sizeGb: f.sizeBytes / 1073741824 };
    const i = next.findIndex(g => g.appId === f.appId);
    if (i < 0) next.push(detected); else next[i] = detected;
  }
  return next;
}
export function reconcileDownloads(downloads: Download[]): Download[] {
  return downloads.filter(d => d.url).map(d => ['active','paused','queued'].includes(d.status) ? { ...d, status: 'failed', speedMbps: 0, error: 'Interrupted when AfScripts closed. Retry to start a new transfer.' } : d);
}
export function applyDownloadProgress(d: Download, p: DownloadProgress): Download {
  if (d.id !== p.id) return d;
  const terminal = p.status === 'completed' || p.status === 'failed' || p.status === 'cancelled';
  return { ...d, receivedBytes: p.received, sizeMb: p.total / 1048576, progress: p.status === 'completed' ? 100 : p.total ? Math.min(100, p.received / p.total * 100) : 0, speedMbps: terminal ? 0 : Math.max(0, (p.received - (d.receivedBytes ?? 0)) / 1048576 / 0.3), status: p.status === 'cancelled' ? 'cancelled' : p.status === 'active' && d.status === 'paused' ? 'paused' : p.status, savedTo: p.status === 'completed' ? p.path : d.savedTo, error: p.error ?? undefined };
}
