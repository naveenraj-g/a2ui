"use client";

import { Activity } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import Link from "next/link";

export function AppTitle() {
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="hover:bg-transparent active:bg-transparent"
          asChild
        >
          <Link href="/bezs" onClick={() => setOpenMobile(false)}>
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="size-4" />
            </div>
            <div className="grid flex-1 text-start text-sm leading-tight">
              <span className="truncate font-bold">A2UI</span>
              <span className="truncate text-xs text-muted-foreground">Dashboard</span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
