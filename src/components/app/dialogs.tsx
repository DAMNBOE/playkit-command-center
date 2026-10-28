import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { uid, useStore, useGameVisibility } from "@/lib/store";
import { GameIdentitySearch } from "./GameIdentitySearch";
import { configFormat, isSupportedConfig } from "@/lib/preset-files";
import { loadNativeConfig } from "@/lib/config-actions";
import type { ConfigFile, Preset } from "@/lib/types";
import { getEnvironment, getServices } from "@/services";
import { Loader2, Upload } from "lucide-react";

type Errs = Partial<Record<"name" | "appId" | "path" | "gameId" | "description", string>>;

function FieldError({ msg }: { msg?: string | undefined }) {
  return msg ? <p className="text-[11px] text-destructive">{msg}</p> : null;
}

export function AddGameDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { update, games, log, notify } = useStore();
  const [name, setName] = useState("");
  const [appId, setAppId] = useState("");
  const [installed, setInstalled] = useState(false);
  const [path, setPath] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [errors, setErrors] = useState<Errs>({});

  useEffect(() => { if (open) { setName(""); setAppId(""); setPath(""); setErrors({}); setInstalled(false); } }, [open]);

  const detect = async () => {
    if (!name.trim()) { setErrors({ name: "Enter a game name first" }); return; }
    setDetecting(true);
    try {
      const p = await getServices().library.detectInstallPath(Number(appId), name.trim());
      if (p) setPath(p); else setErrors({ path: "Install folder not found — enter it manually" });
    } catch (e) { setErrors({ path: (e as Error).message }); }
    setDetecting(false);
  };

  const submit = async () => {
    const e: Errs = {};
    if (name.trim().length < 2) e.name = "Name must be at least 2 characters";
    const id = Number(appId);
    if (!/^\d{1,8}$/.test(appId)) e.appId = "App ID must be a number (1–8 digits)";
    else if (games.some((g) => g.appId === id)) e.appId = "A game with this App ID already exists";
    if (installed && !path.trim()) e.path = "Installation path is required for installed games";
    setErrors(e);
    if (Object.keys(e).length) return;
    let verifiedPath = "";
    let sizeGb = 0;
    if (installed) {
      try {
        const found = await getServices().library.scanLibrary("");
        const match = found.find(g => g.appId === id);
        if (!match) { setErrors({ path:"This App ID is not installed through Steam" }); return; }
        verifiedPath = match.installPath; sizeGb = match.sizeBytes / 1073741824;
      } catch(e) { setErrors({ path:String(e) }); return; }
    }
    const gid = uid();
    update("games", (gs) => [{
      id: gid, name: name.trim(), appId: id, installed, verified: installed, configStatus: "none", lastModified: new Date().toISOString(),
      installPath: verifiedPath, sizeGb, genre: "Uncategorized", hue: Math.floor(Math.random() * 360),
      favorite: false, developer: "Unknown",
    }, ...gs]);
    log("game", `Added ${name.trim()} to library`, gid);
    notify("Game added", name.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add game</DialogTitle><DialogDescription>Add a game to your AfScripts library.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Game name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Portal 2" /><FieldError msg={errors.name} /></div>
          <div className="space-y-1.5"><Label>Steam App ID</Label><Input value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="620" className="font-mono" /><FieldError msg={errors.appId} /></div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2"><Label>Installed on this PC</Label><Switch disabled={!getEnvironment().canDetectGames} checked={installed} onCheckedChange={setInstalled} /></div>
          {installed && (
            <div className="space-y-1.5">
              <Label>Installation path</Label>
              <div className="flex gap-2">
                <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="C:\Games\…" className="font-mono text-xs" />
                <Button variant="secondary" onClick={detect} disabled={detecting || !getEnvironment().canDetectGames}>{detecting ? <Loader2 className="size-4 animate-spin" /> : "Detect"}</Button>
              </div>
              <FieldError msg={errors.path} />
              <p className="text-[10px] text-muted-foreground">{getEnvironment().canDetectGames ? "Detect looks up the folder in your Steam libraries." : "Automatic detection needs the desktop app — type the path manually."}</p>
            </div>
          )}
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit}>Add game</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const extFormat = (name: string): ConfigFile["format"] => {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "json") return "json";
  if (ext === "lua") return "lua";
  if (ext === "xml" || ext === "lsx") return "xml";
  if (ext === "ini" || ext === "settings") return "ini";
  return "cfg";
};

export function ImportConfigDialog({ open, onOpenChange, defaultGameId, onImported }: { open: boolean; onOpenChange: (o: boolean) => void; defaultGameId?: string | undefined; onImported?: (id: string) => void }) {
  const { update, log, notify } = useStore();
  const { games } = useGameVisibility();
  const [gameId, setGameId] = useState(defaultGameId ?? "");
  const [file, setFile] = useState<{ name: string; content: string; path?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setGameId(defaultGameId ?? ""); setFile(null); setError(""); } }, [open, defaultGameId]);

  const onFile = async (f?: File) => {
    if (!f) return;
    if (!isSupportedConfig(f.name)) { setError("Unsupported configuration file type"); return; }
    if (f.size > 512 * 1024) { setError("File is larger than 512 KB"); return; }
    setFile({ name: f.name, content: await f.text() }); setError("");
  };

  const selectNative = async () => {
    setBusy(true); setError("");
    try {
      const path = await getServices().configs.select();
      if (path) { const content=await getServices().configs.read(path); if (content === null) throw new Error("File no longer exists"); setFile({ name:path.split(/[\\/]/).pop() ?? path,content,path }); }
    } catch(e) { setError(String(e)); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    if (!games.some(g => g.id === gameId)) return setError("Select a matching game");
    if (!file) return setError("Choose a configuration file");
    setBusy(true);
    try {
      const c: ConfigFile = file.path ? await loadNativeConfig(file.path,gameId) : { id:uid(),gameId,name:file.name,path:`workspace/${file.name}`,native:false,format:configFormat(file.name),content:file.content,modifiedAt:new Date().toISOString(),backups:[] };
      update("configs",cs => [c,...cs.filter(x => x.path !== c.path || x.gameId !== gameId)]);
      update("games",gs => gs.map(g => g.id === gameId ? { ...g,configStatus:"partial",lastModified:new Date().toISOString() } : g));
      log("import",`${c.native ? "Opened disk file" : "Imported workspace copy"} ${c.name}`,gameId);
      notify(c.native ? "Configuration opened" : "Workspace copy imported",c.name);
      onOpenChange(false); onImported?.(c.id);
    } catch(e) { setError(String(e)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Import configuration</DialogTitle><DialogDescription>Load a text-based config file (.ini, .cfg, .json, .xml, .lua).</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Game</Label>
            <GameIdentitySearch />
            <Select value={games.some((g) => g.id === gameId) ? gameId : ""} onValueChange={setGameId}>
              <SelectTrigger><SelectValue placeholder="Select a game" /></SelectTrigger>
              <SelectContent>{games.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {getEnvironment().canAccessFilesystem && <Button variant="secondary" disabled={busy} onClick={selectNative}>Select file on this PC</Button>}
          <button onClick={() => ref.current?.click()} className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-7 text-xs text-muted-foreground hover:border-primary/50 hover:bg-primary/5">
            <Upload className="size-5" />
            {file ? <span className="font-mono text-foreground">{file.name}</span> : "Click to choose a file"}
          </button>
          <input ref={ref} type="file" hidden accept=".ini,.cfg,.json,.xml,.lua,.txt,.lsx,.settings" onChange={(e) => onFile(e.target.files?.[0])} />
          <FieldError msg={error} />
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={busy} onClick={submit}>{busy ? "Opening…" : "Import"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PresetDialog({ open, onOpenChange, preset, defaultGameId }: { open: boolean; onOpenChange: (o: boolean) => void; preset?: Preset | null; defaultGameId?: string | undefined }) {
  const { presets, update, log, notify } = useStore();
  const { games, configs } = useGameVisibility();
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [gameId, setGameId] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Errs>({});

  useEffect(() => {
    if (open) {
      setName(preset?.name ?? ""); setGameId(preset?.gameId ?? defaultGameId ?? ""); setDescription(preset?.description ?? ""); setErrors({}); setSelectedFiles([]);
    }
  }, [open, preset, defaultGameId]);

  const submit = () => {
    const e: Errs = {};
    const n = name.trim();
    if (n.length < 3) e.name = "Name must be at least 3 characters";
    else if (n.length > 48) e.name = "Name must be 48 characters or fewer";
    else if (presets.some((p) => p.name.toLowerCase() === n.toLowerCase() && p.id !== preset?.id)) e.name = "A preset with this name already exists";
    if (!games.some((g) => g.id === gameId)) e.gameId = "Select a matching game";
    const snapshots = selectedFiles.length ? configs.filter(c => c.gameId === gameId && selectedFiles.includes(c.id)).map(c => ({ name:c.name,content:c.content })) : preset?.files ?? [];
    if (!snapshots.length) e.description = "Select at least one configuration file";
    if (description.length > 200) e.description = "Description must be 200 characters or fewer";
    setErrors(e);
    if (Object.keys(e).length) return;
    const now = new Date().toISOString();
    if (preset) {
      update("presets", (ps) => ps.map((p) => p.id === preset.id ? { ...p, name: n, gameId, description: description.trim(), files:snapshots, updatedAt: now } : p));
      log("preset", `Updated preset ${n}`, gameId); notify("Preset updated", n);
    } else {
      update("presets", (ps) => [{ id: uid(), name: n, gameId, description: description.trim(), files:snapshots, createdAt: now, updatedAt: now }, ...ps]);
      log("preset", `Created preset ${n}`, gameId); notify("Preset created", n);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{preset ? "Edit preset" : "Create preset"}</DialogTitle><DialogDescription>Presets bundle configuration values you can apply to a game.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Preset name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Competitive Low-Latency" /><FieldError msg={errors.name} /></div>
          <div className="space-y-1.5">
            <Label>Associated game</Label>
            <GameIdentitySearch />
            <Select value={games.some((g) => g.id === gameId) ? gameId : ""} onValueChange={setGameId}>
              <SelectTrigger><SelectValue placeholder="Select a game" /></SelectTrigger>
              <SelectContent>{games.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
            <FieldError msg={errors.gameId} />
          </div>
          <div className="space-y-1.5">
            <Label>Configuration files</Label>
            {configs.filter(c => c.gameId === gameId).map(c => <label key={c.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selectedFiles.includes(c.id)} onChange={e => setSelectedFiles(ids => e.target.checked ? [...ids,c.id] : ids.filter(id => id !== c.id))} />{c.name}</label>)}
            {!!preset?.files?.length && <p className="text-xs text-muted-foreground">{preset.files.length} saved files retained unless replaced.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What does this preset change?" />
            <div className="flex justify-between"><FieldError msg={errors.description} /><span className="ml-auto text-[10px] text-muted-foreground">{description.length}/200</span></div>
          </div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit}>{preset ? "Save changes" : "Create preset"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
