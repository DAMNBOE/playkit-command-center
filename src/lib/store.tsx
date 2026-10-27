import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { Activity, ActivityType, ConfigFile, Download, Game, Plugin, Preset, Settings } from "./types";
import { defaultSettings, sampleActivity, sampleConfigs, sampleDownloads, sampleGames, samplePlugins, samplePresets } from "./sample-data";

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

interface Store extends State {
  hydrated: boolean;
  update: <K extends keyof State>(key: K, fn: (prev: State[K]) => State[K]) => void;
  log: (type: ActivityType, message: string, gameId?: string) => void;
  notify: (title: string, description?: string) => void;
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

  const update: Store["update"] = useCallback((key, fn) => {
    setState((s) => ({ ...s, [key]: fn(s[key]) }));
  }, []);

  const log = useCallback((type: ActivityType, message: string, gameId?: string) => {
    setState((s) => ({ ...s, activity: [{ id: uid(), type, message, gameId, at: new Date().toISOString() }, ...s.activity].slice(0, 200) }));
  }, []);

  const notify = useCallback((title: string, description?: string) => {
    if (stateRef.current.settings.notifications) toast.success(title, { description });
  }, []);

  const reset = useCallback(() => { localStorage.removeItem(KEY); setState(initial); }, []);

  const value = useMemo<Store>(() => ({
    ...state, hydrated, update, log, notify, reset,
    gameById: (id) => state.games.find((g) => g.id === id),
  }), [state, hydrated, update, log, notify, reset]);

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
