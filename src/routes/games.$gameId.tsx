import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Archive, ArrowLeft, FileCog, FileDown, FileUp, Folder, FileText, Layers, Plus, Star } from "lucide-react";
import { fmtDate, timeAgo, useStore } from "@/lib/store";
import { ActivityIcon, ConfigBadge, EmptyState, GameCover, InstallBadge, Panel } from "@/components/app/bits";
import { ImportConfigDialog, PresetDialog } from "@/components/app/dialogs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfigActions } from "@/lib/config-actions";
import { getPlatform, type LocalFileEntry } from "@/services/platform";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/games/$gameId")({
  head: () => ({
    meta: [
      { title: "Game Details — AfScripts" },
      { name: "description", content: "Installation, configuration files, presets and activity for a game in AfScripts." },
      { property: "og:title", content: "Game Details — AfScripts" },
      { property: "og:description", content: "Installation, configuration files, presets and activity for a game in AfScripts." },
    ],
  }),
  component: GameDetails,
});

const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b > 1e3 ? `${(b / 1e3).toFixed(1)} KB` : `${b} B`);

function GameDetails() {
  const { gameId } = Route.useParams();
  const { gameById, configs, presets, activity, update, hydrated, fail } = useStore();
  const navigate = useNavigate();
  const { backup, exportFile } = useConfigActions();
  const [importOpen, setImportOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [files, setFiles] = useState<LocalFileEntry[] | null>(null);
  const game = gameById(gameId);

  useEffect(() => {
    if (game?.installed) getPlatform().listFiles(game.installPath).then(setFiles).catch(() => setFiles([]));
    else setFiles([]);
  }, [game?.installPath, game?.installed]);

  if (!game) {
    if (!hydrated) return <Skeleton className="h-64" />;
    return <div className="rounded-lg border bg-card"><EmptyState icon={FileCog} title="Game not found" description="It may have been removed from your library." action={<Button size="sm" asChild><Link to="/games">Back to library</Link></Button>} /></div>;
  }

  const gConfigs = configs.filter((c) => c.gameId === game.id);
  const gPresets = presets.filter((p) => p.gameId === game.id);
  const gActivity = activity.filter((a) => a.gameId === game.id);

  const exportAll = () => {
    if (!gConfigs.length) return fail("Nothing to export", "This game has no configurations yet.");
    gConfigs.forEach(exportFile);
  };
  const backupAll = async () => {
    if (!gConfigs.length) return fail("Nothing to back up", "This game has no configurations yet.");
    for (const c of gConfigs) await backup(c, "Game-wide backup");
  };

  return (
    <div className="space-y-4">
      <Link to="/games" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> My Games</Link>

      <div className="relative overflow-hidden rounded-xl border bg-card">
        <GameCover game={game} className="absolute inset-0 rounded-none opacity-40 blur-2xl [&>div:nth-child(3)]:hidden" />
        <div className="relative flex flex-wrap items-end gap-5 p-5">
          <GameCover game={game} className="h-36 w-56 shrink-0 shadow-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{game.name}</h2>
              <button aria-label="Toggle favorite" onClick={() => update("games", (gs) => gs.map((g) => g.id === game.id ? { ...g, favorite: !g.favorite } : g))}>
                <Star className={cn("size-4", game.favorite ? "fill-warning text-warning" : "text-muted-foreground")} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">App ID {game.appId}</span>·<span>{game.developer}</span>·<span>{game.genre}</span>
            </div>
            <div className="flex gap-1.5"><InstallBadge installed={game.installed} /><ConfigBadge status={game.configStatus} /></div>
            <p className="truncate font-mono text-[11px] text-muted-foreground">{game.installPath}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => navigate({ to: "/configurations", search: { game: game.id } })}><FileCog className="size-4" /> Manage Configurations</Button>
            <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}><FileDown className="size-4" /> Import</Button>
            <Button size="sm" variant="secondary" onClick={exportAll}><FileUp className="size-4" /> Export</Button>
            <Button size="sm" variant="secondary" onClick={backupAll}><Archive className="size-4" /> Create Backup</Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="configs">Configurations <span className="ml-1 text-muted-foreground">{gConfigs.length}</span></TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="presets">Presets <span className="ml-1 text-muted-foreground">{gPresets.length}</span></TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-3">
          <div className="grid gap-3 md:grid-cols-4">
            {[["Install size", game.installed ? `${game.sizeGb} GB` : "—"], ["Config files", gConfigs.length], ["Backups", gConfigs.reduce((s, c) => s + c.backups.length, 0)], ["Last modified", fmtDate(game.lastModified)]].map(([k, v]) => (
              <div key={String(k)} className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1 text-lg font-semibold">{v}</p></div>
            ))}
          </div>
          <Panel title="Details" className="mt-3">
            <dl className="grid grid-cols-[160px_1fr] gap-y-2 p-4 text-xs">
              <dt className="text-muted-foreground">Installation path</dt><dd className="font-mono">{game.installPath}</dd>
              <dt className="text-muted-foreground">Configuration status</dt><dd><ConfigBadge status={game.configStatus} /></dd>
              <dt className="text-muted-foreground">Developer</dt><dd>{game.developer}</dd>
              <dt className="text-muted-foreground">Genre</dt><dd>{game.genre}</dd>
            </dl>
          </Panel>
        </TabsContent>

        <TabsContent value="configs" className="mt-3">
          <Panel>
            {gConfigs.length === 0 ? (
              <EmptyState icon={FileCog} title="No configurations yet" description="Import a config file to start managing this game." action={<Button size="sm" onClick={() => setImportOpen(true)}>Import configuration</Button>} />
            ) : (
              <div className="divide-y">
                {gConfigs.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                    <FileText className="size-4 text-primary" />
                    <div className="min-w-0 flex-1"><p className="font-mono text-xs font-medium">{c.name}</p><p className="truncate font-mono text-[10px] text-muted-foreground">{c.path}</p></div>
                    <span className="text-[11px] text-muted-foreground">{c.backups.length} backups · {timeAgo(c.modifiedAt)}</span>
                    <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/configurations", search: { file: c.id } })}>Open</Button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="files" className="mt-3">
          <Panel title={<span className="font-mono text-xs">{game.installPath}</span>} action={<span className="text-[10px] text-muted-foreground">Simulated listing</span>}>
            {files === null ? (
              <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-6" />)}</div>
            ) : files.length === 0 ? (
              <EmptyState icon={Folder} title="Game not installed" description="Install the game to browse its local files." />
            ) : (
              <div className="divide-y">
                {files.map((f) => (
                  <div key={f.path} className="flex items-center gap-3 px-4 py-2 text-xs">
                    {f.isDirectory ? <Folder className="size-4 text-info" /> : <FileText className="size-4 text-muted-foreground" />}
                    <span className="flex-1 font-mono">{f.name}</span>
                    <span className="text-muted-foreground">{f.isDirectory ? "Folder" : fmtSize(f.sizeBytes)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="presets" className="mt-3">
          <Panel title="Presets" action={<Button size="sm" variant="ghost" onClick={() => setPresetOpen(true)}><Plus className="size-3.5" /> New</Button>}>
            {gPresets.length === 0 ? <EmptyState icon={Layers} title="No presets" description="Create a preset to save this game's setup." /> : (
              <div className="divide-y">
                {gPresets.map((p) => (
                  <div key={p.id} className="px-4 py-2.5"><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.description}</p></div>
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="activity" className="mt-3">
          <Panel>
            {gActivity.length === 0 ? <EmptyState icon={FileCog} title="No activity yet" /> : (
              <div className="divide-y">
                {gActivity.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-2"><ActivityIcon type={a.type} /><p className="flex-1 text-xs">{a.message}</p><span className="text-[11px] text-muted-foreground">{timeAgo(a.at)}</span></div>
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      <ImportConfigDialog open={importOpen} onOpenChange={setImportOpen} defaultGameId={game.id} />
      <PresetDialog open={presetOpen} onOpenChange={setPresetOpen} defaultGameId={game.id} />
    </div>
  );
}
