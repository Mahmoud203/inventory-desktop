"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import useSWR, { mutate as globalMutate } from "swr";
import {
  Plus,
  Package,
  QrCode,
  ImageIcon,
  Store,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { getSession, getUser } from "@/lib/auth/local";
import { get as getSection } from "@/lib/data/sections";
import { get as getStore, remove as removeStore } from "@/lib/data/stores";
import { list as listProducts } from "@/lib/data/products";
import { TopNav } from "@/components/TopNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductFormModal } from "@/components/ProductFormModal";
import { toast } from "sonner";

interface ProductItem {
  id: string;
  name: string;
  notes: string | null;
  photo_url: string | null;
  has_qr: boolean;
  qr_data: string | null;
  created_at: string;
}

interface HierarchyInfo {
  sectionName: string;
  storeName: string;
}

export default function StoreProductsPage() {
  const tProducts = useTranslations("products");
  const tStores = useTranslations("stores");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const sectionId = params?.sectionId as string;
  const storeId = params?.storeId as string;

  const router = useRouter();

  const [isFormOpen, setIsFormOpen] = React.useState(false);

  // Store deletion state
  const [isDeleteStoreOpen, setIsDeleteStoreOpen] = React.useState(false);
  const [isDeletingStore, setIsDeletingStore] = React.useState(false);

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

  // Fetch Section and Store names for Breadcrumbs
  const fetchHierarchy = async (): Promise<HierarchyInfo> => {
    const {
      data: { user },
      error: userError,
    } = await getUser();

    if (userError || !user) {
      throw new Error("UNAUTHORIZED");
    }

    const [sec, store] = await Promise.all([
      getSection(sectionId, user.id),
      getStore(storeId, user.id),
    ]);

    return {
      sectionName: sec?.name || "",
      storeName: store?.name || "",
    };
  };

  const { data: hierarchy } = useSWR(
    sectionId && storeId ? `hierarchy-${sectionId}-${storeId}` : null,
    fetchHierarchy,
    { revalidateOnFocus: true }
  );

  // Fetch Products in this Store
  const fetchProducts = async (): Promise<ProductItem[]> => {
    const {
      data: { user },
      error: userError,
    } = await getUser();

    if (userError || !user) {
      throw new Error("UNAUTHORIZED");
    }

    const items = await listProducts(user.id, storeId);
    return items.map((p) => ({
      id: p.id,
      name: p.name,
      notes: p.notes,
      photo_url: p.photo_url,
      has_qr: p.has_qr,
      qr_data: p.qr_data,
      created_at: p.created_at,
    }));
  };

  const {
    data: products,
    error: productsError,
    isLoading,
    mutate,
  } = useSWR(storeId ? `products-${storeId}` : null, fetchProducts, {
    revalidateOnFocus: true,
  });

  // Handle unauthorized SWR error
  React.useEffect(() => {
    if (productsError?.message === "UNAUTHORIZED") {
      router.replace("/login");
    }
  }, [productsError, router]);

  const handleDeleteStore = async () => {
    setIsDeletingStore(true);
    try {
      const {
        data: { user },
      } = await getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      await removeStore(storeId, user.id);
      toast.success(tStores("deleteSuccess"));
      globalMutate(`stores-${sectionId}`);
      router.push(`/sections/${sectionId}`);
    } catch {
      toast.error(tStores("deleteError"), {
        action: {
          label: tCommon("retry"),
          onClick: () => handleDeleteStore(),
        },
      });
    } finally {
      setIsDeletingStore(false);
      setIsDeleteStoreOpen(false);
    }
  };

  const totalProducts = products?.length || 0;

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
              <BreadcrumbLink asChild>
                <Link href={`/sections/${sectionId}`}>
                  {hierarchy?.sectionName ? (
                    hierarchy.sectionName
                  ) : (
                    <Skeleton className="h-4 w-20 inline-block align-middle" />
                  )}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {hierarchy?.storeName ? (
                  hierarchy.storeName
                ) : (
                  <Skeleton className="h-4 w-24 inline-block align-middle" />
                )}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Store Products Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-6">
          <div className="space-y-1 text-start">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 sm:h-6 sm:w-6 text-accent shrink-0" />
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
                {hierarchy?.storeName ? (
                  hierarchy.storeName
                ) : (
                  <Skeleton className="h-7 w-48" />
                )}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted max-w-2xl leading-relaxed">
              {tProducts("subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hierarchy?.storeName && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsDeleteStoreOpen(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-500/10 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-500/20 gap-1.5 min-h-[44px] sm:min-h-0"
                title={tStores("deleteStore")}
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                <span>{tStores("deleteStore")}</span>
              </Button>
            )}

            {products && products.length > 0 && (
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsFormOpen(true)}
                className="gap-2 shrink-0 font-medium w-full sm:w-auto justify-center"
              >
                <Plus className="h-4 w-4" />
                {tProducts("addProduct")}
              </Button>
            )}
          </div>
        </div>

        {/* Content Body: Loading / Empty / Grid (2 cols mobile, 3 sm, 4 lg) */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="overflow-hidden border border-border bg-surface">
                <Skeleton className="h-32 sm:h-40 w-full rounded-none" />
                <div className="p-3 sm:p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </Card>
            ))}
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/product/${product.id}`}
                className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Card className="h-full overflow-hidden transition-all duration-150 ease-out hover:border-accent hover:shadow-card hover:-translate-y-0.5 cursor-pointer flex flex-col">
                  {/* Thumbnail Banner */}
                  <div className="relative h-32 sm:h-44 w-full bg-secondary/40 overflow-hidden flex items-center justify-center border-b border-border/40">
                    {product.photo_url ? (
                      <img
                        src={product.photo_url}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted/60">
                        <ImageIcon className="h-7 w-7 sm:h-8 sm:w-8 stroke-[1.5]" />
                      </div>
                    )}

                    {/* QR Code Tag */}
                    {product.has_qr && (
                      <div className="absolute top-2 end-2 sm:top-2.5 sm:end-2.5 flex items-center gap-1 rounded-sm bg-surface/90 backdrop-blur-xs px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-accent shadow-soft border border-border/60">
                        <QrCode className="h-3 w-3" />
                        <span className="hidden xs:inline sm:inline">{tProducts("hasQr")}</span>
                      </div>
                    )}
                  </div>

                  {/* Details Body */}
                  <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between space-y-2 text-start">
                    <div>
                      <h3 className="font-semibold text-xs sm:text-sm text-foreground tracking-tight group-hover:text-accent transition-colors duration-150 truncate">
                        {product.name}
                      </h3>
                      {product.notes && (
                        <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">
                          {product.notes}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-border/30 text-[10px] sm:text-[11px] text-muted">
                      <span>
                        {new Intl.DateTimeFormat(
                          locale === "ar" ? "ar-SA" : "en-US",
                          { month: "short", day: "numeric", year: "numeric" }
                        ).format(new Date(product.created_at))}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity rtl:-scale-x-100" />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Package}
            title={tProducts("emptyTitle")}
            description={tProducts("emptyDescription")}
            action={
              <div className="flex flex-col items-center gap-2">
                <Button
                  variant="primary"
                  onClick={() => setIsFormOpen(true)}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full p-0 shadow-soft transition-transform duration-150 hover:scale-[1.03] active:scale-95"
                  title={tProducts("addProduct")}
                  aria-label={tProducts("addProduct")}
                >
                  <Plus className="h-6 w-6 sm:h-7 sm:w-7 stroke-[2.5]" />
                </Button>
                <span className="text-xs font-medium text-foreground">
                  {tProducts("addProduct")}
                </span>
              </div>
            }
          />
        )}
      </main>

      {/* Product Creation Modal (Full-screen Sheet on mobile, Dialog on desktop) */}
      <ProductFormModal
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        storeId={storeId}
        onSuccess={() => {
          setIsFormOpen(false);
          mutate();
        }}
        onCancel={() => setIsFormOpen(false)}
      />

      {/* Delete Store Confirmation Dialog */}
      {hierarchy && (
        <DeleteConfirmDialog
          open={isDeleteStoreOpen}
          onOpenChange={(open) => {
            if (!open && !isDeletingStore) {
              setIsDeleteStoreOpen(false);
            }
          }}
          title={tStores("deleteDialogTitle")}
          body={tStores("deleteDialogBody", { name: hierarchy.storeName })}
          confirmLabel={tStores("deleteStore")}
          productCount={totalProducts}
          productsWarning={tStores("deleteProductsWarning", { count: totalProducts })}
          isDeleting={isDeletingStore}
          onConfirm={handleDeleteStore}
        />
      )}
    </div>
  );
}
