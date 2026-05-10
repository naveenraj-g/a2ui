"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeSwitcher({
  className,
  iconOnly = false,
}: {
  className?: string;
  iconOnly?: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size={iconOnly ? "icon" : "sm"}
      className={cn(!iconOnly && "gap-2 text-sm font-normal", className)}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {!iconOnly && (isDark ? "Light mode" : "Dark mode")}
    </Button>
  );
}
