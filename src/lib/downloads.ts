import type { Download } from "./types";

/** Simulation tick: advances active downloads and promotes queued items. */
export function tickDownloads(list: Download[], maxConcurrent: number, rand = Math.random): Download[] {
  let next = list.map((d) => {
    if (d.status !== "active") return d;
    const speed = Math.max(1.5, d.speedMbps + (rand() - 0.5) * 3);
    const progress = Math.min(100, d.progress + (speed / d.sizeMb) * 100);
    return progress >= 100 ? { ...d, progress: 100, speedMbps: 0, status: "completed" as const } : { ...d, progress, speedMbps: speed };
  });
  let active = next.filter((d) => d.status === "active").length;
  next = next.map((d) => {
    if (d.status === "queued" && active < maxConcurrent) { active++; return { ...d, status: "active" as const, speedMbps: 5 }; }
    return d;
  });
  return next;
}

