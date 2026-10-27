import { uid, useStore } from "./store";
import { getPlatform } from "@/services/platform";
import { downloadFile } from "@/components/app/bits";
import type { ConfigFile } from "./types";

/** Shared configuration operations (backup, restore, export) used across pages. */
export function useConfigActions() {
  const { update, log, notify, settings } = useStore();

  const backup = async (c: ConfigFile, label = "Manual backup") => {
    await getPlatform().createBackup(c.path, c.content);
    update("configs", (cs) => cs.map((x) => x.id === c.id
      ? { ...x, backups: [{ id: uid(), label, createdAt: new Date().toISOString(), content: c.content }, ...x.backups].slice(0, settings.backupLimit) }
      : x));
    log("backup", `Backup created for ${c.name}`, c.gameId);
    notify("Backup created", c.name);
  };

  const restore = (c: ConfigFile, backupId: string) => {
    const b = c.backups.find((x) => x.id === backupId);
    if (!b) return;
    update("configs", (cs) => cs.map((x) => x.id === c.id ? { ...x, content: b.content, modifiedAt: new Date().toISOString() } : x));
    log("restore", `Restored backup of ${c.name}`, c.gameId);
    notify("Backup restored", `${c.name} · ${b.label}`);
  };

  const exportFile = (c: ConfigFile) => {
    downloadFile(c.name, c.content);
    log("export", `Exported ${c.name}`, c.gameId);
    notify("Configuration exported", c.name);
  };

  return { backup, restore, exportFile };
}
