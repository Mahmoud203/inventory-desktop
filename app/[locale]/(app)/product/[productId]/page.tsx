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
} from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { getSession, getUser } from "@/lib/auth/local";
import {
  get as getProduct,
  remove as removeProduct,
} from "@/lib/data/products";
import { record as recordRecentlyViewed } from "@/lib/data/recently-viewed";
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
  photo_path?: string | null;
  has_qr: boolean;
  qr_data: string | null;
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

  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);

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

    const data = await getProduct(productId, user.id);
    if (!data) {
      throw new Error("Product not found");
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

  // Generate QR Code data URL when product loads with has_qr
  React.useEffect(() => {
    let isCancelled = false;

    if (product?.has_qr) {
      const targetPayload =
        product.qr_data ||
        JSON.stringify({
          v: 1,
          id: product.id,
          name: product.name,
          notes: product.notes || "",
        });

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
      setQrDataUrl(null);
    }

    return () => {
      isCancelled = true;
    };
  }, [
    product?.has_qr,
    product?.qr_data,
    product?.id,
    product?.name,
    product?.notes,
  ]);

  // Record Recently Viewed on Mount
  React.useEffect(() => {
    if (!productId) return;

    const recordRecently = async () => {
      try {
        const {
          data: { user },
        } = await getUser();
        if (!user) return;

        await recordRecentlyViewed(productId, user.id);

        // Mutate recently-viewed SWR key for instant bar updates
        globalMutate("recently-viewed");
      } catch (err) {
        console.error("Failed to update recently viewed:", err);
      }
    };

    recordRecently();
  }, [productId]);

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

  const handleDelete = async () => {
    if (!product) return;
    setIsDeleting(true);

    try {
      const {
        data: { user },
      } = await getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      await removeProduct(product.id, user.id);

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
        photo_path: product.photo_path,
        has_qr: product.has_qr,
        qr_data: product.qr_data,
      }
    : null;

  return (
    <div className="min-h-screen bg-bg text-foreground">
      <TopNav currentLocale={locale} />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Breadcrumb Navigation */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/sections">{tNav("sections")}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            {product?.stores?.sections && (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href={`/sections/${product.stores.section_id}`}>
                      {product.stores.sections.name}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            {product?.stores && (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link
                      href={`/sections/${product.stores.section_id}/${product.store_id}`}
                    >
                      {product.stores.name}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage>
                {isLoading ? (
                  <Skeleton className="h-4 w-24" />
                ) : (
                  product?.name || ""
                )}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="space-y-6">
            <Skeleton className="w-full aspect-[4/3] sm:aspect-[16/9] max-h-96 rounded-xl" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        )}

        {/* Product Content */}
        {!isLoading && product && (
          <div className="space-y-6">
            {/* 1. Large Photo Display */}
            {product.photo_url ? (
              <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] max-h-96 rounded-xl overflow-hidden border border-border bg-surface-raised shadow-soft">
                <img
                  src={product.photo_url}
                  alt={product.name}
                  className="w-full h-full object-contain sm:object-cover bg-neutral-900/10 dark:bg-neutral-950/40"
                />
              </div>
            ) : (
              <div className="w-full aspect-[4/3] sm:aspect-[16/9] max-h-72 rounded-xl border border-dashed border-border bg-surface flex flex-col items-center justify-center gap-2 text-muted">
                <ImageIcon className="h-10 w-10 opacity-30" />
                <span className="text-xs sm:text-sm">
                  {tDetail("noPhoto")}
                </span>
              </div>
            )}

            {/* 2. Title & Primary Actions */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-border/40 pb-6">
              <div className="space-y-1 text-start">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {product.name}
                </h1>
                <p className="text-xs sm:text-sm text-muted">
                  {product.stores?.name} • {product.stores?.sections?.name}
                </p>
              </div>

              {/* Action Buttons: Edit & Delete */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditDialogOpen(true)}
                  className="gap-2 flex-1 sm:flex-none min-h-[44px] sm:min-h-0"
                >
                  <Edit className="h-4 w-4" />
                  <span>{tDetail("edit")}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="gap-2 text-danger hover:text-danger hover:bg-danger/10 flex-1 sm:flex-none min-h-[44px] sm:min-h-0"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{tDetail("delete")}</span>
                </Button>
              </div>
            </div>

            {/* 3. Notes Section */}
            <div className="space-y-2 text-start">
              <h2 className="text-xs uppercase font-semibold text-muted tracking-wider">
                {tDetail("notesHeading")}
              </h2>
              <div className="text-sm sm:text-base text-muted max-w-prose leading-relaxed whitespace-pre-line">
                {product.notes || tDetail("noNotes")}
              </div>
            </div>

            {/* 4. QR Code Card (max-w-xs on mobile, max-w-md on desktop) */}
            {product.has_qr && (
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

                  {/* Action button: Download QR */}
                  <div className="flex items-center justify-center pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDownloadQr}
                      className="gap-2 text-muted hover:text-foreground w-full sm:w-auto min-h-[44px] sm:min-h-0"
                    >
                      <Download className="h-4 w-4" />
                      <span>{tDetail("downloadQr")}</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit Product Modal */}
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
            <DialogDescription className="text-xs text-start leading-relaxed">
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
    </div>
  );
}
