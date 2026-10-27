import { useHydrated } from "@tanstack/react-router";
import { Globe, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { getEnvironment } from "@/services";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Shows whether AfScripts runs in the browser preview or the Windows desktop app. */
export function EnvironmentBadge() {
  const hydrated = useHydrated();
  const desktop = hydrated && getEnvironment().kind === "desktop";
  const Icon = desktop ? Monitor : Globe;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] text-muted-foreground">
          <span className={cn("size-1.5 rounded-full", desktop ? "bg-success" : "bg-warning")} />
          <Icon className="size-3.5" />
          <span className="hidden lg:inline">{desktop ? "Desktop app" : "Browser preview"}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        {desktop
          ? "Running as the Windows desktop app — changes are written to your game files."
          : "Browser preview — AfScripts can't see your Windows files here. Edits are saved in this browser only; downloads are simulated."}
      </TooltipContent>
    </Tooltip>
  );
}
