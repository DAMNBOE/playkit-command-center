import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { Layers, MoreHorizontal, Pencil, Plus, Search, Trash2, FileUp, Play, Download } from "lucide-react";
import { fmtDate, useStore, useGameVisibility } from "@/lib/store";
import { EmptyState, GameCover, PageToolbar, downloadFile } from "@/components/app/bits";
import { PresetDialog } from "@/components/app/dialogs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { parsePresetFile, presetFileSchema } from "@/lib/preset-files";
import { getServices, isDesktopRuntime } from "@/services";
import { loadNativeConfig } from "@/lib/config-actions";
import type { Preset } from "@/lib/types";

export const Route = createFileRoute("/presets")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Presets — AfScripts" },
      { name: "description", content: "Create, edit, export and delete configuration presets for your games." },
      { property: "og:title", content: "Presets — AfScripts" },
      { property: "og:description", content: "Create, edit, export and delete configuration presets for your games." },
    ],
  }),
  component: Presets,
});

function Presets() {
  const { update, log, notify, fail } = useStore();
  const { presets, games, gameById, configs } = useGameVisibility();
  const [q, setQ] = useState("");
  const [game, setGame] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Preset | null>(null);
  const [deleting, setDeleting] = useState<Preset | null>(null);

  const importRef = useRef<HTMLInputElement>(null);
  const [applying, setApplying] = useState<Preset | null>(null);
  const [targets, setTargets] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState(false);
  const importPreset = async (file?: File) => {
    if (!file) return;
    try {
      const data = parsePresetFile(await file.text());
      const g = games.find(g => g.appId === data.appId);
      if (!g) throw new Error("Search the preset's Steam App ID before importing it");
      const now=new Date().toISOString();
      update("presets",ps => [{ id:crypto.randomUUID(),name:data.name,description:data.description,gameId:g.id,files:data.files,createdAt:now,updatedAt:now },...ps]);
      log("preset",`Imported preset ${data.name}`,g.id); notify("Preset imported",data.name);
    } catch(e) { fail("Preset import failed",String(e)); }
    if (importRef.current) importRef.current.value="";
  };
  const beginApply = (p: Preset) => {
    setTargets(Object.fromEntries((p.files ?? []).map(f => [f.name,configs.find(c => c.gameId === p.gameId && c.native && c.name === f.name)?.path ?? ""])));
    setApplying(p);
  };
  const selectTarget = async (name: string) => {
    try { const path=await getServices().configs.select(); if (path) setTargets(t => ({ ...t,[name]:path })); }
    catch(e) { fail("Could not select target",String(e)); }
  };
  const apply = async () => {
    const p=applying; const g=p && gameById(p.gameId);
    if (!p || !g) return;
    setBusy(true);
    try {
      const files=(p.files ?? []).map(f => ({ path:targets[f.name] ?? "",content:f.content }));
      if (!files.length || files.some(f => !f.path)) throw new Error("Select every target file");
      await getServices().presets.apply(String(g.appId),files);
      const actual=await Promise.all(files.map(f => loadNativeConfig(f.path,g.id)));
      update("configs",cs => [...actual,...cs.filter(c => !files.some(f => f.path === c.path))]);
      update("games",gs => gs.map(x => x.id === g.id ? { ...x,configStatus:"configured",lastModified:new Date().toISOString() } : x));
      log("preset",`Applied ${p.name}`,g.id); notify("Preset applied",p.name); setApplying(null);
    } catch(e) { fail("Preset apply failed",String(e)); }
    finally { setBusy(false); }
  };
  const list = useMemo(() => presets.filter((p) => (game === "all" || p.gameId === game) && (!q || `${p.name} ${p.description}`.toLowerCase().includes(q.toLowerCase()))), [presets, q, game]);

  const exportPreset = (p: Preset) => {
    try {
      const data=presetFileSchema.parse({app:"AfScripts",version:1,appId:gameById(p.gameId)?.appId,name:p.name,description:p.description,files:p.files ?? []});
      downloadFile(`${p.name.replace(/\W+/g,"-").toLowerCase()}.afpreset.json`,JSON.stringify(data,null,2));
      log("export",`Exported preset ${p.name}`,p.gameId); notify("Preset exported",p.name);
    } catch(e) { fail("Preset export failed",String(e)); }
  };

  return (
    <div>
      <PageToolbar>
        <div className="relative w-full sm:w-64"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search presets" className="h-8 pl-8 text-xs" /></div>
        <Select value={game} onValueChange={setGame}>
          <SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All games</SelectItem>{games.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
        </Select>
        <input type="file" hidden ref={importRef} accept=".json" onChange={e => importPreset(e.target.files?.[0])} />
        <Button size="sm" variant="secondary" className="ml-auto" onClick={() => importRef.current?.click()}><Download className="size-4" /> Import</Button>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" /> Create preset</Button>
      </PageToolbar>

      {list.length === 0 ? (
        <div className="rounded-lg border bg-card"><EmptyState icon={Layers} title={presets.length ? "No presets match" : "No presets yet"} description="Presets save a set of configuration values for quick reuse." action={<Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>Create preset</Button>} /></div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="hidden md:grid grid-cols-[1.3fr_1fr_2fr_110px_110px_40px] gap-3 border-b px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <span>Preset</span><span>Game</span><span>Description</span><span>Created</span><span>Updated</span><span />
          </div>
          {list.map((p) => {
            const g = gameById(p.gameId);
            return (
              <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[1.3fr_1fr_2fr_110px_110px_40px] items-center gap-3 border-b px-4 py-2.5 last:border-0 hover:bg-accent/30">
                <span className="min-w-0"><span className="flex items-center gap-2 font-medium"><Layers className="size-3.5 shrink-0 text-primary" /><span className="truncate">{p.name}</span></span><span className="block truncate pl-5.5 text-[11px] text-muted-foreground md:hidden">{g?.name ?? "Removed game"} · {fmtDate(p.updatedAt)}</span></span>
                {g ? <Link to="/games/$gameId" params={{ gameId: g.id }} className="hidden items-center gap-2 truncate text-xs hover:text-primary md:flex"><GameCover game={g} className="h-5 w-7 shrink-0 [&>div:nth-child(3)]:hidden" />{g.name}</Link> : <span className="hidden text-xs text-muted-foreground md:inline">Removed game</span>}
                <span className="hidden truncate text-xs text-muted-foreground md:block">{p.description || "—"} · {p.files?.length ?? 0} files</span>
                <span className="hidden text-xs text-muted-foreground md:block">{fmtDate(p.createdAt)}</span>
                <span className="hidden text-xs text-muted-foreground md:block">{fmtDate(p.updatedAt)}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="size-7" aria-label="Preset actions"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="size-4" /> Edit</DropdownMenuItem>
                    <DropdownMenuItem disabled={!isDesktopRuntime() || !g?.verified || !p.files?.length} onClick={() => beginApply(p)}><Play className="size-4" /> Apply</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportPreset(p)}><FileUp className="size-4" /> Export</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleting(p)}><Trash2 className="size-4" /> Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!applying} onOpenChange={o => { if (!o && !busy) setApplying(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Apply {applying?.name}</DialogTitle><DialogDescription>Review the destination files. Existing files will be backed up before replacement.</DialogDescription></DialogHeader>
          <div className="space-y-3 max-h-80 overflow-auto">{applying?.files?.map(f => <div key={f.name} className="space-y-1"><p className="text-sm font-medium">{f.name}</p><div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate font-mono text-xs">{targets[f.name] || "No target selected"}</span><Button size="sm" variant="secondary" disabled={busy} onClick={() => selectTarget(f.name)}>Select</Button></div><details><summary className="text-xs text-muted-foreground">Review contents</summary><pre className="max-h-32 overflow-auto text-xs">{f.content}</pre></details></div>)}</div>
          <DialogFooter><Button variant="ghost" disabled={busy} onClick={() => setApplying(null)}>Cancel</Button><Button disabled={busy || applying?.files?.some(f => !targets[f.name])} onClick={apply}>{busy ? "Applying…" : "Back up and apply"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <PresetDialog open={open} onOpenChange={setOpen} preset={editing} />
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete preset “{deleting?.name}”?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
              if (!deleting) return;
              update("presets", (ps) => ps.filter((x) => x.id !== deleting.id));
              log("preset", `Deleted preset ${deleting.name}`, deleting.gameId); notify("Preset deleted", deleting.name);
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
