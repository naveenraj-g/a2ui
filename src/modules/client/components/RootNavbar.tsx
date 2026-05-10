"use client";

import { Button } from "@/components/ui/button";
import { OAuthPkceButton } from "@/modules/client/auth/components/OAuthPkceButton";
import { ThemeSwitcher } from "@/theme/ThemeSwitcher";
import { NavUser } from "@/modules/shared/components/NavUser";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import type { AuthResponse } from "@/modules/server/auth/types";

export default function RootNavbar({ session }: { session: AuthResponse | null }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const user = session
    ? {
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        username: session.user.username,
      }
    : null;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-background/80 backdrop-blur-md shadow-sm border-b border-border"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 text-primary">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-2xl font-bold text-foreground tracking-tight">A2UI</span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-muted-foreground font-medium hover:text-primary transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-muted-foreground font-medium hover:text-primary transition-colors">
              How It Works
            </a>
            <a href="#testimonials" className="text-muted-foreground font-medium hover:text-primary transition-colors">
              Testimonials
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <ThemeSwitcher iconOnly className="size-9 rounded-full" />
            {!user ? (
              <>
                <OAuthPkceButton variant="ghost" size="sm" className="font-semibold rounded-full">
                  Sign In
                </OAuthPkceButton>
                <OAuthPkceButton size="sm" className="rounded-full px-6 shadow-md hover:shadow-lg transition-all">
                  Sign Up
                </OAuthPkceButton>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  className="rounded-full px-6 shadow-md hover:shadow-lg transition-all"
                  onClick={() => router.push("/bezs")}
                >
                  Open App
                </Button>
                <NavUser user={user} />
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
