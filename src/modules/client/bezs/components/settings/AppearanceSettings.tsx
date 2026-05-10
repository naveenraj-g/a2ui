"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, RotateCcw, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppearanceSettings() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-16 w-64 rounded-lg" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </main>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Palette className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Appearance</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Customize the look and feel of the application.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <CardDescription>Choose your preferred display mode.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  {isDark
                    ? <Moon className="size-4 text-foreground" />
                    : <Sun className="size-4 text-foreground" />
                  }
                </div>
                <div>
                  <Label htmlFor="dark-mode" className="text-sm font-medium cursor-pointer">
                    Dark Mode
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Switch between light and dark appearance
                  </p>
                </div>
              </div>
              <Switch
                id="dark-mode"
                checked={isDark}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              />
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-medium block mb-1">Preview</Label>
              <p className="text-xs text-muted-foreground mb-4">How your selected theme looks</p>
              <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-muted/40">
                  <div className="size-2.5 rounded-full bg-destructive/60" />
                  <div className="size-2.5 rounded-full bg-yellow-400/60" />
                  <div className="size-2.5 rounded-full bg-green-500/60" />
                  <div className="mx-auto h-5 w-32 rounded-md bg-background/80 border text-[9px] flex items-center justify-center text-muted-foreground font-mono">
                    app.a2ui.com
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="h-3 w-20 rounded-md bg-foreground/80 mb-1.5" />
                      <div className="h-2 w-28 rounded-md bg-muted-foreground/40" />
                    </div>
                    <div className="flex gap-1.5">
                      <div className="h-6 w-14 rounded-md bg-primary flex items-center justify-center">
                        <div className="h-1.5 w-8 rounded bg-primary-foreground/70" />
                      </div>
                      <div className="h-6 w-14 rounded-md border bg-secondary flex items-center justify-center">
                        <div className="h-1.5 w-8 rounded bg-secondary-foreground/40" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[false, true, false].map((highlight, i) => (
                      <div
                        key={i}
                        className={`rounded-lg border p-2.5 space-y-1.5 ${highlight ? "bg-primary/10 border-primary/30" : "bg-muted"}`}
                      >
                        <div className="h-1.5 w-8 rounded bg-muted-foreground/30" />
                        <div className={`h-3 w-full rounded ${highlight ? "bg-primary/50" : "bg-muted-foreground/20"}`} />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>Active</Badge>
                    <Badge variant="secondary">Review</Badge>
                    <Badge variant="outline">Draft</Badge>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Reset to Default</p>
                <p className="text-xs text-muted-foreground">Reverts to system preference</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setTheme("system")} className="gap-2">
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pb-4">
          <span>Active theme:</span>
          <Badge variant="secondary" className="font-mono capitalize">
            {isDark ? "Dark" : "Light"}
          </Badge>
        </div>
      </div>
    </main>
  );
}
