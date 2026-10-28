import type { Download } from "./types";
/** Compatibility helper: time alone never changes transfer state. Only native byte events can. */
export function tickDownloads(list: Download[], _maxConcurrent: number, _rand = Math.random): Download[] { return list; }
