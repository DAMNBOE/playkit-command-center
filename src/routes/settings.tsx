import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { useStore } from "@/lib/store";
import { Logo } from "@/components/app/bits";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getEnvironment } from "@/services";
import type { Settings } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — AfScripts" },
      { name: "description", content: "General, appearance, library, configuration, download and plugin settings for AfScripts." },
      { property: "og:title", content: "Settings — AfScripts" },
      { property: "og:description", content: "General, appearance, library, configuration, download and plugin settings for AfScripts." },
    ],
  }),
  component: SettingsPage,
});

const SECTIONS = ["General", "Appearance", "Game Library", "Configurations", "Downloads", "Plugins", "About AfScripts"] as const;
const ACCENTS: { v: Settings["accent"]; l: string; c: string }[] = [
  { v: "violet", l: "Violet", c: "oklch(0.606 0.219 293)" },
  { v: "blue", l: "Blue", c: "oklch(0.623 0.188 259.8)" },
  { v: "emerald", l: "Emerald", c: "oklch(0.7 0.15 162)" },
  { v: "rose", l: "Rose", c: "oklch(0.65 0.2 10)" },
];

function SettingsPage() {
  const { settings, update, reset } = useStore();
  const [section, setSection] = useState<(typeof SECTIONS)[number]>("General");
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => update("settings", (s) => ({ ...s, [k]: v }));

  return (
    <div className="flex flex-col gap-3 md:flex-row md:gap-5">
      <nav className="-mx-1 flex shrink-0 gap-1 overflow-x-auto px-1 pb-1 md:mx-0 md:block md:w-48 md:space-y-0.5 md:overflow-visible md:px-0 md:pb-0">
        {SECTIONS.map((s) => (
          <button key={s} onClick={() => setSection(s)} className={cn("block shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-left text-[13px] md:w-full", section === s ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")}>{s}</button>
        ))}
      </nav>
      <div key={section} className="animate-fade-up min-w-0 max-w-2xl flex-1 rounded-lg border bg-card">
        <h2 className="border-b px-5 py-3 font-semibold">{section}</h2>
        <div className="divide-y">
          {section === "General" && <>
            <Item label="Startup page" desc="Where AfScripts opens when launched.">
              <Select value={settings.startup} onValueChange={(v) => set("startup", v as Settings["startup"])}>
                <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="dashboard">Dashboard</SelectItem><SelectItem value="games">My Games</SelectItem><SelectItem value="last">Last opened page</SelectItem></SelectContent>
              </Select>
            </Item>
            <Item label="Launch on Windows startup" desc="Requires the desktop app."><Switch checked={settings.launchOnBoot} onCheckedChange={(v) => set("launchOnBoot", v)} /></Item>
            <Item label="Minimize to system tray" desc="Keep AfScripts running in the background."><Switch checked={settings.minimizeToTray} onCheckedChange={(v) => set("minimizeToTray", v)} /></Item>
            <Item label="Notifications" desc="Show toast messages for completed actions."><Switch checked={settings.notifications} onCheckedChange={(v) => set("notifications", v)} /></Item>
            <Item label="Sound effects" desc="Play subtle sounds for actions."><Switch checked={settings.soundEffects} onCheckedChange={(v) => set("soundEffects", v)} /></Item>
          </>}
          {section === "Appearance" && <>
            <Item label="Dark theme" desc="AfScripts is designed for dark mode; a light theme is planned."><Switch checked={settings.darkTheme} onCheckedChange={() => toast("Light theme is coming in a future update.")} /></Item>
            <Item label="Accent color" desc="Used for highlights and active states.">
              <div className="flex gap-2">
                {ACCENTS.map((a) => (
                  <button key={a.v} aria-label={a.l} title={a.l} onClick={() => set("accent", a.v)} className={cn("grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-card", settings.accent === a.v && "ring-2 ring-foreground/60")} style={{ background: a.c }}>
                    {settings.accent === a.v && <Check className="size-3.5 text-primary-foreground" />}
                  </button>
                ))}
              </div>
            </Item>
            <Item label="Compact mode" desc="Reduce text size for denser layouts."><Switch checked={settings.compact} onCheckedChange={(v) => set("compact", v)} /></Item>
          </>}
          {section === "Game Library" && <>
            <Item label="Steam library folder" desc="Primary location scanned for games."><Input value={settings.libraryPath} onChange={(e) => set("libraryPath", e.target.value)} className="h-8 w-80 font-mono text-xs" /></Item>
            <Item label="Auto-detect installed games" desc="Scan for installations on launch (simulated in preview)."><Switch checked={settings.autoDetect} onCheckedChange={(v) => set("autoDetect", v)} /></Item>
          </>}
          {section === "Configurations" && <>
            <Item label="Automatic backups" desc="Back up a file before each save."><Switch checked={settings.autoBackup} onCheckedChange={(v) => set("autoBackup", v)} /></Item>
            <Item label={`Backups kept per file: ${settings.backupLimit}`} desc="Oldest backups are removed first.">
              <Slider className="w-48" min={1} max={30} step={1} value={[settings.backupLimit]} onValueChange={([v]) => set("backupLimit", v ?? 10)} />
            </Item>
          </>}
          {section === "Downloads" && <>
            <Item label="Download folder" desc="Where downloaded files are saved."><Input value={settings.downloadPath} onChange={(e) => set("downloadPath", e.target.value)} className="h-8 w-80 font-mono text-xs" /></Item>
            <Item label={`Concurrent downloads: ${settings.maxConcurrent}`} desc="Maximum downloads running at once.">
              <Slider className="w-48" min={1} max={5} step={1} value={[settings.maxConcurrent]} onValueChange={([v]) => set("maxConcurrent", v ?? 2)} />
            </Item>
          </>}
          {section === "Plugins" && <>
            <Item label="Auto-update plugins" desc="Install plugin updates automatically."><Switch checked={settings.autoUpdatePlugins} onCheckedChange={(v) => set("autoUpdatePlugins", v)} /></Item>
          </>}
          {section === "About AfScripts" && (
            <div className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <Logo size={48} />
                <div><p className="text-lg font-bold">AfScripts</p><p className="text-xs text-muted-foreground">Game Configuration & Management Utility</p></div>
              </div>
              <dl className="grid grid-cols-[110px_minmax(0,1fr)] sm:grid-cols-[140px_minmax(0,1fr)] gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">Version</dt><dd>0.1.0 (preview)</dd>
                <dt className="text-muted-foreground">Runtime</dt><dd><span suppressHydrationWarning>{getEnvironment().kind === "browser" ? "Browser preview — no access to Windows files" : "Windows desktop app"}</span></dd>
                <dt className="text-muted-foreground">Data storage</dt><dd>Stored locally on this device</dd>
              </dl>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="secondary" size="sm">Reset all data</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Reset AfScripts?</AlertDialogTitle><AlertDialogDescription>Restores the sample library, configurations and default settings.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { reset(); toast.success("AfScripts has been reset"); }}>Reset</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Item({ label, desc, children }: { label: string; desc?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start justify-between gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-6 sm:px-5">
      <div className="min-w-0"><p className="text-[13px] font-medium">{label}</p>{desc && <p className="text-[11px] text-muted-foreground">{desc}</p>}</div>
      {children}
    </div>
  );
}
