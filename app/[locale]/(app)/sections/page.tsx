"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Plus, ChevronRight, PackageOpen, LayoutGrid, MoreHorizontal } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { getSession, getUser } from "@/lib/auth/local";
import {
  list as listSections,
  create as createSection,
  remove as removeSection,
} from "@/lib/data/sections";
import { TopNav } from "@/components/TopNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SectionWithCount {
  id: string;
  name: string;
  created_at: string;
  storeCount: number;
  productCount: number;
}

export default function SectionsPage() {
  const t = useTranslations("sections");
  const tCommon = useTranslations("common");
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const router = useRouter();

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [sectionName, setSectionName] = React.useState("");
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // Deletion state
  const [sectionToDelete, setSectionToDelete] = React.useState<SectionWithCount | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

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

  // SWR Fetcher
  const fetchSections = async (): Promise<SectionWithCount[]> => {
    const {
      data: { user },
      error: userError,
    } = await getUser();

    if (userError || !user) {
      throw new Error("UNAUTHORIZED");
    }

    const data = await listSections(user.id);
    return data.map((row) => ({
      id: row.id,
      name: row.name,
      created_at: row.created_at,
      storeCount: row.storeCount || 0,
      productCount: row.productCount || 0,
    }));
  };

  const {
    data: sections,
    error,
    isLoading,
    mutate,
  } = useSWR("sections", fetchSections, {
    revalidateOnFocus: true,
  });

  // Handle unauthorized SWR error
  React.useEffect(() => {
    if (error?.message === "UNAUTHORIZED") {
      router.replace("/login");
    }
  }, [error, router]);

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionName.trim()) {
      setNameError(t("nameRequired"));
      return;
    }

    setNameError(null);
    setIsSaving(true);

    try {
      const {
        data: { user },
      } = await getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      await createSection({ name: sectionName.trim() }, user.id);

      toast.success(t("createSuccess"));
      await mutate();
      setIsDialogOpen(false);
      setSectionName("");
    } catch {
      toast.error(t("createError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSection = async (targetSection: SectionWithCount) => {
    setIsDeleting(true);
    setDeletingId(targetSection.id);

    const previousSections = sections;

    // Optimistically remove card from list
    await mutate(
      (current) => current?.filter((s) => s.id !== targetSection.id),
      { revalidate: false }
    );

    try {
      const {
        data: { user },
      } = await getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      await removeSection(targetSection.id, user.id);
      toast.success(t("deleteSuccess"));
      setSectionToDelete(null);
      await mutate();
    } catch {
      // Restore list on error
      await mutate(previousSections, { revalidate: true });
      toast.error(t("deleteError"), {
        action: {
          label: tCommon("retry"),
          onClick: () => handleDeleteSection(targetSection),
        },
      });
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-foreground">
      <TopNav currentLocale={locale} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-6">
          <div className="space-y-1 text-start">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 sm:h-6 sm:w-6 text-accent shrink-0" />
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
                {t("title")}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted max-w-2xl leading-relaxed">
              {t("subtitle")}
            </p>
          </div>

          {sections && sections.length > 0 && (
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsDialogOpen(true)}
              className="gap-2 shrink-0 font-medium w-full sm:w-auto justify-center"
            >
              <Plus className="h-4 w-4" />
              {t("addSection")}
            </Button>
          )}
        </div>

        {/* Content Body: Loading / Empty / Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-28 p-4 md:p-6 flex flex-col justify-between shadow-soft">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-3/5" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-2 w-12 ms-auto" />
              </Card>
            ))}
          </div>
        ) : sections && sections.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => (
              <div
                key={section.id}
                className={cn(
                  "transition-all duration-150 ease-out",
                  deletingId === section.id && "opacity-0 scale-95 pointer-events-none"
                )}
              >
                <Card className="relative group h-full p-4 md:p-6 transition-all duration-150 ease-out hover:border-accent hover:shadow-card">
                  {/* Clickable Card Link for Navigation */}
                  <Link
                    href={`/sections/${section.id}`}
                    className="absolute inset-0 z-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={section.name}
                  />

                  <div className="relative z-10 flex items-start justify-between gap-3 pointer-events-none">
                    <div className="space-y-1.5 text-start min-w-0 pe-2">
                      <h3 className="font-semibold text-base text-foreground tracking-tight group-hover:text-accent transition-colors duration-150 truncate">
                        {section.name}
                      </h3>
                      <p className="text-xs text-muted">
                        {t("storesCount", { count: section.storeCount })}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 pointer-events-auto">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-10 w-10 sm:h-8 sm:w-8 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-0 text-muted hover:text-foreground hover:bg-surface-hover rounded-md focus-visible:ring-1"
                            aria-label={t("optionsAria")}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem
                            disabled
                            title={tCommon("comingSoon")}
                            className="cursor-not-allowed opacity-50"
                          >
                            {tCommon("rename")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="danger"
                            className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSectionToDelete(section);
                            }}
                          >
                            {t("deleteSection")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <ChevronRight className="h-5 w-5 text-muted/60 transition-transform duration-150 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 rtl:rotate-180 group-hover:text-foreground pointer-events-none" />
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={PackageOpen}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={
              <div className="flex flex-col items-center gap-2">
                <Button
                  variant="primary"
                  onClick={() => setIsDialogOpen(true)}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full p-0 shadow-soft transition-transform duration-150 hover:scale-[1.03] active:scale-95"
                  title={t("addSection")}
                  aria-label={t("addSection")}
                >
                  <Plus className="h-6 w-6 sm:h-7 sm:w-7 stroke-[2.5]" />
                </Button>
                <span className="text-xs font-medium text-foreground">
                  {t("addSection")}
                </span>
              </div>
            }
          />
        )}
      </main>

      {/* Add Section Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleCreateSection}>
            <DialogHeader>
              <DialogTitle>{t("dialogTitle")}</DialogTitle>
              <DialogDescription>{t("dialogDescription")}</DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-2 text-start">
              <Label htmlFor="section-name">{t("sectionNameLabel")}</Label>
              <Input
                id="section-name"
                placeholder={t("sectionNamePlaceholder")}
                value={sectionName}
                onChange={(e) => {
                  setSectionName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                error={!!nameError}
                disabled={isSaving}
                autoFocus
              />
              {nameError && (
                <p className="text-xs text-danger text-start">{nameError}</p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDialogOpen(false);
                  setSectionName("");
                  setNameError(null);
                }}
                disabled={isSaving}
                className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSaving}
                className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
              >
                {tCommon("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      {sectionToDelete && (
        <DeleteConfirmDialog
          open={!!sectionToDelete}
          onOpenChange={(open) => {
            if (!open && !isDeleting) {
              setSectionToDelete(null);
            }
          }}
          title={t("deleteDialogTitle")}
          body={t("deleteDialogBody", { name: sectionToDelete.name })}
          confirmLabel={t("deleteSection")}
          productCount={sectionToDelete.productCount}
          productsWarning={t("deleteProductsWarning", { count: sectionToDelete.productCount })}
          isDeleting={isDeleting}
          onConfirm={() => handleDeleteSection(sectionToDelete)}
        />
      )}
    </div>
  );
}
