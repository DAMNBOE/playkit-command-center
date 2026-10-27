import { useState, type ReactNode } from "react";
import logoMark from "@/assets/logo-monogram.png";
import type { LucideIcon } from "lucide-react";
import {
  Archive, Download, FileCog, FileDown, FileUp, Gamepad2, History, Layers, Puzzle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityType, ConfigStatus, Game } from "@/lib/types";

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <img
      src={logoMark}
      alt="AfScripts logo"
      className="shrink-0 select-none"
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

/** Official Steam store header art for a given App ID. */
export const steamHeaderUrl = (appId: number) =>
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;

export function GameCover({ game, className }: { game: Game; className?: string }) {
  const [failed, setFailed] = useState(false);
  const initials = game.name.replace(/[^A-Za-z0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("");
  const showArt = game.appId > 0 && !failed;
  return (
    <div
      className={cn("relative overflow-hidden rounded-md", className)}
      style={{
        background: `radial-gradient(120% 90% at 20% 10%, oklch(0.55 0.14 ${game.hue}) 0%, oklch(0.28 0.08 ${game.hue}) 45%, oklch(0.16 0.02 ${game.hue}) 100%)`,
      }}
    >
      {showArt ? (
        <img
          src={steamHeaderUrl(game.appId)}
          alt={`${game.name} cover art`}
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-3xl font-extrabold tracking-tight text-foreground/90 drop-shadow">
          {initials}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background/80 to-transparent" />
    </div>
  );
}

export function InstallBadge({ installed }: { installed: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium",
      installed ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
      <span className={cn("size-1.5 rounded-full", installed ? "bg-success" : "bg-muted-foreground")} />
      {installed ? "Installed" : "Not installed"}
    </span>
  );
}

const cfgMap: Record<ConfigStatus, { label: string; cls: string }> = {
  configured: { label: "Configured", cls: "bg-primary/15 text-primary" },
  partial: { label: "Partial", cls: "bg-warning/15 text-warning" },
  none: { label: "No config", cls: "bg-muted text-muted-foreground" },
};
export function ConfigBadge({ status }: { status: ConfigStatus }) {
  const c = cfgMap[status];
  return <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", c.cls)}>{c.label}</span>;
}

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border bg-card", className)}>
      {title && (
        <header className="flex items-center justify-between border-b px-4 py-2.5">
          <h3 className="text-[13px] font-semibold">{title}</h3>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="grid size-11 place-items-center rounded-full border bg-muted/50"><Icon className="size-5 text-muted-foreground" /></div>
      <p className="font-semibold">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function PageToolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>;
}

export const activityIcon: Record<ActivityType, { icon: LucideIcon; cls: string }> = {
  config: { icon: FileCog, cls: "text-primary bg-primary/15" },
  import: { icon: FileDown, cls: "text-info bg-info/15" },
  export: { icon: FileUp, cls: "text-info bg-info/15" },
  backup: { icon: Archive, cls: "text-success bg-success/15" },
  restore: { icon: History, cls: "text-warning bg-warning/15" },
  preset: { icon: Layers, cls: "text-primary bg-primary/15" },
  game: { icon: Gamepad2, cls: "text-foreground bg-muted" },
  plugin: { icon: Puzzle, cls: "text-info bg-info/15" },
  download: { icon: Download, cls: "text-success bg-success/15" },
};

export function ActivityIcon({ type }: { type: ActivityType }) {
  const { icon: Icon, cls } = activityIcon[type];
  return <div className={cn("grid size-7 shrink-0 place-items-center rounded-md", cls)}><Icon className="size-3.5" /></div>;
}

export function downloadFile(name: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
