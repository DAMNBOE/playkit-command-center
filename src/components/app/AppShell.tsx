import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity as ActivityIcon, Bell, ChevronsLeft, ChevronsRight, Download, FileCog, Gamepad2,
  Layers, LayoutDashboard, Menu, Minus, Puzzle, Search, Settings, Square, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo, useStore, useGameVisibility } from "@/lib/store";
import { GameIdentitySearch } from "./GameIdentitySearch";
import { Logo, ActivityIcon as ActIcon } from "./bits";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { getServices, type WindowAction } from "@/services";
import { EnvironmentBadge } from "./EnvironmentBadge";
import { WindowsDownload } from "./WindowsDownload";

export const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/games", label: "My Games", icon: Gamepad2 },
  { to: "/configurations", label: "Configurations", icon: FileCog },
  { to: "/presets", label: "Presets", icon: Layers },
  { to: "/downloads", label: "Downloads", icon: Download },
  { to: "/plugins", label: "Plugins", icon: Puzzle },
  { to: "/activity", label: "Activity", icon: ActivityIcon },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const ACCENTS = {
  violet: ["oklch(0.606 0.219 293)", "oklch(0.623 0.188 259.8)"],
  blue: ["oklch(0.623 0.188 259.8)", "oklch(0.7 0.13 220)"],
  emerald: ["oklch(0.7 0.15 162)", "oklch(0.65 0.13 200)"],
  rose: ["oklch(0.65 0.2 10)", "oklch(0.606 0.219 293)"],
} as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { settings, hydrated } = useStore();
  const { downloads, activity } = useGameVisibility();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const saved = localStorage.getItem("afscripts:sidebar");
    if (saved) setCollapsed(saved === "1");
  }, []);
  useEffect(() => { localStorage.setItem("afscripts:sidebar", collapsed ? "1" : "0"); }, [collapsed]);

  useEffect(() => {
    const [p, s] = ACCENTS[settings.accent];
    const root = document.documentElement.style;
    root.setProperty("--primary", p); root.setProperty("--ring", p); root.setProperty("--sidebar-primary", p);
    root.setProperty("--info", s);
    document.body.classList.toggle("compact", settings.compact);
  }, [settings.accent, settings.compact]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { setDrawerOpen(false); }, [path]);

  const isActive = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));
  const current = NAV.find((n) => isActive(n.to)) ?? NAV[0];
  const pageTitle = path.startsWith("/games/") ? "Game Details" : current.label;
  const activeDl = downloads.filter((d) => d.status === "active").length;

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
        {/* Sidebar (tablet/desktop) */}
        <aside className={cn("hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex", collapsed ? "w-[60px]" : "w-[224px]")}>
          <SidebarContent collapsed={collapsed} isActive={isActive} activeDl={activeDl} onToggle={() => setCollapsed((c) => !c)} />
        </aside>

        {/* Navigation drawer (mobile) */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left" className="w-[260px] border-sidebar-border bg-sidebar p-0 [&>button]:hidden">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">AfScripts sections</SheetDescription>
            <div className="flex h-full flex-col"><SidebarContent collapsed={false} isActive={isActive} activeDl={activeDl} /></div>
          </SheetContent>
        </Sheet>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="drag-region flex h-14 shrink-0 items-center gap-2 border-b pl-2 pr-2 sm:gap-3 md:pl-5 md:pr-0">
            <button aria-label="Open navigation" onClick={() => setDrawerOpen(true)} className="no-drag grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:hidden">
              <Menu className="size-5" />
            </button>
            <h1 className="min-w-0 truncate text-[15px] font-semibold tracking-tight">{pageTitle}</h1>
            <button onClick={() => setSearchOpen(true)} aria-label="Search" className="no-drag ml-auto flex size-9 shrink-0 items-center justify-center gap-2 rounded-md text-xs text-muted-foreground hover:border-primary/40 sm:mx-auto sm:h-8 sm:w-full sm:max-w-md sm:justify-start sm:border sm:bg-card sm:px-3">
              <Search className="size-4 sm:size-3.5" /> <span className="hidden truncate sm:inline">Search games, configs, presets…</span>
              <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[10px] lg:inline">Ctrl K</kbd>
            </button>
            <div className="no-drag flex items-center gap-1">
              <EnvironmentBadge />
              <Popover>
                <PopoverTrigger asChild>
                  <button aria-label="Notifications" className="relative grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                    <Bell className="size-4" />
                    <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[min(20rem,calc(100vw-1rem))] p-0">
                  <div className="border-b px-3 py-2 text-xs font-semibold">Notifications</div>
                  <div className="max-h-72 overflow-auto" suppressHydrationWarning>
                    {activity.slice(0, 6).map((a) => (
                      <div key={a.id} className="flex gap-2.5 border-b px-3 py-2 last:border-0">
                        <ActIcon type={a.type} />
                        <div className="min-w-0"><p className="truncate text-xs">{a.message}</p><p className="text-[10px] text-muted-foreground">{timeAgo(a.at)}</p></div>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <WindowControls />
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            {hydrated ? (
              <div key={path} className="animate-fade-up mx-auto w-full max-w-[1400px] p-3 sm:p-5"><GameIdentitySearch />{children}</div>
            ) : (
              <div className="mx-auto max-w-[1400px] space-y-3 p-3 sm:p-5" aria-busy="true">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-card" />)}</div>
                <div className="h-80 animate-pulse rounded-lg bg-card" />
              </div>
            )}
          </main>
        </div>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </TooltipProvider>
  );
}

function SidebarContent({ collapsed, isActive, activeDl, onToggle }: {
  collapsed: boolean; isActive: (to: string) => boolean; activeDl: number; onToggle?: () => void;
}) {
  return (
    <>
      <div className="drag-region flex h-14 shrink-0 items-center gap-2.5 px-3.5">
        <Logo size={30} />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="text-[14px] font-bold tracking-tight">AfScripts</div>
            <div className="truncate text-[10px] text-muted-foreground">Game Configuration & Management</div>
          </div>
        )}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV.map((item) => {
          const active = isActive(item.to);
          const link = (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors md:h-8",
                active ? "bg-sidebar-accent font-medium text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              {active && <span className="bg-brand absolute -left-2 top-1.5 h-5 w-[3px] rounded-r" />}
              <item.icon className={cn("size-4 shrink-0", active && "text-primary")} />
              {!collapsed && <span>{item.label}</span>}
              {!collapsed && item.to === "/downloads" && activeDl > 0 && (
                <span className="ml-auto rounded bg-primary/20 px-1.5 text-[10px] font-semibold text-primary">{activeDl}</span>
              )}
            </Link>
          );
          return collapsed ? (
            <Tooltip key={item.to}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ) : link;
        })}
      </nav>
      <div className="border-t border-sidebar-border p-2">
        <div className="mb-2"><WindowsDownload collapsed={collapsed} /></div>
        {onToggle && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onToggle} className={cn("mb-1 flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground", collapsed && "justify-center px-0")}>
                {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
          </Tooltip>
        )}
        <ProfileMenu collapsed={collapsed} />
      </div>
    </>
  );
}

function ProfileMenu({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn("flex w-full items-center gap-2.5 rounded-md p-1.5 text-left hover:bg-sidebar-accent", collapsed && "justify-center")}>
          <div className="grid size-7 shrink-0 place-items-center rounded-full bg-info/20 text-[11px] font-bold text-info">NK</div>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-xs font-medium">Nova Kade</div>
              <div className="text-[10px] text-muted-foreground">Local profile</div>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-48">
        <DropdownMenuLabel>Nova Kade</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>Settings</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/activity" })}>Activity history</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => toast("Profiles sync will be available with cloud accounts.")}>Switch profile</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WindowControls() {
  const msg = (action: WindowAction) => async () => {
    const ok = await getServices().window.action(action).catch(() => false);
    if (!ok) toast("Window controls work in the packaged Windows app.");
  };
  return (
    <div className="no-drag hidden h-full md:flex">
      <button aria-label="Minimize" onClick={msg("minimize")} className="grid h-full w-11 place-items-center text-muted-foreground hover:bg-accent"><Minus className="size-3.5" /></button>
      <button aria-label="Maximize" onClick={msg("maximize")} className="grid h-full w-11 place-items-center text-muted-foreground hover:bg-accent"><Square className="size-3" /></button>
      <button aria-label="Close" onClick={msg("close")} className="grid h-full w-11 place-items-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"><X className="size-3.5" /></button>
    </div>
  );
}

function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { games, configs, presets } = useGameVisibility();
  const { gameQuery, setGameQuery } = useStore();
  const navigate = useNavigate();
  const go = (fn: () => void) => { onOpenChange(false); fn(); };
  const gameName = useMemo(() => Object.fromEntries(games.map((g) => [g.id, g.name])), [games]);
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput placeholder="Game name or Steam App ID" value={gameQuery} onValueChange={setGameQuery} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Games">
          {games.map((g) => (
            <CommandItem key={g.id} value={`game ${g.name} ${g.appId}`} onSelect={() => go(() => navigate({ to: "/games/$gameId", params: { gameId: g.id } }))}>
              <Gamepad2 className="size-4" /> {g.name} <span className="ml-auto font-mono text-[10px] text-muted-foreground">{g.appId}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Configurations">
          {configs.map((c) => (
            <CommandItem key={c.id} value={`config ${c.name} ${gameName[c.gameId]}`} onSelect={() => go(() => navigate({ to: "/configurations", search: { file: c.id } }))}>
              <FileCog className="size-4" /> {c.name} <span className="ml-auto text-[10px] text-muted-foreground">{gameName[c.gameId]}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Presets">
          {presets.map((p) => (
            <CommandItem key={p.id} value={`preset ${p.name}`} onSelect={() => go(() => navigate({ to: "/presets" }))}>
              <Layers className="size-4" /> {p.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Pages">
          {NAV.map((n) => (
            <CommandItem key={n.to} value={`page ${n.label}`} onSelect={() => go(() => navigate({ to: n.to }))}>
              <n.icon className="size-4" /> {n.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

