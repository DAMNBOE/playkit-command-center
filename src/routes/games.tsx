import { createFileRoute, Outlet, useMatch } from "@tanstack/react-router";
import { GamesLibrary } from "@/components/app/GamesLibrary";

export const Route = createFileRoute("/games")({
  head: () => ({
    meta: [
      { title: "My Games — AfScripts" },
      { name: "description", content: "Browse, search, sort and filter your game library in AfScripts." },
      { property: "og:title", content: "My Games — AfScripts" },
      { property: "og:description", content: "Browse, search, sort and filter your game library in AfScripts." },
    ],
  }),
  component: GamesLayout,
});

function GamesLayout() {
  const child = useMatch({ from: "/games/$gameId", shouldThrow: false });
  return child ? <Outlet /> : <GamesLibrary />;
}
