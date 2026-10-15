"use client";

import * as React from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { signOut } from "@/lib/auth/local";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SearchBar } from "@/components/SearchBar";
import { toast } from "sonner";

export function TopNav({ currentLocale }: { currentLocale: string }) {
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success(tNav("logout"));
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  return (
    <header
      className="sticky top-0 z-40 w-full border-b border-border bg-surface/80 backdrop-blur-md transition-colors duration-150 h-[calc(3.5rem+env(safe-area-inset-top,0px))] md:h-[calc(4rem+env(safe-area-inset-top,0px))]"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-2 sm:gap-4">
        {/* Left/Start: App Name & Brand Icon (Logo only on mobile < 768px) */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/sections"
            className="flex items-center gap-2 text-foreground hover:opacity-85 transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md min-h-[44px] min-w-[44px]"
          >
            <Image
              src="/logo.png"
              alt="Inventory App"
              width={32}
              height={32}
              sizes="32px"
              priority
              className="h-7 w-auto sm:h-8 object-contain shrink-0"
            />
            <span className="font-semibold text-sm tracking-tight hidden md:inline-block">
              {tCommon("appName")}
            </span>
          </Link>
        </div>

        {/* Center: Desktop Global Search Bar */}
        <div className="flex-1 max-w-md mx-auto hidden md:block">
          <SearchBar />
        </div>

        {/* Right/End: Controls (Mobile Search Icon, Theme Toggle, Locale Switcher, Logout) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mobile search icon button opening full-screen overlay */}
          <div className="md:hidden">
            <SearchBar mobileOnly />
          </div>

          <ThemeToggle />
          <LocaleSwitcher currentLocale={currentLocale} />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-muted hover:text-danger h-10 w-10 sm:h-8 sm:w-8 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-0"
            title={tNav("logout")}
            aria-label={tNav("logout")}
          >
            <LogOut className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      </div>
    </header>
  );
}
