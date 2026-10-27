import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { uid, useStore } from "@/lib/store";
import type { ConfigFile, Preset } from "@/lib/types";
import { getPlatform } from "@/services/platform";
import { Loader2, Upload } from "lucide-react";

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="text-[11px] text-destructive">{msg}</p> : null;
}

export function AddGameDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { update, games, log, notify } = useStore();
  const [name, setName] = useState("");
  const [appId, setAppId] = useState("");
  const [installed, setInstalled] = useState(true);
  const [path, setPath] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { if (open) { setName(""); setAppId(""); setPath(""); setErrors({}); setInstalled(true); } }, [open]);

  const detect = async () => {
    if (!name.trim()) { setErrors({ name: "Enter a game name first" }); return; }
    setDetecting(true);
    const p = await getPlatform().detectInstallPath(Number(appId), name.trim());
    setPath(p ?? ""); setDetecting(false);
  };

  const submit = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Name must be at least 2 characters";
    const id = Number(appId);
    if (!/^\d{1,8}$/.test(appId)) e.appId = "App ID must be a number (1–8 digits)";
    else if (games.some((g) => g.appId === id)) e.appId = "A game with this App ID already exists";
    if (installed && !path.trim()) e.path = "Installation path is required for installed games";
    setErrors(e);
    if (Object.keys(e).length) return;
    const gid = uid();
    update("games", (gs) => [{
      id: gid, name: name.trim(), appId: id, installed, configStatus: "none", lastModified: new Date().toISOString(),
      installPath: installed ? path.trim() : "—", sizeGb: 0, genre: "Uncategorized", hue: Math.floor(Math.random() * 360),
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
          <div className="flex items-center justify-between rounded-md border px-3 py-2"><Label>Installed on this PC</Label><Switch checked={installed} onCheckedChange={setInstalled} /></div>
          {installed && (
            <div className="space-y-1.5">
              <Label>Installation path</Label>
              <div className="flex gap-2">
                <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="C:\Games\…" className="font-mono text-xs" />
                <Button variant="secondary" onClick={detect} disabled={detecting}>{detecting ? <Loader2 className="size-4 animate-spin" /> : "Detect"}</Button>
              </div>
              <FieldError msg={errors.path} />
              <p className="text-[10px] text-muted-foreground">Detection is simulated in preview mode.</p>
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

export function ImportConfigDialog({ open, onOpenChange, defaultGameId, onImported }: { open: boolean; onOpenChange: (o: boolean) => void; defaultGameId?: string; onImported?: (id: string) => void }) {
  const { games, update, log, notify } = useStore();
  const [gameId, setGameId] = useState(defaultGameId ?? "");
  const [file, setFile] = useState<{ name: string; content: string } | null>(null);
  const [error, setError] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setGameId(defaultGameId ?? ""); setFile(null); setError(""); } }, [open, defaultGameId]);

  const onFile = async (f?: File) => {
    if (!f) return;
    if (f.size > 512 * 1024) { setError("File is larger than 512 KB"); return; }
    setFile({ name: f.name, content: await f.text() }); setError("");
  };

  const submit = () => {
    if (!gameId) return setError("Select a game");
    if (!file) return setError("Choose a configuration file");
    const id = uid();
    update("configs", (cs) => [{ id, gameId, name: file.name, path: `imported\\${file.name}`, format: extFormat(file.name), content: file.content, modifiedAt: new Date().toISOString(), backups: [] }, ...cs]);
    update("games", (gs) => gs.map((g) => g.id === gameId ? { ...g, configStatus: g.configStatus === "none" ? "partial" : g.configStatus, lastModified: new Date().toISOString() } : g));
    log("import", `Imported ${file.name}`, gameId);
    notify("Configuration imported", file.name);
    onOpenChange(false);
    onImported?.(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Import configuration</DialogTitle><DialogDescription>Load a text-based config file (.ini, .cfg, .json, .xml, .lua).</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Game</Label>
            <Select value={gameId} onValueChange={setGameId}>
              <SelectTrigger><SelectValue placeholder="Select a game" /></SelectTrigger>
              <SelectContent>{games.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <button onClick={() => ref.current?.click()} className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-7 text-xs text-muted-foreground hover:border-primary/50 hover:bg-primary/5">
            <Upload className="size-5" />
            {file ? <span className="font-mono text-foreground">{file.name}</span> : "Click to choose a file"}
          </button>
          <input ref={ref} type="file" hidden accept=".ini,.cfg,.json,.xml,.lua,.txt,.lsx,.settings" onChange={(e) => onFile(e.target.files?.[0])} />
          <FieldError msg={error} />
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit}>Import</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PresetDialog({ open, onOpenChange, preset, defaultGameId }: { open: boolean; onOpenChange: (o: boolean) => void; preset?: Preset | null; defaultGameId?: string }) {
  const { games, presets, update, log, notify } = useStore();
  const [name, setName] = useState("");
  const [gameId, setGameId] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(preset?.name ?? ""); setGameId(preset?.gameId ?? defaultGameId ?? ""); setDescription(preset?.description ?? ""); setErrors({});
    }
  }, [open, preset, defaultGameId]);

  const submit = () => {
    const e: Record<string, string> = {};
    const n = name.trim();
    if (n.length < 3) e.name = "Name must be at least 3 characters";
    else if (n.length > 48) e.name = "Name must be 48 characters or fewer";
    else if (presets.some((p) => p.name.toLowerCase() === n.toLowerCase() && p.id !== preset?.id)) e.name = "A preset with this name already exists";
    if (!gameId) e.gameId = "Select a game";
    if (description.length > 200) e.description = "Description must be 200 characters or fewer";
    setErrors(e);
    if (Object.keys(e).length) return;
    const now = new Date().toISOString();
    if (preset) {
      update("presets", (ps) => ps.map((p) => p.id === preset.id ? { ...p, name: n, gameId, description: description.trim(), updatedAt: now } : p));
      log("preset", `Updated preset ${n}`, gameId); notify("Preset updated", n);
    } else {
      update("presets", (ps) => [{ id: uid(), name: n, gameId, description: description.trim(), createdAt: now, updatedAt: now }, ...ps]);
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
            <Select value={gameId} onValueChange={setGameId}>
              <SelectTrigger><SelectValue placeholder="Select a game" /></SelectTrigger>
              <SelectContent>{games.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
            <FieldError msg={errors.gameId} />
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
