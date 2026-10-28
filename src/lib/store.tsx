import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { Activity, ActivityType, ConfigFile, Download, Game, Plugin, Preset, Settings } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { defaultSettings, sampleActivity, sampleConfigs, sampleGames, samplePlugins, samplePresets } from "@/mocks/sample-data";
import { getServices, isDesktopRuntime } from "@/services";
import { mergeDetectedGames, reconcileDownloads, applyDownloadProgress } from "./desktop-state";
import { withPopularGames } from "@/mocks/popular-games";
import { matchesGameIdentity, visibleGameRecords } from "./game-visibility";

interface State {
  games: Game[];
  configs: ConfigFile[];
  presets: Preset[];
  downloads: Download[];
  plugins: Plugin[];
  activity: Activity[];
  settings: Settings;
}

const initial: State = {
  games: withPopularGames(sampleGames), configs: sampleConfigs, presets: samplePresets, downloads: [],
  plugins: samplePlugins, activity: sampleActivity, settings: defaultSettings,
};

const KEY = "afscripts:state:v1";
const DESKTOP_KEY = "afscripts:desktop:state:v2";
const emptyDesktop: State = { games: [], configs: [], presets: [], downloads: [], plugins: [], activity: [], settings: { ...defaultSettings, libraryPath: "", downloadPath: "" } };
export const uid = () => Math.random().toString(36).slice(2, 10);

export type SyncStatus = "off" | "syncing" | "synced" | "error";

interface Store extends State {
  gameQuery: string;
  setGameQuery: (query: string) => void;
  hydrated: boolean;
  account: { id: string; email: string } | null;
  syncStatus: SyncStatus;
  update: <K extends keyof State>(key: K, fn: (prev: State[K]) => State[K]) => void;
  log: (type: ActivityType, message: string, gameId?: string) => void;
  notify: (title: string, description?: string) => void;
  /** Error/warning feedback — always shown, never styled as success. */
  fail: (title: string, description?: string) => void;
  reset: () => void;
  gameById: (id?: string) => Game | undefined;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [gameQuery, setGameQuery] = useState("");
  const [state, setState] = useState<State>(initial);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      const desktop = isDesktopRuntime();
      const raw = localStorage.getItem(desktop ? DESKTOP_KEY : KEY);
      if (desktop) setState(emptyDesktop);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<State>;
        setState((s) => ({ ...s, ...parsed, settings: { ...defaultSettings, ...parsed.settings }, games: desktop ? mergeDetectedGames(parsed.games ?? [], []) : withPopularGames(parsed.games ?? s.games), downloads: desktop ? reconcileDownloads(parsed.downloads ?? []) : [] }));
      }
    } catch { /* ignore corrupt storage */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) { try { localStorage.setItem(isDesktopRuntime() ? DESKTOP_KEY : KEY, JSON.stringify(state)); } catch { toast.error("Workspace could not be saved locally", { description:"Device storage is full or unavailable. Export important configurations and presets." }); } }
  }, [state, hydrated]);

  // ---- Cloud sync: signed-in users get their state saved to their account ----
  const [account, setAccount] = useState<{ id: string; email: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("off");
  const remoteReady = useRef(false);

  useEffect(() => {
    if (!hydrated || isDesktopRuntime()) return;
    const load = async (user: { id: string; email?: string | undefined } | null) => {
      remoteReady.current = false;
      if (!user) { setAccount(null); setSyncStatus("off"); return; }
      setAccount({ id: user.id, email: user.email ?? "" });
      setSyncStatus("syncing");
      const { data, error } = await supabase.from("user_state").select("state").eq("user_id", user.id).maybeSingle();
      if (error) { setSyncStatus("error"); toast.error("Couldn't load your synced data", { description: error.message }); return; }
      if (data?.state && Object.keys(data.state as object).length) {
        const remote = data.state as Partial<State>;
        setState((s) => ({ ...s, ...remote, downloads: [], settings: { ...defaultSettings, ...remote.settings } }));
      } else {
        const { error: upErr } = await supabase.from("user_state").upsert({ user_id: user.id, state: stateRef.current as never, updated_at: new Date().toISOString() });
        if (upErr) { setSyncStatus("error"); return; }
      }
      remoteReady.current = true;
      setSyncStatus("synced");
    };
    supabase.auth.getUser().then(({ data }) => load(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void load(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [hydrated]);

  useEffect(() => {
    if (isDesktopRuntime() || !account || !remoteReady.current) return;
    setSyncStatus("syncing");
    const t = setTimeout(async () => {
      const { error } = await supabase.from("user_state").upsert({ user_id: account.id, state: state as never, updated_at: new Date().toISOString() });
      setSyncStatus(error ? "error" : "synced");
    }, 1200);
    return () => clearTimeout(t);
  }, [state, account]);

  const update: Store["update"] = useCallback((key, fn) => {
    setState((s) => ({ ...s, [key]: fn(s[key]) }));
  }, []);

  const log = useCallback((type: ActivityType, message: string, gameId?: string) => {
    setState((s) => ({ ...s, activity: [{ id: uid(), type, message, gameId, at: new Date().toISOString() }, ...s.activity].slice(0, 200) }));
  }, []);

  const notify = useCallback((title: string, description?: string) => {
    if (stateRef.current.settings.notifications) toast.success(title, { description });
  }, []);

  const fail = useCallback((title: string, description?: string) => { toast.error(title, { description }); }, []);

  const reset = useCallback(() => { localStorage.removeItem(isDesktopRuntime() ? DESKTOP_KEY : KEY); setState(isDesktopRuntime() ? emptyDesktop : { ...initial, downloads: [] }); }, []);

  const scanned = useRef(false);
  useEffect(() => {
    if (!hydrated || !isDesktopRuntime() || !state.settings.autoDetect || scanned.current) return;
    scanned.current = true;
    void getServices().library.scanLibrary(state.settings.libraryPath).then(found => {
      update("games", gs => mergeDetectedGames(gs, found));
      log("game", `Steam scan found ${found.length} installed games`);
    }).catch(e => fail("Steam scan failed", String(e)));
  }, [hydrated, state.settings.autoDetect, state.settings.libraryPath, update, log, fail]);

  const eventsReady = useRef(false);
  useEffect(() => {
    if (!hydrated || !isDesktopRuntime()) return;
    try {
      const un = getServices().downloads.onProgress(p => {
        if (!p.id) { fail("Download events unavailable", p.error ?? "Retry after reopening AfScripts"); return; }
        const d = stateRef.current.downloads.find(x => x.id === p.id);
        update("downloads", ds => ds.map(x => applyDownloadProgress(x,p)));
        if (p.status === "completed" && d?.status !== "completed") { log("download", `Downloaded ${d?.name ?? "file"} to ${p.path}`, d?.gameId); notify("Download complete", p.path); }
        if (p.status === "failed") fail("Download failed", p.error ?? "Transfer failed");
        if (p.status === "cancelled") notify("Download cancelled", d?.name);
      });
      eventsReady.current = true;
      return () => { eventsReady.current = false; un(); };
    } catch(e) { fail("Download events unavailable", String(e)); }
    return undefined;
  }, [hydrated, update, log, notify, fail]);
  const starting = useRef(new Set<string>());
  useEffect(() => {
    if (!hydrated || !isDesktopRuntime() || !eventsReady.current) return;
    const running = state.downloads.filter(d => d.status === "active" || d.status === "paused" || starting.current.has(d.id)).length;
    const slots = Math.max(0, state.settings.maxConcurrent - running);
    for (const d of state.downloads.filter(d => d.status === "queued" && d.url && !starting.current.has(d.id)).slice(0,slots)) {
      starting.current.add(d.id);
      update("downloads", ds => ds.map(x => x.id === d.id ? { ...x, status:"active", error:undefined } : x));
      void getServices().downloads.start(d.id,d.url ?? "",state.settings.downloadPath).catch(e => {
        update("downloads",ds => ds.map(x => x.id === d.id ? { ...x,status:"failed",error:String(e) } : x));
        fail("Could not start download",String(e));
      }).finally(() => { starting.current.delete(d.id); update("downloads",ds => [...ds]); });
    }
  }, [hydrated, state.downloads, state.settings.maxConcurrent, state.settings.downloadPath, update, fail]);

  const value = useMemo<Store>(() => ({
    ...state, hydrated, update, log, notify, fail, reset, account, syncStatus, gameQuery, setGameQuery,
    gameById: (id) => state.games.find((g) => g.id === id),
  }), [state, hydrated, update, log, notify, fail, reset, account, syncStatus, gameQuery]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Presentation-only scope: mutations always use the complete stored collections. */
export function useGameVisibility() {
  const store = useStore();
  return useMemo(() => {
    const games = store.games.filter((g) => matchesGameIdentity(g, store.gameQuery));
    const visibleIds = new Set(games.map((g) => g.id));
    const hideUnlinkedIdentity = (text: string) => !store.games.some((g) => !visibleIds.has(g.id) && text.toLowerCase().includes(g.name.toLowerCase()));
    return {
      games,
      configs: visibleGameRecords(store.configs, store.games, store.gameQuery),
      presets: visibleGameRecords(store.presets, store.games, store.gameQuery),
      downloads: visibleGameRecords(store.downloads, store.games, store.gameQuery).filter((d) => hideUnlinkedIdentity(d.name)),
      activity: visibleGameRecords(store.activity, store.games, store.gameQuery).filter((a) => hideUnlinkedIdentity(a.message)),
      gameById: (id?: string) => games.find((g) => g.id === id),
    };
  }, [store.games, store.configs, store.presets, store.downloads, store.activity, store.gameQuery]);
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(iso);
}
