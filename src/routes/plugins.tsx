import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Info, Puzzle, Search, Trash2 } from "lucide-react";
import { fmtDate, useStore } from "@/lib/store";
import { EmptyState, PageToolbar } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Plugin } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/plugins")({
  head: () => ({
    meta: [
      { title: "Plugins — AfScripts" },
      { name: "description", content: "Enable, disable and manage AfScripts plugins." },
      { property: "og:title", content: "Plugins — AfScripts" },
      { property: "og:description", content: "Enable, disable and manage AfScripts plugins." },
    ],
  }),
  component: Plugins,
});

function Plugins() {
  const { plugins, update, log, notify } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [cat, setCat] = useState("all");
  const [details, setDetails] = useState<Plugin | null>(null);
  const [removing, setRemoving] = useState<Plugin | null>(null);

  const list = useMemo(() => plugins.filter((p) =>
    (status === "all" || (status === "enabled") === p.enabled) && (cat === "all" || p.category === cat) &&
    (!q || `${p.name} ${p.description} ${p.author}`.toLowerCase().includes(q.toLowerCase()))), [plugins, q, status, cat]);

  const toggle = (p: Plugin) => {
    update("plugins", (ps) => ps.map((x) => x.id === p.id ? { ...x, enabled: !x.enabled } : x));
    log("plugin", `${p.enabled ? "Disabled" : "Enabled"} ${p.name}`);
    notify(`${p.name} ${p.enabled ? "disabled" : "enabled"}`);
  };

  return (
    <div>
      <PageToolbar>
        <div className="relative w-full sm:w-64"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search plugins" className="h-8 pl-8 text-xs" /></div>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Any status</SelectItem><SelectItem value="enabled">Enabled</SelectItem><SelectItem value="disabled">Disabled</SelectItem></SelectContent></Select>
        <Select value={cat} onValueChange={setCat}><SelectTrigger className="h-8 w-[calc(50%-4px)] text-xs sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All categories</SelectItem>{["Utility", "Visual", "Performance", "Integration"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        <span className="ml-auto text-xs text-muted-foreground">{plugins.filter((p) => p.enabled).length} of {plugins.length} enabled</span>
      </PageToolbar>

      {list.length === 0 ? <div className="rounded-lg border bg-card"><EmptyState icon={Puzzle} title="No plugins found" description="Adjust your search or filters." /></div> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <div key={p.id} className={cn("flex flex-col rounded-lg border bg-card p-4 transition-colors", p.enabled && "border-primary/25")}>
              <div className="flex items-start gap-3">
                <div className={cn("grid size-9 shrink-0 place-items-center rounded-md", p.enabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}><Puzzle className="size-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">v{p.version} · {p.author}</p>
                </div>
                <Switch checked={p.enabled} onCheckedChange={() => toggle(p)} aria-label={`Toggle ${p.name}`} />
              </div>
              <p className="mt-3 line-clamp-2 flex-1 text-xs text-muted-foreground">{p.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1 border-t pt-3">
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{p.category}</span>
                <span className={cn("text-[11px]", p.enabled ? "text-success" : "text-muted-foreground")}>· {p.enabled ? "Enabled" : "Disabled"}</span>
                <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={() => setDetails(p)}><Info className="size-3.5" /> Details</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setRemoving(p)}><Trash2 className="size-3.5" /> Uninstall</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!details} onOpenChange={(o) => !o && setDetails(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{details?.name}</DialogTitle><DialogDescription>{details?.description}</DialogDescription></DialogHeader>
          <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-y-2 text-xs">
            <dt className="text-muted-foreground">Version</dt><dd>{details?.version}</dd>
            <dt className="text-muted-foreground">Author</dt><dd>{details?.author}</dd>
            <dt className="text-muted-foreground">Category</dt><dd>{details?.category}</dd>
            <dt className="text-muted-foreground">Installed</dt><dd>{details && fmtDate(details.installedAt)}</dd>
            <dt className="text-muted-foreground">Status</dt><dd>{details?.enabled ? "Enabled" : "Disabled"}</dd>
          </dl>
          <DialogFooter>{details && <Button variant={details.enabled ? "secondary" : "default"} onClick={() => { toggle(details); setDetails(null); }}>{details.enabled ? "Disable" : "Enable"}</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Uninstall {removing?.name}?</AlertDialogTitle><AlertDialogDescription>The plugin will be removed from AfScripts.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
              if (!removing) return;
              update("plugins", (ps) => ps.filter((x) => x.id !== removing.id)); log("plugin", `Uninstalled ${removing.name}`); notify("Plugin uninstalled", removing.name);
            }}>Uninstall</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
