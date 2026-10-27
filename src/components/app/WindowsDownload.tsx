import { Download, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
          <DialogDescription>A Windows installer is not available yet. No file has been downloaded.</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">The browser preview cannot install AfScripts on your PC. A Windows .exe or .msi installer must be built and added before downloads are available.</p>
        <DialogFooter>
          <DialogClose asChild><Button variant="secondary">Close</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}