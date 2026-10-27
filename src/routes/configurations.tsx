import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Archive, FileCode2, FileDown, FileUp, GitCompare, History, MoreHorizontal, Pencil, RotateCcw, Save, Search, Trash2, Undo2,
} from "lucide-react";
import { fmtDate, timeAgo, useStore } from "@/lib/store";
import { EmptyState } from "@/components/app/bits";
import { CodeEditor, diffLines } from "@/components/app/CodeEditor";
import { ImportConfigDialog } from "@/components/app/dialogs";
import { useConfigActions } from "@/lib/config-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getPlatform } from "@/services/platform";
import { cn } from "@/lib/utils";

type Search = { file?: string | undefined; game?: string | undefined };

export const Route = createFileRoute("/configurations")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    file: typeof s["file"] === "string" ? s["file"] : undefined,
    game: typeof s["game"] === "string" ? s["game"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Configuration Manager — AfScripts" },
      { name: "description", content: "View, edit, back up, restore and compare game configuration files in AfScripts." },
      { property: "og:title", content: "Configuration Manager — AfScripts" },
      { property: "og:description", content: "View, edit, back up, restore and compare game configuration files in AfScripts." },
    ],
  }),
  component: ConfigManager,
});

const fmtBadge: Record<string, string> = { ini: "text-info", cfg: "text-primary", json: "text-warning", xml: "text-success", lua: "text-info" };

function ConfigManager() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/configurations" });
  const { configs, games, gameById, update, log, notify, fail } = useStore();
  const { backup, restore, exportFile } = useConfigActions();
  const [q, setQ] = useState("");
  const gameFilter = search.game ?? "all";
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameVal, setRenameVal] = useState("");
  const [renameErr, setRenameErr] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareWith, setCompareWith] = useState<string>("");

  const list = useMemo(() => configs.filter((c) =>
    (gameFilter === "all" || c.gameId === gameFilter) &&
    (!q || c.name.toLowerCase().includes(q.toLowerCase()) || gameById(c.gameId)?.name.toLowerCase().includes(q.toLowerCase()))),
  [configs, gameFilter, q, gameById]);

  const selected = configs.find((c) => c.id === search.file) ?? list[0];
  useEffect(() => { setDraft(selected?.content ?? ""); }, [selected?.id, selected?.content]);
  const dirty = !!selected && draft !== selected.content;

  const select = (id: string) => {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    navigate({ search: (s) => ({ ...s, file: id }) });
  };

  const save = async () => {
    if (!selected) return;
    if (selected.format === "json") {
      try { JSON.parse(draft); } catch (e) { fail("Invalid JSON", (e as Error).message); return; }
    }
    setSaving(true);
    try {
      await getPlatform().writeConfigFile(selected.path, draft);
    } catch (e) {
      setSaving(false);
      fail("Could not save configuration", (e as Error).message);
      return;
    }
    update("configs", (cs) => cs.map((c) => c.id === selected.id ? { ...c, content: draft, modifiedAt: new Date().toISOString(),
      backups: [{ id: Math.random().toString(36).slice(2), label: "Auto backup before save", createdAt: new Date().toISOString(), content: c.content }, ...c.backups].slice(0, 10) } : c));
    update("games", (gs) => gs.map((g) => g.id === selected.gameId ? { ...g, lastModified: new Date().toISOString() } : g));
    log("config", `Edited ${selected.name}`, selected.gameId);
    notify("Configuration saved", "A backup of the previous version was kept.");
    setSaving(false);
  };

  const doRename = () => {
    if (!selected) return;
    const n = renameVal.trim();
    if (!/^[\w\-. ]+\.[a-z0-9]+$/i.test(n)) return setRenameErr("Use a valid file name with an extension");
    if (configs.some((c) => c.gameId === selected.gameId && c.name === n && c.id !== selected.id)) return setRenameErr("A file with this name already exists for this game");
    update("configs", (cs) => cs.map((c) => c.id === selected.id ? { ...c, name: n, path: c.path.replace(/[^\\]+$/, n) } : c));
    log("config", `Renamed ${selected.name} to ${n}`, selected.gameId);
    notify("Renamed", n);
    setRenameOpen(false);
  };

  const doDelete = () => {
    if (!selected) return;
    update("configs", (cs) => cs.filter((c) => c.id !== selected.id));
    log("config", `Deleted ${selected.name}`, selected.gameId);
    notify("Configuration deleted", selected.name);
    navigate({ search: (s) => ({ ...s, file: undefined }) });
  };

  const compareContent = selected?.backups.find((b) => b.id === compareWith)?.content ?? "";
  const diff = compareOpen && selected ? diffLines(compareContent, draft) : [];

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-card xl:h-[calc(100vh-56px-40px)] xl:min-h-[560px] xl:flex-row">
      <div className="flex min-w-0 flex-1 flex-col md:h-[calc(100vh-56px-40px)] md:min-h-[560px] md:flex-row xl:h-auto xl:min-h-0">
      {/* File list */}
      <div className="flex w-full shrink-0 flex-col border-b md:w-72 md:border-b-0 md:border-r">
        <div className="space-y-2 border-b p-3">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter files" className="h-8 pl-8 text-xs" /></div>
          <Select value={gameFilter} onValueChange={(v) => navigate({ search: { game: v === "all" ? undefined : v } })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All games</SelectItem>{games.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="max-h-56 flex-1 overflow-auto p-1.5 md:max-h-none">
          {list.length === 0 && <EmptyState icon={FileCode2} title="No files" description="Import a configuration to get started." />}
          {list.map((c) => (
            <button key={c.id} onClick={() => select(c.id)} className={cn("flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left", selected?.id === c.id ? "bg-primary/12 ring-1 ring-primary/30" : "hover:bg-accent/50")}>
              <FileCode2 className={cn("mt-0.5 size-4 shrink-0", fmtBadge[c.format])} />
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-medium">{c.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{gameById(c.gameId)?.name} · {timeAgo(c.modifiedAt)}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="border-t p-2"><Button size="sm" variant="secondary" className="w-full" onClick={() => setImportOpen(true)}><FileDown className="size-4" /> Import file</Button></div>
      </div>

      {/* Editor */}
      {selected ? (
        <div className="flex min-h-[420px] min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-1 border-b px-3 py-2">
            <div className="mr-auto min-w-0 basis-full sm:basis-0 sm:flex-1">
              <p className="flex min-w-0 items-center gap-2 truncate font-mono text-[13px] font-semibold">{selected.name}{dirty && <span className="size-1.5 rounded-full bg-warning" title="Unsaved changes" />}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">{selected.path}</p>
            </div>
            <ToolBtn label="Revert changes" icon={Undo2} disabled={!dirty} onClick={() => setDraft(selected.content)} />
            <ToolBtn label="Create backup" icon={Archive} onClick={() => backup(selected)} />
            <ToolBtn label="Compare versions" icon={GitCompare} disabled={!selected.backups.length} onClick={() => { setCompareWith(selected.backups[0]?.id ?? ""); setCompareOpen(true); }} />
            <ToolBtn label="Export" icon={FileUp} onClick={() => exportFile({ ...selected, content: draft })} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="size-8"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setRenameVal(selected.name); setRenameErr(""); setRenameOpen(true); }}><Pencil className="size-4" /> Rename</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/games/$gameId", params: { gameId: selected.gameId } })}>Open game</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="size-4" /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" className="ml-1" disabled={!dirty || saving} onClick={save}><Save className="size-4" /> {saving ? "Saving…" : "Save"}</Button>
          </div>
          <CodeEditor
            value={draft} onChange={setDraft} format={selected.format}
            footer={
              <div className="flex items-center gap-4 border-t px-3 py-1.5 text-[10px] text-muted-foreground">
                <span className="uppercase">{selected.format}</span><span>{draft.split("\n").length} lines</span><span>UTF-8</span>
                <span className="ml-auto">{dirty ? "Unsaved changes" : `Saved ${timeAgo(selected.modifiedAt)}`}</span>
              </div>
            }
          />
        </div>
      ) : (
        <div className="grid flex-1 place-items-center"><EmptyState icon={FileCode2} title="Select a configuration" description="Choose a file from the list to view and edit it." /></div>
      )}
      </div>

      {/* Details */}
      {selected && (
        <div className="flex w-full shrink-0 flex-col border-t xl:w-64 xl:border-l xl:border-t-0">
          <div className="border-b p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">File details</p>
            <dl className="space-y-1.5 text-xs">
              {[["Game", gameById(selected.gameId)?.name], ["Format", selected.format.toUpperCase()], ["Size", `${new Blob([draft]).size} bytes`], ["Modified", fmtDate(selected.modifiedAt)]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2"><dt className="text-muted-foreground">{k}</dt><dd className="truncate text-right">{v}</dd></div>
              ))}
            </dl>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><History className="size-3" /> Backups ({selected.backups.length})</p>
            <div className="max-h-72 flex-1 space-y-1.5 overflow-auto xl:max-h-none">
              {selected.backups.length === 0 && <p className="text-xs text-muted-foreground">No backups yet.</p>}
              {selected.backups.map((b) => (
                <div key={b.id} className="group rounded-md border bg-background/40 p-2">
                  <p className="truncate text-xs font-medium">{b.label}</p>
                  <p className="text-[10px] text-muted-foreground">{timeAgo(b.createdAt)}</p>
                  <div className="mt-1.5 flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => restore(selected, b.id)}><RotateCcw className="size-3" /> Restore</Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => { setCompareWith(b.id); setCompareOpen(true); }}><GitCompare className="size-3" /> Compare</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ImportConfigDialog open={importOpen} onOpenChange={setImportOpen} defaultGameId={search.game} onImported={(id) => navigate({ search: (s) => ({ ...s, file: id }) })} />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Rename configuration</DialogTitle><DialogDescription>Enter a new file name.</DialogDescription></DialogHeader>
          <Input value={renameVal} onChange={(e) => setRenameVal(e.target.value)} className="font-mono" onKeyDown={(e) => e.key === "Enter" && doRename()} />
          {renameErr && <p className="text-[11px] text-destructive">{renameErr}</p>}
          <DialogFooter><Button variant="ghost" onClick={() => setRenameOpen(false)}>Cancel</Button><Button onClick={doRename}>Rename</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete {selected?.name}?</AlertDialogTitle><AlertDialogDescription>This removes the configuration and all its backups from AfScripts.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader><DialogTitle>Compare versions</DialogTitle><DialogDescription>Backup (left) compared with the current editor content.</DialogDescription></DialogHeader>
          <Select value={compareWith} onValueChange={setCompareWith}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choose backup" /></SelectTrigger>
            <SelectContent>{selected?.backups.map((b) => <SelectItem key={b.id} value={b.id}>{b.label} · {timeAgo(b.createdAt)}</SelectItem>)}</SelectContent>
          </Select>
          <div className="max-h-[50vh] overflow-auto rounded-md border bg-background/60 py-2 font-mono text-[12px] leading-[1.6]">
            {diff.map((l, i) => (
              <div key={i} className={cn("whitespace-pre px-3", l.type === "add" && "bg-success/12 text-success", l.type === "del" && "bg-destructive/12 text-destructive")}>
                <span className="mr-3 inline-block w-3 select-none opacity-60">{l.type === "add" ? "+" : l.type === "del" ? "−" : " "}</span>{l.text || " "}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{diff.filter((d) => d.type === "add").length} additions · {diff.filter((d) => d.type === "del").length} removals</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToolBtn({ label, icon: Icon, onClick, disabled }: { label: string; icon: typeof Save; onClick: () => void; disabled?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild><Button size="icon" variant="ghost" className="size-8" onClick={onClick} disabled={disabled} aria-label={label}><Icon className="size-4" /></Button></TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
