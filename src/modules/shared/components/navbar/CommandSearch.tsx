"use client";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import Link from "next/link";
import { SearchIcon, Settings, LayoutDashboard } from "lucide-react";
import { useEffect, useState } from "react";

const STATIC_ITEMS = [
  { label: "Dashboard", href: "/bezs", icon: LayoutDashboard },
  { label: "Settings", href: "/bezs/settings", icon: Settings },
  { label: "Profile", href: "/bezs/settings/profile", icon: Settings },
  { label: "Appearance", href: "/bezs/settings/appearance", icon: Settings },
  { label: "Active Sessions", href: "/bezs/settings/sessions", icon: Settings },
  { label: "Password & Auth", href: "/bezs/settings/security", icon: Settings },
];

export function CommandSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        className="bg-muted/25 group text-muted-foreground hover:bg-accent relative h-8 w-full flex-1 justify-start rounded-md text-sm font-normal shadow-none sm:w-40 sm:pe-12 md:flex-none lg:w-52 xl:w-64 flex items-center"
        onClick={() => setOpen(true)}
      >
        <SearchIcon aria-hidden className="absolute inset-s-1.5 top-1/2 -translate-y-1/2" size={16} />
        <span className="ms-4">Search</span>
        <kbd className="bg-muted group-hover:bg-accent pointer-events-none absolute inset-e-[0.3rem] top-[0.3rem] hidden h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium select-none sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog modal open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages..." />
        <CommandList className="max-h-80 overflow-y-auto">
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {STATIC_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem asChild key={item.href}>
                  <Link href={item.href} onClick={() => setOpen(false)}>
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span>{item.label}</span>
                  </Link>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
