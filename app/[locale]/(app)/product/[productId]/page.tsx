"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import useSWR, { mutate as globalMutate } from "swr";
import {
  Edit,
  Trash2,
  Download,
  AlertTriangle,
  ImageIcon,
  Copy,
  RefreshCw,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { getSession, getUser } from "@/lib/auth/local";
import { generateQrDataUrl } from "@/lib/qrcode";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductFormModal } from "@/components/ProductFormModal";
import type { InitialProductData } from "@/components/ProductForm";
import { toast } from "sonner";

interface ProductDetailData {
  id: string;
  store_id: string;
  name: string;
  notes: string | null;
  photo_url: string | null;
  has_qr: boolean;
  qr_data: string | null;
  share_token: string | null;
  created_at: string;
  stores?: {
    id: string;
    name: string;
    section_id: string;
    sections?: {
      id: string;
      name: string;
    } | null;
  } | null;
}

export default function ProductDetailPage() {
  const tDetail = useTranslations("productDetail");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const productId = params?.productId as string;

  const router = useRouter();
  const supabase = createClient();

  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isRegenerateDialogOpen, setIsRegenerateDialogOpen] = React.useState(false);
  const [isRegenerating, setIsRegenerating] = React.useState(false);
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  const migratingRef = React.useRef(false);

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

  // Fetch Product Details with store and section
  const fetchProduct = async (): Promise<ProductDetailData> => {
    const {
      data: { user },
      error: userError,
    } = await getUser();

    if (userError || !user) {
      throw new Error("UNAUTHORIZED");
    }

    const { data, error } = await supabase
      .from("products")
      .select(
        `
        id,
        store_id,
        name,
        notes,
        photo_url,
        has_qr,
        qr_data,
        share_token,
        created_at,
        stores (
          id,
          name,
          section_id,
          sections (
            id,
            name
          )
        )
      `
      )
      .eq("id", productId)
      .single();

    if (error) {
      throw error;
    }

    return data as unknown as ProductDetailData;
  };

  const {
    data: product,
    error: productError,
    isLoading,
    mutate,
  } = useSWR(productId ? `product-${productId}` : null, fetchProduct, {
    revalidateOnFocus: true,
  });

  // Handle unauthorized error
  React.useEffect(() => {
    if (productError?.message === "UNAUTHORIZED") {
      router.replace("/login");
    }
  }, [productError, router]);

  // Base URL & Public URL resolution
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const cleanOrigin = origin.replace(/\/+$/, "");
  const publicUrl = product?.share_token
    ? `${cleanOrigin}/${locale}/p/${product.share_token}`
    : null;

  // Auto-migrate products with has_qr = true but no share_token
  React.useEffect(() => {
    if (product && product.has_qr && !product.share_token && !migratingRef.current) {
      migratingRef.current = true;
      const autoMigrate = async () => {
        try {
          const newToken = crypto.randomUUID();
          const newQrData = `${cleanOrigin}/${locale}/p/${newToken}`;

          const { error } = await supabase
            .from("products")
            .update({
              share_token: newToken,
              qr_data: newQrData,
            })
            .eq("id", product.id);

          if (!error) {
            mutate();
          }
        } catch (err) {
          console.error("Auto-migration of product share_token failed:", err);
        } finally {
          migratingRef.current = false;
        }
      };
      autoMigrate();
    }
  }, [product, cleanOrigin, locale, supabase, mutate]);

  // Generate QR Code data URL when product loads with has_qr
  React.useEffect(() => {
    let isCancelled = false;
    const targetPayload = publicUrl || (product?.has_qr ? product?.qr_data : null);

    if (product?.has_qr && targetPayload) {
      generateQrDataUrl(targetPayload)
        .then((url) => {
          if (!isCancelled) {
            setQrDataUrl(url);
          }
        })
        .catch((err) => {
          console.error("Failed to generate QR Code data URL:", err);
        });
    } else {
      Promise.resolve().then(() => {
        if (!isCancelled) {
          setQrDataUrl(null);
        }
      });
    }

    return () => {
      isCancelled = true;
    };
  }, [product?.has_qr, product?.qr_data, publicUrl]);

  // Record Recently Viewed on Mount
  React.useEffect(() => {
    if (!productId) return;

    const recordRecentlyViewed = async () => {
      try {
        const {
          data: { user },
        } = await getUser();
        if (!user) return;

        // Upsert into recently_viewed
        const { data: existing } = await supabase
          .from("recently_viewed")
          .select("id")
          .eq("user_id", user.id)
          .eq("product_id", productId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("recently_viewed")
            .update({ viewed_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await supabase.from("recently_viewed").insert({
            user_id: user.id,
            product_id: productId,
            viewed_at: new Date().toISOString(),
          });
        }

        // Mutate recently-viewed SWR key for instant bar updates
        globalMutate("recently-viewed");
      } catch (err) {
        console.error("Failed to update recently viewed:", err);
      }
    };

    recordRecentlyViewed();
  }, [productId, supabase]);

  const handleDownloadQr = () => {
    if (!qrDataUrl || !product) return;
    const cleanName = product.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, "-");
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `qr-${cleanName || "product"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success(tDetail("linkCopied"));
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleRegenerateLink = async () => {
    if (!product) return;
    setIsRegenerating(true);
    try {
      const newToken = crypto.randomUUID();
      const newQrData = `${cleanOrigin}/${locale}/p/${newToken}`;

      const { error } = await supabase
        .from("products")
        .update({
          share_token: newToken,
          qr_data: newQrData,
        })
        .eq("id", product.id);

      if (error) {
        throw error;
      }

      toast.success(tDetail("regenerateSuccess"));
      setIsRegenerateDialogOpen(false);
      mutate();
    } catch (err) {
      console.error("Failed to regenerate QR:", err);
      toast.error(tDetail("regenerateError"));
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!product) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);

      if (error) {
        throw error;
      }

      toast.success(tDetail("deleteSuccess"));
      globalMutate("recently-viewed");

      const sectionId = product.stores?.section_id;
      const storeId = product.store_id;

      if (sectionId && storeId) {
        router.push(`/sections/${sectionId}/${storeId}`);
      } else {
        router.push("/sections");
      }
    } catch {
      toast.error(tDetail("deleteError"));
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const initialProductData: InitialProductData | null = product
    ? {
      id: product.id,
      name: product.name,
      notes: product.notes,
      photo_url: product.photo_url,
      has_qr: product.has_qr,
      qr_data: product.qr_data,
      share_token: product.share_token,
    }
    : null;

  return (
    <div className="min-h-screen bg-bg text-foreground pb-16">
      <TopNav currentLocale={locale} />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                {product?.stores?.sections ? (
                  <BreadcrumbLink asChild>
                    <Link
                      href={`/sections/${product.stores.sections.id}`}
                    >
                      {product.stores.sections.name}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <Skeleton className="h-4 w-20 inline-block align-middle" />
                )}
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {product?.stores ? (
                  <BreadcrumbLink asChild>
                    <Link
                      href={`/sections/${product.stores.section_id}/${product.store_id}`}
                    >
                      {product.stores.name}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <Skeleton className="h-4 w-24 inline-block align-middle" />
                )}
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {product ? (
                    product.name
                  ) : (
                    <Skeleton className="h-4 w-28 inline-block align-middle" />
                  )}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Top-Right Action Buttons */}
          {product && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditDialogOpen(true)}
                className="gap-1.5 text-muted hover:text-foreground w-full sm:w-auto justify-center min-h-[44px] sm:min-h-0"
              >
                <Edit className="h-4 w-4" />
                <span>{tDetail("edit")}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="gap-1.5 text-danger hover:bg-danger/10 hover:text-danger w-full sm:w-auto justify-center min-h-[44px] sm:min-h-0"
              >
                <Trash2 className="h-4 w-4" />
                <span>{tDetail("delete")}</span>
              </Button>
            </div>
          )}
        </div>

        {/* Content Body: Loading Skeleton vs Detail View */}
        {isLoading || !product ? (
          <div className="space-y-8 animate-in fade-in-50 duration-200">
            {/* 1. Large Photo Skeleton */}
            <Skeleton className="aspect-[4/3] w-full md:max-w-md mx-auto rounded-xl" />

            {/* 2. Title & Notes Skeleton */}
            <div className="space-y-3 text-start">
              <Skeleton className="h-9 w-3/4" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
            </div>

            {/* 3. QR Skeleton */}
            <div className="w-full max-w-xs sm:max-w-md mx-auto p-4 sm:p-6 rounded-xl border border-border bg-surface text-center space-y-4">
              <Skeleton className="h-40 w-40 sm:h-48 sm:w-48 mx-auto rounded-lg" />
              <Skeleton className="h-8 w-32 mx-auto" />
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in-50 duration-200 text-start">
            {/* 1. Large Photo (w-full mobile, max-w-md desktop) */}
            <div className="relative w-full md:max-w-md mx-auto aspect-[4/3] overflow-hidden rounded-xl border border-border bg-secondary/30 shadow-soft flex items-center justify-center">
              {product.photo_url ? (
                <img
                  src={product.photo_url}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-muted/50">
                  <ImageIcon className="h-16 w-16 sm:h-20 sm:w-20 stroke-[1.2]" />
                </div>
              )}
            </div>

            {/* 2. Product Name (text-2xl sm:text-3xl) */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                  {product.name}
                </h1>
                <div className="text-xs text-muted shrink-0 flex items-center gap-1.5">
                  <span>{tDetail("addedOn")}:</span>
                  <time dateTime={product.created_at} className="font-medium text-foreground/80">
                    {new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
                      dateStyle: "medium",
                    }).format(new Date(product.created_at))}
                  </time>
                </div>
              </div>

              {/* 3. Notes (text-sm sm:text-base, muted color, max-w-prose) */}
              <div className="text-sm sm:text-base text-muted max-w-prose leading-relaxed whitespace-pre-line">
                {product.notes || tDetail("noNotes")}
              </div>
            </div>

            {/* 4. QR Code Card (max-w-xs on mobile, max-w-md on desktop) */}
            {product.has_qr && (product.share_token || product.qr_data) && (
              <div className="pt-4">
                <div className="w-full max-w-xs sm:max-w-md mx-auto rounded-xl border border-border bg-surface p-4 sm:p-6 shadow-soft text-center space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-foreground tracking-tight">
                      {tDetail("qrHeading")}
                    </h2>
                    <p className="text-xs text-muted leading-relaxed">
                      {tDetail("qrSubtitle")}
                    </p>
                  </div>

                  {/* Centered White Card for high-contrast scan readability */}
                  <div className="flex justify-center p-3 sm:p-4 bg-white rounded-lg border border-border/80 w-fit mx-auto shadow-soft">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="Product QR code"
                        className="h-40 w-40 sm:h-48 sm:w-48 object-contain"
                      />
                    ) : (
                      <Skeleton className="h-40 w-40 sm:h-48 sm:w-48" />
                    )}
                  </div>

                  {/* Caption under the QR */}
                  <p className="text-xs text-muted leading-relaxed">
                    {tDetail("qrCaption")}
                  </p>

                  {/* Action buttons: Download QR + Copy link */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDownloadQr}
                      className="gap-2 text-muted hover:text-foreground w-full sm:w-auto min-h-[44px] sm:min-h-0"
                    >
                      <Download className="h-4 w-4" />
                      <span>{tDetail("downloadQr")}</span>
                    </Button>
                    {publicUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyLink}
                        className="gap-2 text-muted hover:text-foreground w-full sm:w-auto min-h-[44px] sm:min-h-0"
                      >
                        <Copy className="h-4 w-4" />
                        <span>{tDetail("copyLink")}</span>
                      </Button>
                    )}
                  </div>

                  {/* Regenerate link button */}
                  <div className="pt-2 border-t border-border/40 flex justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsRegenerateDialogOpen(true)}
                      className="gap-1.5 text-danger/80 hover:text-danger hover:bg-danger/10 w-full sm:w-auto min-h-[44px] sm:min-h-0 text-xs"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>{tDetail("regenerateLink")}</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit Product Modal (Full-screen Sheet on mobile, Dialog on desktop) */}
      {product && (
        <ProductFormModal
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          storeId={product.store_id}
          initialProduct={initialProductData}
          onSuccess={() => {
            setIsEditDialogOpen(false);
            mutate();
          }}
          onCancel={() => setIsEditDialogOpen(false)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2 text-danger mb-1 text-start">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-base">
                {tDetail("deleteConfirmTitle")}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-start">
              {tDetail("deleteConfirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleDelete}
              isLoading={isDeleting}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
            >
              {tDetail("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Link Confirmation Dialog */}
      <Dialog
        open={isRegenerateDialogOpen}
        onOpenChange={setIsRegenerateDialogOpen}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2 text-warning mb-1 text-start">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-base">
                {tDetail("regenerateConfirmTitle")}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-start leading-relaxed">
              {tDetail("regenerateConfirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsRegenerateDialogOpen(false)}
              disabled={isRegenerating}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleRegenerateLink}
              isLoading={isRegenerating}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
            >
              {tDetail("regenerateConfirmAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
