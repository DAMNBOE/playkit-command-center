import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Layers, MoreHorizontal, Pencil, Plus, Search, Trash2, FileUp } from "lucide-react";
import { fmtDate, useStore, useGameVisibility } from "@/lib/store";
import { EmptyState, GameCover, PageToolbar, downloadFile } from "@/components/app/bits";
import { PresetDialog } from "@/components/app/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  const { update, log, notify } = useStore();
  const { presets, games, gameById } = useGameVisibility();
  const [q, setQ] = useState("");
  const [game, setGame] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Preset | null>(null);
  const [deleting, setDeleting] = useState<Preset | null>(null);

  const list = useMemo(() => presets.filter((p) => (game === "all" || p.gameId === game) && (!q || `${p.name} ${p.description}`.toLowerCase().includes(q.toLowerCase()))), [presets, q, game]);

  const exportPreset = (p: Preset) => {
    downloadFile(`${p.name.replace(/\W+/g, "-").toLowerCase()}.afpreset.json`, JSON.stringify({ ...p, game: gameById(p.gameId)?.name, app: "AfScripts" }, null, 2));
    log("export", `Exported preset ${p.name}`, p.gameId); notify("Preset exported", p.name);
  };

  return (
    <div>
      <PageToolbar>
        <div className="relative w-full sm:w-64"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search presets" className="h-8 pl-8 text-xs" /></div>
        <Select value={game} onValueChange={setGame}>
          <SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All games</SelectItem>{games.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" className="ml-auto" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" /> Create preset</Button>
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
                <span className="hidden truncate text-xs text-muted-foreground md:block">{p.description || "—"}</span>
                <span className="hidden text-xs text-muted-foreground md:block">{fmtDate(p.createdAt)}</span>
                <span className="hidden text-xs text-muted-foreground md:block">{fmtDate(p.updatedAt)}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="size-7" aria-label="Preset actions"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="size-4" /> Edit</DropdownMenuItem>
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
