import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { Activity, ActivityType, ConfigFile, Download, Game, Plugin, Preset, Settings } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { defaultSettings, sampleActivity, sampleConfigs, sampleDownloads, sampleGames, samplePlugins, samplePresets } from "@/mocks/sample-data";

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
  games: sampleGames, configs: sampleConfigs, presets: samplePresets, downloads: sampleDownloads,
  plugins: samplePlugins, activity: sampleActivity, settings: defaultSettings,
};

const KEY = "afscripts:state:v1";
export const uid = () => Math.random().toString(36).slice(2, 10);

export type SyncStatus = "off" | "syncing" | "synced" | "error";

interface Store extends State {
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
  const [state, setState] = useState<State>(initial);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<State>;
        setState((s) => ({ ...s, ...parsed, settings: { ...defaultSettings, ...parsed.settings } }));
      }
    } catch { /* ignore corrupt storage */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, hydrated]);

  // ---- Cloud sync: signed-in users get their state saved to their account ----
  const [account, setAccount] = useState<{ id: string; email: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("off");
  const remoteReady = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    const load = async (user: { id: string; email?: string | undefined } | null) => {
      remoteReady.current = false;
      if (!user) { setAccount(null); setSyncStatus("off"); return; }
      setAccount({ id: user.id, email: user.email ?? "" });
      setSyncStatus("syncing");
      const { data, error } = await supabase.from("user_state").select("state").eq("user_id", user.id).maybeSingle();
      if (error) { setSyncStatus("error"); toast.error("Couldn't load your synced data", { description: error.message }); return; }
      if (data?.state && Object.keys(data.state as object).length) {
        const remote = data.state as Partial<State>;
        setState((s) => ({ ...s, ...remote, settings: { ...defaultSettings, ...remote.settings } }));
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
    if (!account || !remoteReady.current) return;
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

  const reset = useCallback(() => { localStorage.removeItem(KEY); setState(initial); }, []);

  const value = useMemo<Store>(() => ({
    ...state, hydrated, update, log, notify, fail, reset, account, syncStatus,
    gameById: (id) => state.games.find((g) => g.id === id),
  }), [state, hydrated, update, log, notify, fail, reset, account, syncStatus]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(iso);
}
