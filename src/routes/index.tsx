import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpRight, CheckCircle2, Cpu, Download, FileCog, FileDown, Gamepad2, HardDrive, Layers, Plus } from "lucide-react";
import { useStore, timeAgo } from "@/lib/store";
import { ActivityIcon, ConfigBadge, GameCover, InstallBadge, Panel } from "@/components/app/bits";
import { AddGameDialog, ImportConfigDialog, PresetDialog } from "@/components/app/dialogs";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — AfScripts" },
      { name: "description", content: "Overview of your games, configurations, presets and recent activity in AfScripts." },
      { property: "og:title", content: "Dashboard — AfScripts" },
      { property: "og:description", content: "Overview of your games, configurations, presets and recent activity in AfScripts." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { games, configs, presets, activity, downloads, plugins, gameById } = useStore();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);

  const installed = games.filter((g) => g.installed);
  const recent = [...games].sort((a, b) => b.lastModified.localeCompare(a.lastModified)).slice(0, 5);
  const usedGb = installed.reduce((s, g) => s + g.sizeGb, 0);
  const configured = games.filter((g) => g.configStatus === "configured").length;

  const stats = [
    { label: "Total Games", value: games.length, sub: `${games.filter((g) => g.favorite).length} favorites`, icon: Gamepad2, to: "/games" },
    { label: "Installed Games", value: installed.length, sub: `${usedGb.toFixed(0)} GB on disk`, icon: HardDrive, to: "/games" },
    { label: "Configurations", value: configs.length, sub: `${configs.reduce((s, c) => s + c.backups.length, 0)} backups`, icon: FileCog, to: "/configurations" },
    { label: "Saved Presets", value: presets.length, sub: `across ${new Set(presets.map((p) => p.gameId)).size} games`, icon: Layers, to: "/presets" },
  ] as const;

  const actions = [
    { label: "Add Game", desc: "Register a title", icon: Plus, onClick: () => setAddOpen(true) },
    { label: "Import Configuration", desc: "Load a config file", icon: FileDown, onClick: () => setImportOpen(true) },
    { label: "Create Preset", desc: "Save a setup", icon: Layers, onClick: () => setPresetOpen(true) },
    { label: "Open Downloads", desc: `${downloads.filter((d) => d.status === "active").length} active`, icon: Download, onClick: () => navigate({ to: "/downloads" }) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Welcome back, Nova</p>
          <h2 className="text-xl font-bold tracking-tight">Your workspace at a glance</h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/40">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <s.icon className="size-4 text-muted-foreground group-hover:text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{s.value}</div>
            <div className="text-[11px] text-muted-foreground">{s.sub}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Recently Managed Games" action={<Link to="/games" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">View all <ArrowUpRight className="size-3" /></Link>}>
          <div className="divide-y">
            {recent.map((g) => (
              <Link key={g.id} to="/games/$gameId" params={{ gameId: g.id }} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40">
                <GameCover game={g} className="h-10 w-16 shrink-0 [&>div:nth-child(3)]:text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{g.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">App ID {g.appId}</p>
                </div>
                <InstallBadge installed={g.installed} />
                <ConfigBadge status={g.configStatus} />
                <span className="w-20 text-right text-[11px] text-muted-foreground">{timeAgo(g.lastModified)}</span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Quick Actions">
          <div className="grid grid-cols-2 gap-2 p-3">
            {actions.map((a) => (
              <button key={a.label} onClick={a.onClick} className="group flex flex-col items-start gap-2 rounded-md border bg-background/40 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5">
                <div className="grid size-8 place-items-center rounded-md bg-primary/15 text-primary"><a.icon className="size-4" /></div>
                <div><p className="text-xs font-semibold">{a.label}</p><p className="text-[10px] text-muted-foreground">{a.desc}</p></div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="xl:col-span-2" title="Recent Activity" action={<Link to="/activity" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">History <ArrowUpRight className="size-3" /></Link>}>
          <div className="divide-y">
            {activity.slice(0, 6).map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-2">
                <ActivityIcon type={a.type} />
                <p className="flex-1 truncate text-xs">{a.message}{a.gameId && <span className="text-muted-foreground"> · {gameById(a.gameId)?.name}</span>}</p>
                <span className="text-[11px] text-muted-foreground">{timeAgo(a.at)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="System Overview">
          <div className="space-y-3.5 p-4 text-xs">
            <Meter label="Library storage" value={Math.min(100, (usedGb / 1000) * 100)} detail={`${usedGb.toFixed(0)} / 1000 GB`} />
            <Meter label="Configured games" value={(configured / Math.max(1, games.length)) * 100} detail={`${configured} / ${games.length}`} />
            <Meter label="Plugins enabled" value={(plugins.filter((p) => p.enabled).length / Math.max(1, plugins.length)) * 100} detail={`${plugins.filter((p) => p.enabled).length} / ${plugins.length}`} />
            <div className="space-y-1.5 border-t pt-3 text-muted-foreground">
              <Row icon={Cpu} k="Platform" v="Windows 11 · x64 (simulated)" />
              <Row icon={CheckCircle2} k="Steam library" v="Detected" />
              <Row icon={FileCog} k="Last backup" v={timeAgo(activity.find((a) => a.type === "backup")?.at ?? new Date().toISOString())} />
            </div>
          </div>
        </Panel>
      </div>

      <AddGameDialog open={addOpen} onOpenChange={setAddOpen} />
      <ImportConfigDialog open={importOpen} onOpenChange={setImportOpen} />
      <PresetDialog open={presetOpen} onOpenChange={setPresetOpen} />
    </div>
  );
}

function Meter({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between"><span>{label}</span><span className="tabular-nums text-muted-foreground">{detail}</span></div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}
function Row({ icon: Icon, k, v }: { icon: typeof Cpu; k: string; v: string }) {
  return <div className="flex items-center gap-2"><Icon className="size-3.5" /><span>{k}</span><span className="ml-auto text-foreground">{v}</span></div>;
}
