import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), webHook: vi.fn(), desktop: true }));
vi.mock("@/services", () => ({
  isDesktopRuntime: () => mocks.desktop,
  getServices: () => ({ library: { lookupSteamApp: mocks.lookup } }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: mocks.webHook }));
vi.mock("@/lib/steam-search.functions", () => ({ searchSteamStore: vi.fn() }));
vi.mock("@/lib/store", () => ({
  useStore: () => {
    const [gameQuery, setGameQuery] = useState("");
    return { gameQuery, setGameQuery, games: [], update: vi.fn(), log: vi.fn(), notify: vi.fn() };
  },
}));
import { GameIdentitySearch } from "@/components/app/GameIdentitySearch";

describe("Windows App ID search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lookup.mockReset();
    mocks.desktop = true;
    mocks.webHook.mockImplementation(() => { throw new Error("No web RPC server in Windows"); });
  });
  afterEach(cleanup);

  it("enters a digit safely and looks up 730 natively without mounting the web hook", async () => {
    mocks.lookup.mockResolvedValue([{ appId: 730, name: "Counter-Strike 2", image: "" }]);
    render(<GameIdentitySearch />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "7" } });
    expect(mocks.lookup).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "730" } });
    await waitFor(() => expect(mocks.lookup).toHaveBeenCalledWith(730));
    expect(mocks.webHook).not.toHaveBeenCalled();
  });

  it("does not look up games by name", async () => {
    render(<GameIdentitySearch />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Elden Ring" } });
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it.each(["reject", "throw"])("contains a %s failure and permits another lookup", async (failure) => {
    if (failure === "reject") mocks.lookup.mockRejectedValueOnce("Steam offline");
    else mocks.lookup.mockImplementationOnce(() => { throw new Error("Steam offline"); });
    mocks.lookup.mockResolvedValueOnce([]);
    render(<GameIdentitySearch />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "730" } });
    await waitFor(() => expect(mocks.lookup).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/Steam offline/)).toBeInTheDocument());
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "570" } });
    await waitFor(() => expect(mocks.lookup).toHaveBeenLastCalledWith(570));
    await waitFor(() => expect(screen.queryByText(/Steam offline/)).not.toBeInTheDocument());
  });
});