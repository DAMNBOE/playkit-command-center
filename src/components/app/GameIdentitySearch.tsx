import { parseAppId } from "@/lib/game-visibility";
import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchSteamStore } from "@/lib/steam-search.functions";
import { getServices, isDesktopRuntime, type SteamSearchResult } from "@/services";

type Lookup = (term: string) => Promise<SteamSearchResult[]>;
const desktopLookup: Lookup = async (term) => {
  const appId = parseAppId(term);
  return appId ? getServices().library.lookupSteamApp(Number(appId)) : [];
};

export function GameIdentitySearch() {
  // Do not mount the web RPC hook in a static Windows bundle.
  return isDesktopRuntime() ? <IdentitySearch lookup={desktopLookup} /> : <WebIdentitySearch />;
}

function WebIdentitySearch() {
  const search = useServerFn(searchSteamStore);
  const lookup = useCallback<Lookup>((term) => search({ data: { term } }), [search]);
  return <IdentitySearch lookup={lookup} />;
}

function IdentitySearch({ lookup }: { lookup: Lookup }) {
  const { gameQuery, setGameQuery, games, update, log, notify } = useStore();
  const [results, setResults] = useState<SteamSearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const term = gameQuery.trim();

  useEffect(() => {
    if (term.length < 2 || !parseAppId(term)) { setResults([]); setStatus("idle"); return; }
    let cancelled = false;
    setResults([]);
    setError("");
    setStatus("loading");
    const t = setTimeout(() => {
      // Promise boundary also catches synchronous adapter failures.
      Promise.resolve().then(() => lookup(term))
        .then((r) => { if (!cancelled) { setResults(r); setStatus("idle"); } })
        .catch((e: unknown) => { if (!cancelled) { setError(e instanceof Error ? e.message : String(e)); setStatus("error"); } });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [term, lookup]);

  const owned = new Set(games.map((g) => g.appId));
  const add = (r: SteamSearchResult) => {
    update("games", (gs) => gs.some((g) => g.appId === r.appId) ? gs : [...gs, {
      id: crypto.randomUUID(), name: r.name, appId: r.appId, installed: false, configStatus: "none",
      lastModified: new Date().toISOString(), installPath: "", sizeGb: 0, genre: "Uncategorized",
      hue: (r.appId * 37) % 360, favorite: false, developer: "—",
    }]);
    log("game", `Added ${r.name} from Steam store`);
    notify("Game added", r.name);
  };

  return (
    <div className="mb-4">
      <div role="search" className="relative flex w-full items-center">
        <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
        <Input aria-label="Search games by Steam App ID" placeholder="Steam App ID (e.g. 730)" inputMode="numeric" value={gameQuery} onChange={(e) => setGameQuery(e.target.value)} className="pl-9 pr-10" />
        {gameQuery && <Button variant="ghost" size="icon" aria-label="Clear game search" className="absolute right-1 size-7" onClick={() => setGameQuery("")}><X className="size-4" /></Button>}
      </div>
      {term.length >= 2 && parseAppId(term) && (
        <div className="mt-2 rounded-lg border border-border bg-card p-2">
          <p className="px-1 pb-2 text-xs text-muted-foreground">Steam store results</p>
          {status === "loading" && <p className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Searching Steam…</p>}
          {status === "error" && <p className="px-1 py-2 text-sm text-destructive">Steam search failed: {error}</p>}
          {status === "idle" && results.length === 0 && <p className="px-1 py-2 text-sm text-muted-foreground">No Steam games match.</p>}
          {status === "idle" && results.map((r) => (
            <div key={r.appId} className="flex items-center gap-3 rounded-md px-1 py-1.5 hover:bg-accent">
              {r.image ? <img src={r.image} alt="" className="h-9 w-20 shrink-0 rounded object-cover" loading="lazy" /> : <div className="h-9 w-20 shrink-0 rounded bg-muted" />}
              <div className="min-w-0 flex-1"><p className="truncate text-sm">{r.name}</p><p className="text-xs text-muted-foreground">App ID {r.appId}</p></div>
              {owned.has(r.appId)
                ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><Check className="size-3" />In library</span>
                : <Button size="sm" variant="outline" onClick={() => add(r)}><Plus className="size-3" />Add</Button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
