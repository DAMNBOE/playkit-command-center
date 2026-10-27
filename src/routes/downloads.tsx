import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Clock, Download as DlIcon, FlaskConical, Pause, Play, RotateCw, Trash2, X } from "lucide-react";
import { useStore, timeAgo } from "@/lib/store";
import { EmptyState, Panel } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getPlatform } from "@/services/platform";
import type { Download, DownloadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { tickDownloads } from "@/lib/downloads";

export const Route = createFileRoute("/downloads")({
  head: () => ({
    meta: [
      { title: "Downloads — AfScripts" },
      { name: "description", content: "Download queue with progress, speed and status controls in AfScripts." },
      { property: "og:title", content: "Downloads — AfScripts" },
      { property: "og:description", content: "Download queue with progress, speed and status controls in AfScripts." },
    ],
  }),
  component: Downloads,
});

const statusMeta: Record<DownloadStatus, { label: string; cls: string; icon: typeof Clock }> = {
  queued: { label: "Queued", cls: "text-muted-foreground", icon: Clock },
  active: { label: "Downloading", cls: "text-info", icon: DlIcon },
  paused: { label: "Paused", cls: "text-warning", icon: Pause },
  completed: { label: "Completed", cls: "text-success", icon: CheckCircle2 },
  failed: { label: "Failed", cls: "text-destructive", icon: AlertTriangle },
};

const fmtMb = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(mb < 10 ? 1 : 0)} MB`);

function Downloads() {
  const { downloads, update, settings, log, notify, fail, gameById } = useStore();

  useEffect(() => {
    const t = setInterval(() => {
      update("downloads", (ds) => {
        const next = tickDownloads(ds, settings.maxConcurrent);
        next.forEach((d, i) => { if (d.status === "completed" && ds[i]?.status === "active") setTimeout(() => { notify("Download complete (simulated)", d.name); log("download", `Completed download: ${d.name}`, d.gameId); }); });
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [update, settings.maxConcurrent, notify, log]);

  const set = (id: string, patch: Partial<Download>) => update("downloads", (ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const pause = async (d: Download) => {
    try { await getPlatform().pauseDownload(d.id); set(d.id, { status: "paused", speedMbps: 0 }); }
    catch (e) { fail("Could not pause download", (e as Error).message); }
  };
  const resume = (d: Download) => set(d.id, { status: "queued" });
  const cancel = async (d: Download) => {
    try { await getPlatform().cancelDownload(d.id); }
    catch (e) { fail("Could not cancel download", (e as Error).message); return; }
    update("downloads", (ds) => ds.filter((x) => x.id !== d.id)); notify("Download cancelled", d.name);
  };
  const retry = (d: Download) => { set(d.id, { status: "queued", progress: 0 }); log("download", `Retrying download: ${d.name}`, d.gameId); };
  const clearCompleted = () => update("downloads", (ds) => ds.filter((d) => d.status !== "completed"));

  const groups = {
    all: downloads,
    active: downloads.filter((d) => d.status === "active" || d.status === "paused"),
    queued: downloads.filter((d) => d.status === "queued"),
    completed: downloads.filter((d) => d.status === "completed"),
    failed: downloads.filter((d) => d.status === "failed"),
  };
  const totalSpeed = groups.active.reduce((s, d) => s + d.speedMbps, 0);

  const Row = ({ d }: { d: Download }) => {
    const m = statusMeta[d.status];
    return (
      <div className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
        <div className={cn("grid size-8 shrink-0 place-items-center rounded-md bg-muted", m.cls)}><m.icon className="size-4" /></div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-baseline gap-2">
            <p className="truncate font-medium">{d.name}</p>
            <span className="text-[11px] text-muted-foreground">{gameById(d.gameId)?.name}</span>
          </div>
          <Progress value={d.progress} className={cn("h-1.5", d.status === "failed" && "[&>div]:bg-destructive", d.status === "completed" && "[&>div]:bg-success")} />
          <div className="flex gap-4 text-[11px] text-muted-foreground tabular-nums">
            <span className={m.cls}>{m.label}</span>
            <span>{fmtMb((d.progress / 100) * d.sizeMb)} / {fmtMb(d.sizeMb)}</span>
            {d.status === "active" && <span>{d.speedMbps.toFixed(1)} MB/s</span>}
            {d.status === "active" && <span>~{Math.ceil(((100 - d.progress) / 100) * d.sizeMb / Math.max(0.1, d.speedMbps))}s left</span>}
            <span className="ml-auto">Added {timeAgo(d.addedAt)}</span>
          </div>
        </div>
        <div className="flex gap-1">
          {d.status === "active" && <Act label="Pause" icon={Pause} onClick={() => pause(d)} />}
          {(d.status === "paused") && <Act label="Resume" icon={Play} onClick={() => resume(d)} />}
          {d.status === "failed" && <Act label="Retry" icon={RotateCw} onClick={() => retry(d)} />}
          {d.status !== "completed" ? <Act label="Cancel" icon={X} onClick={() => cancel(d)} /> : <Act label="Remove" icon={Trash2} onClick={() => cancel(d)} />}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-2.5 text-xs">
        <FlaskConical className="size-4 text-warning" />
        <span><strong className="font-semibold">Simulated downloads.</strong> Progress shown here is a preview simulation — nothing is downloaded to your PC until the Windows app is connected.</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Active", groups.active.length], ["Queued", groups.queued.length], ["Completed", groups.completed.length], ["Total speed", `${totalSpeed.toFixed(1)} MB/s`]].map(([k, v]) => (
          <div key={String(k)} className="rounded-lg border bg-card p-3.5"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1 text-xl font-bold tabular-nums">{v}</p></div>
        ))}
      </div>
      <Tabs defaultValue="all">
        <div className="flex items-center">
          <TabsList>
            <TabsTrigger value="all">All ({groups.all.length})</TabsTrigger>
            <TabsTrigger value="active">Active ({groups.active.length})</TabsTrigger>
            <TabsTrigger value="queued">Queue ({groups.queued.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({groups.completed.length})</TabsTrigger>
            <TabsTrigger value="failed">Failed ({groups.failed.length})</TabsTrigger>
          </TabsList>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={clearCompleted} disabled={!groups.completed.length}>Clear completed</Button>
        </div>
        {(Object.keys(groups) as (keyof typeof groups)[]).map((k) => (
          <TabsContent key={k} value={k} className="mt-3">
            <Panel>{groups[k].length ? groups[k].map((d) => <Row key={d.id} d={d} />) : <EmptyState icon={DlIcon} title="Nothing here" description="Downloads in this state will appear here." />}</Panel>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function Act({ label, icon: Icon, onClick }: { label: string; icon: typeof Pause; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild><Button size="icon" variant="ghost" className="size-8" onClick={onClick} aria-label={label}><Icon className="size-4" /></Button></TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
