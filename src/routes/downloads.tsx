import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { uid } from "@/lib/store";
import { AlertTriangle, CheckCircle2, Clock, Download as DlIcon, FlaskConical, Pause, Play, RotateCw, Trash2, X } from "lucide-react";
import { useStore, useGameVisibility, timeAgo } from "@/lib/store";
import { EmptyState, Panel } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getServices, isDesktopRuntime } from "@/services";
import type { Download, DownloadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/downloads")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  cancelled: { label: "Cancelled", cls: "text-muted-foreground", icon: X },
  failed: { label: "Failed", cls: "text-destructive", icon: AlertTriangle },
};

const fmtMb = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(mb < 10 ? 1 : 0)} MB`);

function Downloads() {
  const { update, settings, log, notify, fail } = useStore();
  const { downloads, gameById } = useGameVisibility();

  const desktop = isDesktopRuntime();
  const [url, setUrl] = useState("");

  const addDownload = async () => {
    const u = url.trim();
    if (!/^https?:\/\//.test(u)) { fail("Enter a valid http(s) link"); return; }
    const id = uid();
    let name: string;
    try { name = new URL(u).pathname.split("/").pop() || "download"; } catch { fail("Enter a valid file URL"); return; }
    if (!desktop) { fail("Downloads require the Windows app"); return; }
    update("downloads", ds => [{ id,name,url:u,sizeMb:0,progress:0,speedMbps:0,status:"queued",addedAt:new Date().toISOString() },...ds]);
    setUrl("");
  };

  const set = (id: string, patch: Partial<Download>) => update("downloads", (ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const pause = async (d: Download) => {
    try { await getServices().downloads.pause(d.id); set(d.id, { status: "paused", speedMbps: 0 }); }
    catch (e) { fail("Could not pause download", (e as Error).message); }
  };
  const resume = async (d: Download) => {
    if (desktop && d.url) {
      try { await getServices().downloads.start(d.id, d.url,settings.downloadPath); set(d.id, { status: "active" }); }
      catch (e) { fail("Could not resume download", (e as Error).message); }
      return;
    }
    set(d.id, { status: "queued" });
  };
  const cancel = async (d: Download) => {
    if (["completed","failed","cancelled","queued"].includes(d.status)) { update("downloads",ds => ds.filter(x => x.id !== d.id)); return; }
    try { await getServices().downloads.cancel(d.id); }
    catch(e) { fail("Could not cancel download",String(e)); }
  };
  const retry = (d: Download) => set(d.id,{ status:"queued",progress:0,receivedBytes:0,error:undefined });
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
      <div className="flex items-center gap-3 border-b px-3 py-3 last:border-0 sm:gap-4 sm:px-4">
        <div className={cn("grid size-8 shrink-0 place-items-center rounded-md bg-muted", m.cls)}><m.icon className="size-4" /></div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-2">
            <p className="truncate font-medium">{d.name}</p>
            <span className="truncate text-[11px] text-muted-foreground">{gameById(d.gameId)?.name}</span>
          </div>
          <Progress value={d.progress} className={cn("h-1.5", d.status === "failed" && "[&>div]:bg-destructive", d.status === "completed" && "[&>div]:bg-success")} />
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
            <span className={m.cls}>{m.label}</span>
            <span>{fmtMb((d.receivedBytes ?? 0) / 1048576)} / {fmtMb(d.sizeMb)}</span>
            {d.status === "active" && <span>{d.speedMbps.toFixed(1)} MB/s</span>}
            {d.status === "active" && <span>{d.sizeMb ? `~${Math.ceil(((100 - d.progress) / 100) * d.sizeMb / Math.max(0.1,d.speedMbps))}s left` : "Size unknown"}</span>}
            <span className="ml-auto">Added {timeAgo(d.addedAt)}</span>
          </div>
          {d.error && <p className="text-xs text-destructive">{d.error}</p>}
          {d.savedTo && <p className="truncate font-mono text-xs text-muted-foreground">{d.savedTo}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
          {d.status === "active" && <Act label="Pause" icon={Pause} onClick={() => pause(d)} />}
          {(d.status === "paused") && <Act label="Resume" icon={Play} onClick={() => resume(d)} />}
          {d.status === "failed" && <Act label="Retry" icon={RotateCw} onClick={() => retry(d)} />}
          {!["completed","cancelled"].includes(d.status) ? <Act label="Cancel" icon={X} onClick={() => cancel(d)} /> : <Act label="Remove" icon={Trash2} onClick={() => cancel(d)} />}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {desktop ? (
        <form onSubmit={(e) => { e.preventDefault(); void addDownload(); }} className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a direct file link (https://…) — saved to Downloads\\AfScripts" className="h-9 font-mono text-xs" />
          <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" required />I’m authorized to download this file</label>
          <Button type="submit" size="sm" className="h-9"><DlIcon className="size-4" /> Download</Button>
        </form>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-2.5 text-xs">
          <FlaskConical className="size-4 shrink-0 text-warning" />
          <span><strong className="font-semibold">Windows app required.</strong> No files are downloaded by this browser preview.</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Active", groups.active.length], ["Queued", groups.queued.length], ["Completed", groups.completed.length], ["Total speed", `${totalSpeed.toFixed(1)} MB/s`]].map(([k, v]) => (
          <div key={String(k)} className="rounded-lg border bg-card p-3.5"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1 text-xl font-bold tabular-nums">{v}</p></div>
        ))}
      </div>
      <Tabs defaultValue="all">
        <div className="flex flex-wrap items-center gap-2">
          <div className="-mx-1 max-w-full overflow-x-auto px-1"><TabsList>
            <TabsTrigger value="all">All ({groups.all.length})</TabsTrigger>
            <TabsTrigger value="active">Active ({groups.active.length})</TabsTrigger>
            <TabsTrigger value="queued">Queue ({groups.queued.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({groups.completed.length})</TabsTrigger>
            <TabsTrigger value="failed">Failed ({groups.failed.length})</TabsTrigger>
          </TabsList></div>
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
