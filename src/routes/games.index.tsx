import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Gamepad2, LayoutGrid, List, Plus, Search, Star } from "lucide-react";
import { useStore, fmtDate, timeAgo } from "@/lib/store";
import { ConfigBadge, EmptyState, GameCover, InstallBadge, PageToolbar } from "@/components/app/bits";
import { AddGameDialog } from "@/components/app/dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Game } from "@/lib/types";

export const Route = createFileRoute("/games/")({
  head: () => ({
    meta: [
      { title: "My Games — AfScripts" },
      { name: "description", content: "Browse, search, sort and filter your game library in AfScripts." },
      { property: "og:title", content: "My Games — AfScripts" },
      { property: "og:description", content: "Browse, search, sort and filter your game library in AfScripts." },
    ],
  }),
  component: GamesLibrary,
});

type Sort = "recent" | "name" | "appId" | "size";
type Filter = "all" | "installed" | "not-installed" | "configured" | "unconfigured" | "favorites";

function GamesLibrary() {
  const { games, update, hydrated } = useStore();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [addOpen, setAddOpen] = useState(false);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return games
      .filter((g) => !s || g.name.toLowerCase().includes(s) || String(g.appId).includes(s) || g.genre.toLowerCase().includes(s))
      .filter((g) => {
        switch (filter) {
          case "installed": return g.installed;
          case "not-installed": return !g.installed;
          case "configured": return g.configStatus === "configured";
          case "unconfigured": return g.configStatus !== "configured";
          case "favorites": return g.favorite;
          default: return true;
        }
      })
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "appId") return a.appId - b.appId;
        if (sort === "size") return b.sizeGb - a.sizeGb;
        return b.lastModified.localeCompare(a.lastModified);
      });
  }, [games, q, sort, filter]);

  const toggleFav = (id: string) => update("games", (gs) => gs.map((g) => (g.id === id ? { ...g, favorite: !g.favorite } : g)));
  const recent = [...games].sort((a, b) => b.lastModified.localeCompare(a.lastModified)).slice(0, 4);

  return (
    <div>
      {!q && filter === "all" && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recently managed</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {recent.map((g) => (
              <Link key={g.id} to="/games/$gameId" params={{ gameId: g.id }} className="group relative overflow-hidden rounded-lg border">
                <GameCover game={g} className="h-24 rounded-none transition-transform group-hover:scale-[1.03]" />
                <div className="absolute inset-x-0 bottom-0 p-2.5"><p className="truncate text-xs font-semibold">{g.name}</p><p className="text-[10px] text-muted-foreground">{timeAgo(g.lastModified)}</p></div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <PageToolbar>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, App ID, genre" className="h-8 pl-8 text-xs" />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All games</SelectItem>
            <SelectItem value="favorites">Favorites</SelectItem>
            <SelectItem value="installed">Installed</SelectItem>
            <SelectItem value="not-installed">Not installed</SelectItem>
            <SelectItem value="configured">Configured</SelectItem>
            <SelectItem value="unconfigured">Needs configuration</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Last modified</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="appId">App ID</SelectItem>
            <SelectItem value="size">Install size</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{list.length} of {games.length}</span>
        <div className="ml-auto flex items-center gap-2">
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as "grid" | "list")} className="rounded-md border p-0.5">
            <ToggleGroupItem value="grid" aria-label="Grid view" className="h-7 w-7"><LayoutGrid className="size-3.5" /></ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view" className="h-7 w-7"><List className="size-3.5" /></ToggleGroupItem>
          </ToggleGroup>
          <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-4" /> Add game</Button>
        </div>
      </PageToolbar>

      {!hydrated ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border bg-card"><EmptyState icon={Gamepad2} title="No games match" description="Try a different search or filter." action={<Button variant="secondary" size="sm" onClick={() => { setQ(""); setFilter("all"); }}>Clear filters</Button>} /></div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {list.map((g) => <GameCard key={g.id} game={g} onFav={() => toggleFav(g.id)} />)}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="grid grid-cols-[28px_1fr_110px_110px_100px_110px] gap-3 border-b px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <span /><span>Game</span><span>App ID</span><span>Status</span><span>Config</span><span>Modified</span>
          </div>
          {list.map((g) => (
            <div key={g.id} className="grid grid-cols-[28px_1fr_110px_110px_100px_110px] items-center gap-3 border-b px-4 py-2 last:border-0 hover:bg-accent/40">
              <FavButton active={g.favorite} onClick={() => toggleFav(g.id)} />
              <Link to="/games/$gameId" params={{ gameId: g.id }} className="flex min-w-0 items-center gap-3">
                <GameCover game={g} className="h-8 w-12 shrink-0 [&>div:nth-child(3)]:text-xs" />
                <span className="truncate font-medium hover:text-primary">{g.name}</span>
              </Link>
              <span className="font-mono text-xs text-muted-foreground">{g.appId}</span>
              <InstallBadge installed={g.installed} />
              <ConfigBadge status={g.configStatus} />
              <span className="text-xs text-muted-foreground">{fmtDate(g.lastModified)}</span>
            </div>
          ))}
        </div>
      )}
      <AddGameDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function FavButton({ active, onClick, className }: { active: boolean; onClick: () => void; className?: string }) {
  return (
    <button aria-label={active ? "Remove favorite" : "Add favorite"} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className={cn("grid size-7 place-items-center rounded-md hover:bg-accent", className)}>
      <Star className={cn("size-3.5", active ? "fill-warning text-warning" : "text-muted-foreground")} />
    </button>
  );
}

function GameCard({ game: g, onFav }: { game: Game; onFav: () => void }) {
  return (
    <Link to="/games/$gameId" params={{ gameId: g.id }} className="group overflow-hidden rounded-lg border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow">
      <div className="relative">
        <GameCover game={g} className="aspect-[3/2] rounded-none" />
        <FavButton active={g.favorite} onClick={onFav} className="glass absolute right-2 top-2" />
      </div>
      <div className="space-y-2 p-3">
        <div><p className="truncate font-semibold">{g.name}</p><p className="font-mono text-[10px] text-muted-foreground">App ID {g.appId}</p></div>
        <div className="flex flex-wrap gap-1"><InstallBadge installed={g.installed} /><ConfigBadge status={g.configStatus} /></div>
        <p className="text-[10px] text-muted-foreground">Modified {fmtDate(g.lastModified)}</p>
      </div>
    </Link>
  );
}
