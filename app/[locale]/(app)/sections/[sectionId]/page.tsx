"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import useSWR, { mutate as globalMutate } from "swr";
import { Plus, ChevronRight, Store, Warehouse, MoreHorizontal, Trash2 } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { getSession, getUser } from "@/lib/auth/local";
import { TopNav } from "@/components/TopNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
import { deleteStoreWithStorage, deleteSectionWithStorage } from "@/lib/supabase/delete-helpers";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface StoreWithProductCount {
  id: string;
  name: string;
  section_id: string;
  created_at: string;
  productCount: number;
}

interface SectionInfo {
  id: string;
  name: string;
}

interface StoreQueryResult {
  id: string;
  name: string;
  section_id: string;
  created_at: string;
  products?: { id: string }[];
}

export default function SectionDetailsPage() {
  const tSections = useTranslations("sections");
  const tStores = useTranslations("stores");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const sectionId = params?.sectionId as string;

  const router = useRouter();
  const supabase = createClient();

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [storeName, setStoreName] = React.useState("");
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // Store deletion state
  const [storeToDelete, setStoreToDelete] = React.useState<StoreWithProductCount | null>(null);
  const [isDeletingStore, setIsDeletingStore] = React.useState(false);
  const [deletingStoreId, setDeletingStoreId] = React.useState<string | null>(null);

  // Section deletion state (from header)
  const [isDeleteSectionOpen, setIsDeleteSectionOpen] = React.useState(false);
  const [isDeletingSection, setIsDeletingSection] = React.useState(false);

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

  // Fetch Section Info (for Breadcrumb & Header)
  const fetchSection = async (): Promise<SectionInfo> => {
    const { data, error } = await supabase
      .from("sections")
      .select("id, name")
      .eq("id", sectionId)
      .single();

    if (error) {
      throw error;
    }
    return data;
  };

  const { data: section } = useSWR(
    sectionId ? `section-${sectionId}` : null,
    fetchSection,
    { revalidateOnFocus: true }
  );

  // Fetch Stores in this Section
  const fetchStores = async (): Promise<StoreWithProductCount[]> => {
    const {
      data: { user },
      error: userError,
    } = await getUser();

    if (userError || !user) {
      throw new Error("UNAUTHORIZED");
    }

    const { data, error } = await supabase
      .from("stores")
      .select(
        `
        id,
        name,
        section_id,
        created_at,
        products (id)
      `
      )
      .eq("section_id", sectionId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return ((data || []) as unknown as StoreQueryResult[]).map((row) => ({
      id: row.id,
      name: row.name,
      section_id: row.section_id,
      created_at: row.created_at,
      productCount: Array.isArray(row.products) ? row.products.length : 0,
    }));
  };

  const {
    data: stores,
    error: storesError,
    isLoading,
    mutate,
  } = useSWR(sectionId ? `stores-${sectionId}` : null, fetchStores, {
    revalidateOnFocus: true,
  });

  // Handle unauthorized SWR error
  React.useEffect(() => {
    if (storesError?.message === "UNAUTHORIZED") {
      router.replace("/login");
    }
  }, [storesError, router]);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      setNameError(tStores("nameRequired"));
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

      const { error: insertError } = await supabase.from("stores").insert({
        name: storeName.trim(),
        section_id: sectionId,
        user_id: user.id,
      });

      if (insertError) {
        throw insertError;
      }

      toast.success(tStores("createSuccess"));
      await mutate();
      setIsDialogOpen(false);
      setStoreName("");
    } catch {
      toast.error(tStores("createError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStore = async (targetStore: StoreWithProductCount) => {
    setIsDeletingStore(true);
    setDeletingStoreId(targetStore.id);

    const previousStores = stores;

    // Optimistically remove store card from list
    await mutate(
      (current) => current?.filter((s) => s.id !== targetStore.id),
      { revalidate: false }
    );

    try {
      await deleteStoreWithStorage(supabase, targetStore.id);
      toast.success(tStores("deleteSuccess"));
      setStoreToDelete(null);
      await mutate();
    } catch {
      // Restore list on error
      await mutate(previousStores, { revalidate: true });
      toast.error(tStores("deleteError"), {
        action: {
          label: tCommon("retry"),
          onClick: () => handleDeleteStore(targetStore),
        },
      });
    } finally {
      setIsDeletingStore(false);
      setDeletingStoreId(null);
    }
  };

  const handleDeleteSection = async () => {
    if (!section) return;
    setIsDeletingSection(true);

    try {
      await deleteSectionWithStorage(supabase, section.id);
      toast.success(tSections("deleteSuccess"));
      globalMutate("sections");
      router.push("/sections");
    } catch {
      toast.error(tSections("deleteError"), {
        action: {
          label: tCommon("retry"),
          onClick: () => handleDeleteSection(),
        },
      });
    } finally {
      setIsDeletingSection(false);
      setIsDeleteSectionOpen(false);
    }
  };

  const totalSectionProducts = stores
    ? stores.reduce((sum, s) => sum + s.productCount, 0)
    : 0;

  return (
    <div className="min-h-screen bg-bg text-foreground">
      <TopNav currentLocale={locale} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Breadcrumb Navigation */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/sections">{tNav("sections")}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {section?.name ? (
                  section.name
                ) : (
                  <Skeleton className="h-4 w-28 inline-block align-middle" />
                )}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-6">
          <div className="space-y-1 text-start">
            <div className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 sm:h-6 sm:w-6 text-accent shrink-0" />
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
                {section?.name ? (
                  section.name
                ) : (
                  <Skeleton className="h-7 w-48" />
                )}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted max-w-2xl leading-relaxed">
              {tStores("subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {section && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsDeleteSectionOpen(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-500/10 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-500/20 gap-1.5 min-h-[44px] sm:min-h-0"
                title={tSections("deleteSection")}
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                <span>{tSections("deleteSection")}</span>
              </Button>
            )}

            {stores && stores.length > 0 && (
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsDialogOpen(true)}
                className="gap-2 shrink-0 font-medium w-full sm:w-auto justify-center"
              >
                <Plus className="h-4 w-4" />
                {tStores("addStore")}
              </Button>
            )}
          </div>
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
        ) : stores && stores.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <div
                key={store.id}
                className={cn(
                  "transition-all duration-150 ease-out",
                  deletingStoreId === store.id && "opacity-0 scale-95 pointer-events-none"
                )}
              >
                <Card className="relative group h-full p-4 md:p-6 transition-all duration-150 ease-out hover:border-accent hover:shadow-card">
                  {/* Clickable Card Link for Navigation */}
                  <Link
                    href={`/sections/${sectionId}/${store.id}`}
                    className="absolute inset-0 z-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={store.name}
                  />

                  <div className="relative z-10 flex items-start justify-between gap-3 pointer-events-none">
                    <div className="space-y-1.5 text-start min-w-0 pe-2">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-muted group-hover:text-accent transition-colors duration-150 shrink-0" />
                        <h3 className="font-semibold text-base text-foreground tracking-tight group-hover:text-accent transition-colors duration-150 truncate">
                          {store.name}
                        </h3>
                      </div>
                      <p className="text-xs text-muted">
                        {tStores("productsCount", { count: store.productCount })}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 pointer-events-auto">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-10 w-10 sm:h-8 sm:w-8 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-0 text-muted hover:text-foreground hover:bg-surface-hover rounded-md focus-visible:ring-1"
                            aria-label={tStores("optionsAria")}
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
                              setStoreToDelete(store);
                            }}
                          >
                            {tStores("deleteStore")}
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
            icon={Store}
            title={tStores("emptyTitle")}
            description={tStores("emptyDescription")}
            action={
              <div className="flex flex-col items-center gap-2">
                <Button
                  variant="primary"
                  onClick={() => setIsDialogOpen(true)}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full p-0 shadow-soft transition-transform duration-150 hover:scale-[1.03] active:scale-95"
                  title={tStores("addStore")}
                  aria-label={tStores("addStore")}
                >
                  <Plus className="h-6 w-6 sm:h-7 sm:w-7 stroke-[2.5]" />
                </Button>
                <span className="text-xs font-medium text-foreground">
                  {tStores("addStore")}
                </span>
              </div>
            }
          />
        )}
      </main>

      {/* Add Store Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleCreateStore}>
            <DialogHeader>
              <DialogTitle>{tStores("dialogTitle")}</DialogTitle>
              <DialogDescription>{tStores("dialogDescription")}</DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-2 text-start">
              <Label htmlFor="store-name">{tStores("storeNameLabel")}</Label>
              <Input
                id="store-name"
                placeholder={tStores("storeNamePlaceholder")}
                value={storeName}
                onChange={(e) => {
                  setStoreName(e.target.value);
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
                  setStoreName("");
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

      {/* Delete Store Confirmation Dialog */}
      {storeToDelete && (
        <DeleteConfirmDialog
          open={!!storeToDelete}
          onOpenChange={(open) => {
            if (!open && !isDeletingStore) {
              setStoreToDelete(null);
            }
          }}
          title={tStores("deleteDialogTitle")}
          body={tStores("deleteDialogBody", { name: storeToDelete.name })}
          confirmLabel={tStores("deleteStore")}
          productCount={storeToDelete.productCount}
          productsWarning={tStores("deleteProductsWarning", { count: storeToDelete.productCount })}
          isDeleting={isDeletingStore}
          onConfirm={() => handleDeleteStore(storeToDelete)}
        />
      )}

      {/* Delete Section Header Confirmation Dialog */}
      {section && (
        <DeleteConfirmDialog
          open={isDeleteSectionOpen}
          onOpenChange={(open) => {
            if (!open && !isDeletingSection) {
              setIsDeleteSectionOpen(false);
            }
          }}
          title={tSections("deleteDialogTitle")}
          body={tSections("deleteDialogBody", { name: section.name })}
          confirmLabel={tSections("deleteSection")}
          productCount={totalSectionProducts}
          productsWarning={tSections("deleteProductsWarning", { count: totalSectionProducts })}
          isDeleting={isDeletingSection}
          onConfirm={handleDeleteSection}
        />
      )}
    </div>
  );
}
