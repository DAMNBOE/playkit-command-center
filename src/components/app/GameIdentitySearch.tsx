import { Search, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function GameIdentitySearch() {
  const { gameQuery, setGameQuery } = useStore();
  return (
    <div role="search" className="relative mb-4 flex w-full items-center">
      <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
      <Input aria-label="Search games by name or Steam App ID" placeholder="Game name or Steam App ID" value={gameQuery} onChange={(e) => setGameQuery(e.target.value)} className="pl-9 pr-10" />
      {gameQuery && <Button variant="ghost" size="icon" aria-label="Clear game search" className="absolute right-1 size-7" onClick={() => setGameQuery("")}><X className="size-4" /></Button>}
    </div>
  );
}