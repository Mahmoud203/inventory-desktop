"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Settings,
  Archive,
  RefreshCw,
  Info,
  Laptop,
  CheckCircle2,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { getSession } from "@/lib/auth/local";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { toast } from "sonner";

declare global {
  interface Window {
    electronAPI?: {
      backup: () => Promise<{
        success: boolean;
        path?: string;
        error?: string;
        canceled?: boolean;
      }>;
      restore: () => Promise<{
        success: boolean;
        error?: string;
        canceled?: boolean;
      }>;
      getAppVersion: () => Promise<string>;
    };
  }
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tNav = useTranslations("nav");
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const router = useRouter();

  const [isDesktopApp, setIsDesktopApp] = React.useState<boolean>(false);
  const [appVersion, setAppVersion] = React.useState<string>("1.0.0");
  const [isBackingUp, setIsBackingUp] = React.useState<boolean>(false);
  const [isRestoring, setIsRestoring] = React.useState<boolean>(false);

  // Protected route check
  React.useEffect(() => {
    const verifySession = async () => {
      const {
        data: { session },
      } = await getSession();
      if (!session) {
        router.replace("/login");
      }
    };
    verifySession();
  }, [router]);

  // Check if running in Electron and fetch version
  React.useEffect(() => {
    let isMounted = true;
    if (typeof window !== "undefined" && window.electronAPI) {
      window.electronAPI
        .getAppVersion()
        .then((ver) => {
          if (isMounted) {
            setIsDesktopApp(true);
            if (ver) setAppVersion(ver);
          }
        })
        .catch(() => {
          if (isMounted) setIsDesktopApp(true);
        });
    }
    return () => {
      isMounted = false;
    };
  }, []);

  const handleBackup = async () => {
    if (!window.electronAPI) return;
    setIsBackingUp(true);
    try {
      const res = await window.electronAPI.backup();
      if (res.canceled) return;

      if (res.success && res.path) {
        toast.success(t("backupSuccess", { path: res.path }));
      } else {
        toast.error(res.error || t("backupFailed"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("backupFailed"));
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async () => {
    if (!window.electronAPI) return;
    setIsRestoring(true);
    try {
      const res = await window.electronAPI.restore();
      if (res.canceled) return;

      if (res.success) {
        toast.success(t("restoreSuccess"));
      } else {
        toast.error(res.error || t("restoreFailed"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("restoreFailed"));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-foreground">
      <TopNav currentLocale={locale} />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/sections">{tNav("sections")}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t("title")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Page Header */}
        <div className="border-b border-border/40 pb-4 text-start space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Settings className="h-7 w-7 text-accent" />
            <span>{t("title")}</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            {t("subtitle")}
          </p>
        </div>

        {/* Browser Notice (When not running inside Electron) */}
        {!isDesktopApp && (
          <div className="rounded-xl border border-border/80 bg-surface-raised p-4 sm:p-5 shadow-soft flex items-start gap-3.5 text-start">
            <div className="p-2 rounded-lg bg-secondary text-muted shrink-0 mt-0.5">
              <Laptop className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {t("desktopOnlyNotice")}
              </p>
              <p className="text-xs text-muted leading-relaxed">
                {locale === "ar"
                  ? "قم بتشغيل تطبيق سطح المكتب للوصول إلى أدوات النسخ الاحتياطي واستعادة البيانات بنقرة واحدة."
                  : "Launch the desktop application to access one-click backup and restore capabilities."}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Section 1: Backup */}
          <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-soft space-y-4 text-start">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-accent/10 text-accent shrink-0">
                <Archive className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-foreground">
                  {t("backupSection")}
                </h2>
                <p className="text-xs sm:text-sm text-muted leading-relaxed max-w-2xl">
                  {t("backupDescription")}
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <Button
                type="button"
                onClick={handleBackup}
                disabled={!isDesktopApp}
                isLoading={isBackingUp}
                className="gap-2 min-h-[44px] sm:min-h-10 px-5 font-medium shadow-soft"
              >
                <Archive className="h-4 w-4" />
                <span>{t("exportBackup")}</span>
              </Button>
            </div>
          </div>

          {/* Section 2: Restore */}
          <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-soft space-y-4 text-start">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-danger/10 text-danger shrink-0">
                <RefreshCw className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-foreground">
                  {t("restoreSection")}
                </h2>
                <p className="text-xs sm:text-sm text-muted leading-relaxed max-w-2xl">
                  {t("restoreDescription")}
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <Button
                type="button"
                variant="danger"
                onClick={handleRestore}
                disabled={!isDesktopApp}
                isLoading={isRestoring}
                className="gap-2 min-h-[44px] sm:min-h-10 px-5 font-medium shadow-soft"
              >
                <RefreshCw className="h-4 w-4" />
                <span>{t("restoreButton")}</span>
              </Button>
            </div>
          </div>

          {/* Section 3: About */}
          <div className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-soft space-y-4 text-start">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-secondary text-muted shrink-0">
                <Info className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-foreground">
                  {t("aboutSection")}
                </h2>
                <p className="text-xs sm:text-sm text-muted">
                  {t("appName")}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-border/40 divide-y divide-border/40 text-xs sm:text-sm">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-muted">{t("appName")}</span>
                <span className="font-semibold text-foreground">
                  {locale === "ar" ? "تطبيق إدارة المخزون" : "Inventory App"}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-muted">{t("version")}</span>
                <span className="font-mono font-medium text-foreground">
                  v{appVersion}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-muted">
                  {locale === "ar" ? "وضع التشغيل" : "Runtime Mode"}
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {isDesktopApp ? "Electron Native Desktop (Offline)" : "Web Browser (Local)"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
