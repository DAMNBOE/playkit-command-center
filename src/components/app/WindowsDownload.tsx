import { Download, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const BASE = "https://github.com/DAMNBOE/playkit-command-center/releases/download/v0.1.0";
export const RELEASE = {
  version: "0.1.0",
  files: [
    { label: "Installer (.exe)", note: "Recommended", url: `${BASE}/AfScripts_0.1.0_x64-setup.exe`, bytes: 2980408 },
    { label: "Installer (.msi)", note: "For IT / managed PCs", url: `${BASE}/AfScripts_0.1.0_x64_en-US.msi`, bytes: 4358144 },
  ],
};
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

export function WindowsDownload({ collapsed }: { collapsed: boolean }) {
  const trigger = (
    <Button variant="outline" size={collapsed ? "icon" : "sm"} className="w-full" aria-label="Download Windows app">
      <Download className="size-4" />
      {!collapsed && <span>Download Windows app</span>}
    </Button>
  );

  return (
    <Dialog>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild><DialogTrigger asChild>{trigger}</DialogTrigger></TooltipTrigger>
          <TooltipContent side="right">Download Windows app</TooltipContent>
        </Tooltip>
      ) : <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-lg">
        <DialogHeader>
          <Monitor className="mb-2 size-8 text-primary" />
          <DialogTitle>AfScripts for Windows</DialogTitle>
          <DialogDescription>Version {RELEASE.version} · Windows 10/11 (64-bit)</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {RELEASE.files.map((f) => (
            <a key={f.url} href={f.url} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 hover:bg-accent">
              <div><p className="text-sm font-medium">{f.label}</p><p className="text-xs text-muted-foreground">{f.note} · {mb(f.bytes)}</p></div>
              <Download className="size-4 shrink-0" />
            </a>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">The installer isn't signed yet, so Windows may show "Windows protected your PC". Click More info → Run anyway.</p>
        <DialogFooter><DialogClose asChild><Button variant="secondary">Close</Button></DialogClose></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
