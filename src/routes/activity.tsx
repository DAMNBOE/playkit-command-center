import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Activity as ActIco } from "lucide-react";
import { useStore, useGameVisibility } from "@/lib/store";
import { ActivityIcon, EmptyState, PageToolbar } from "@/components/app/bits";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import type { ActivityType } from "@/lib/types";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Activity — AfScripts" },
      { name: "description", content: "History of configuration changes, imports, exports, backups and presets." },
      { property: "og:title", content: "Activity — AfScripts" },
      { property: "og:description", content: "History of configuration changes, imports, exports, backups and presets." },
    ],
  }),
  component: ActivityPage,
});

const FILTERS: { v: "all" | ActivityType; l: string }[] = [
  { v: "all", l: "All" }, { v: "config", l: "Changes" }, { v: "import", l: "Imports" }, { v: "export", l: "Exports" },
  { v: "backup", l: "Backups" }, { v: "restore", l: "Restores" }, { v: "preset", l: "Presets" }, { v: "plugin", l: "Plugins" }, { v: "download", l: "Downloads" },
];

function dayLabel(iso: string) {
  const d = new Date(iso); const t = new Date();
  const diff = Math.floor((new Date(t.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5);
  if (diff === 0) return "Today"; if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function ActivityPage() {
  const { update } = useStore();
  const { activity, gameById } = useGameVisibility();
  const [f, setF] = useState<"all" | ActivityType>("all");
  const groups = useMemo(() => {
    const m = new Map<string, typeof activity>();
    activity.filter((a) => f === "all" || a.type === f).forEach((a) => { const k = dayLabel(a.at); m.set(k, [...(m.get(k) ?? []), a]); });
    return [...m.entries()];
  }, [activity, f]);

  return (
    <div>
      <PageToolbar>
        <ToggleGroup type="single" value={f} onValueChange={(v) => v && setF(v as typeof f)} className="flex-wrap justify-start rounded-md border p-0.5">
          {FILTERS.map((x) => <ToggleGroupItem key={x.v} value={x.v} className="h-7 px-2.5 text-xs">{x.l}</ToggleGroupItem>)}
        </ToggleGroup>
        <Button size="sm" variant="ghost" className="ml-auto" disabled={!activity.length} onClick={() => update("activity", () => [])}>Clear history</Button>
      </PageToolbar>
      {groups.length === 0 ? <div className="rounded-lg border bg-card"><EmptyState icon={ActIco} title="No activity" description="Actions you take in AfScripts will be listed here." /></div> : (
        <div className="space-y-5">
          {groups.map(([day, items]) => (
            <div key={day}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{day}</p>
              <div className="relative rounded-lg border bg-card">
                {items.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-0">
                    <ActivityIcon type={a.type} />
                    <p className="min-w-0 flex-1 break-words text-xs">{a.message}{a.gameId && <span className="text-muted-foreground"> · {gameById(a.gameId)?.name}</span>}</p>
                    <time className="font-mono text-[11px] text-muted-foreground">{new Date(a.at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</time>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
