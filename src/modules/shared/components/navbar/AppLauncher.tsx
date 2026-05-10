"use client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Grip } from "lucide-react";
import { useState } from "react";

export function AppLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Open apps"
        >
          <Grip className="size-5 text-zinc-500 dark:text-zinc-300" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-56 p-3">
        <p className="text-xs font-semibold text-muted-foreground px-1 mb-2 tracking-wide uppercase">Apps</p>
        <p className="text-xs text-muted-foreground text-center py-4">No apps available</p>
      </PopoverContent>
    </Popover>
  );
}
