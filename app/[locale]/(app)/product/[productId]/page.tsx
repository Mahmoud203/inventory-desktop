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
  MinusCircle,
  PlusCircle,
  Minus,
  Plus,
  History,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { getSession, getUser } from "@/lib/auth/local";
import {
  get as getProduct,
  remove as removeProduct,
} from "@/lib/data/products";
import { listByProduct, type TransactionRecord } from "@/lib/data/transactions";
import { record as recordRecentlyViewed } from "@/lib/data/recently-viewed";
import { generateQrDataUrl, formatProductQrPayload } from "@/lib/qrcode";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
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
import { QuantityAdjustDialog } from "@/components/QuantityAdjustDialog";
import type { InitialProductData } from "@/components/ProductForm";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProductDetailData {
  id: string;
  store_id: string;
  name: string;
  notes: string | null;
  photo_url: string | null;
  photo_path?: string | null;
  has_qr: boolean;
  qr_data: string | null;
  quantity: number;
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
  const tQuantity = useTranslations("quantity");
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

  // Quantity adjust modal state
  const [adjustType, setAdjustType] = React.useState<"withdraw" | "add" | null>(null);
  const [showAllTransactions, setShowAllTransactions] = React.useState(false);

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

  // Fetch Product Transactions
  const fetchTransactions = async (): Promise<TransactionRecord[]> => {
    const {
      data: { user },
    } = await getUser();
    if (!user) return [];
    return listByProduct(productId, user.id);
  };

  const {
    data: transactions,
    mutate: mutateTransactions,
    isLoading: isTransactionsLoading,
  } = useSWR(
    productId ? `transactions-${productId}` : null,
    fetchTransactions,
    { revalidateOnFocus: true }
  );

  // Handle unauthorized error
  React.useEffect(() => {
    if (productError?.message === "UNAUTHORIZED") {
      router.replace("/login");
    }
  }, [productError, router]);

  // Build plain-text QR payload matching phone card format
  const qrPayloadText = React.useMemo(() => {
    if (!product) return "";
    return formatProductQrPayload({
      name: product.name,
      notes: product.notes,
      quantity: product.quantity,
      storeName: product.stores?.name,
      sectionName: product.stores?.sections?.name,
    });
  }, [product]);

  // Generate QR Code data URL when product loads with has_qr
  React.useEffect(() => {
    let isCancelled = false;

    if (product?.has_qr && qrPayloadText) {
      generateQrDataUrl(qrPayloadText)
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
  }, [product?.has_qr, qrPayloadText]);

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

  const handleCopyDetails = async () => {
    if (!qrPayloadText) return;
    try {
      await navigator.clipboard.writeText(qrPayloadText);
      toast.success(tDetail("detailsCopied"));
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = qrPayloadText;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        toast.success(tDetail("detailsCopied"));
      } catch {
        toast.error("Failed to copy details");
      }
    }
  };

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

  const formatDateTime = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(isoString));
    } catch {
      return isoString;
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

  const currentQuantity = product?.quantity ?? 0;
  const isOutOfStock = currentQuantity === 0;
  const isLowStock = currentQuantity > 0 && currentQuantity <= 5;

  const displayedTransactions = transactions
    ? showAllTransactions
      ? transactions
      : transactions.slice(0, 20)
    : [];

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
          <div className="space-y-8">
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

            {/* 3. Prominent QUANTITY Block */}
            <div className="rounded-xl border border-border bg-surface p-6 shadow-soft space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-start">
                <div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "text-4xl sm:text-5xl font-semibold tracking-tight",
                        (isOutOfStock || isLowStock) ? "text-danger" : "text-foreground"
                      )}
                    >
                      {currentQuantity.toLocaleString(locale)}
                    </span>
                    {(isOutOfStock || isLowStock) && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-danger/10 text-danger border border-danger/20">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        {isOutOfStock ? tQuantity("outOfStock") : tQuantity("lowStock")}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted mt-1 font-medium">
                    {tQuantity("label")}
                  </p>
                </div>

                {/* Withdraw & Add Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
                  <Button
                    type="button"
                    onClick={() => setAdjustType("withdraw")}
                    disabled={currentQuantity <= 0}
                    className="bg-danger text-danger-foreground hover:bg-danger-hover min-h-[44px] sm:min-h-10 px-5 gap-2 font-medium shadow-soft"
                  >
                    <Minus className="h-4 w-4" />
                    <span>{tQuantity("withdraw")}</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={() => setAdjustType("add")}
                    className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white min-h-[44px] sm:min-h-10 px-5 gap-2 font-medium shadow-soft"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{tQuantity("add")}</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* 4. Transaction History (سجل الحركات) */}
            <div className="rounded-xl border border-border bg-surface p-6 shadow-soft space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-2 text-start">
                  <History className="h-4 w-4 text-muted" />
                  <h2 className="text-base font-semibold text-foreground">
                    {tQuantity("history")}
                  </h2>
                </div>
                {transactions && transactions.length > 0 && (
                  <span className="text-xs text-muted">
                    {transactions.length.toLocaleString(locale)}
                  </span>
                )}
              </div>

              {/* Transactions List */}
              {isTransactionsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-14 w-full rounded-lg" />
                  <Skeleton className="h-14 w-full rounded-lg" />
                  <Skeleton className="h-14 w-full rounded-lg" />
                </div>
              ) : !transactions || transactions.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted">
                  {tQuantity("noTransactions")}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="divide-y divide-border/40">
                    {displayedTransactions.map((tx) => {
                      const isTxWithdraw = tx.type === "withdraw";
                      return (
                        <div
                          key={tx.id}
                          className="py-3 flex items-start justify-between gap-3 text-start hover:bg-surface-raised/40 px-2 rounded-md transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "p-2 rounded-full shrink-0 mt-0.5",
                                isTxWithdraw
                                  ? "bg-danger/10 text-danger"
                                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              )}
                            >
                              {isTxWithdraw ? (
                                <MinusCircle className="h-4 w-4" />
                              ) : (
                                <PlusCircle className="h-4 w-4" />
                              )}
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-sm font-semibold text-foreground">
                                {tx.unit_name}
                              </p>
                              <p className="text-xs text-muted">
                                {formatDateTime(tx.created_at)}
                              </p>
                              {tx.note && (
                                <p className="text-xs text-muted-foreground pt-0.5 italic">
                                  {tx.note}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="text-end shrink-0">
                            <span
                              className={cn(
                                "text-sm font-semibold tabular-nums",
                                isTxWithdraw ? "text-danger" : "text-emerald-600 dark:text-emerald-400"
                              )}
                            >
                              {isTxWithdraw ? `-${tx.quantity}` : `+${tx.quantity}`}
                            </span>
                            <p className="text-[11px] text-muted">
                              {tx.quantity_after} {tQuantity("remaining")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Show all / Show less toggle button if > 20 */}
                  {transactions.length > 20 && (
                    <div className="pt-2 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllTransactions(!showAllTransactions)}
                        className="gap-1.5 text-xs text-muted hover:text-foreground"
                      >
                        {showAllTransactions ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5" />
                            <span>{tCommon("close")}</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5" />
                            <span>
                              {tQuantity("showAll")} ({transactions.length})
                            </span>
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 5. Notes Section */}
            <div className="space-y-2 text-start">
              <h2 className="text-xs uppercase font-semibold text-muted tracking-wider">
                {tDetail("notesHeading")}
              </h2>
              <div className="text-sm sm:text-base text-muted max-w-prose leading-relaxed whitespace-pre-line">
                {product.notes || tDetail("noNotes")}
              </div>
            </div>

            {/* 6. QR Code Card */}
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

                  {/* Caption & Muted Hint directly below the QR */}
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {tDetail("qrCaption")}
                    </p>
                    <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
                      {tDetail("qrHint")}
                    </p>
                  </div>

                  {/* Action buttons: Copy details, Preview, Download QR */}
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyDetails}
                      className="gap-2 text-xs font-medium text-muted-foreground hover:text-foreground min-h-[38px] sm:min-h-9 transition-colors duration-150"
                    >
                      <Copy className="h-4 w-4" strokeWidth={1.5} />
                      <span>{tDetail("copyDetails")}</span>
                    </Button>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-xs font-medium text-muted-foreground hover:text-foreground min-h-[38px] sm:min-h-9 transition-colors duration-150"
                        >
                          <Eye className="h-4 w-4" strokeWidth={1.5} />
                          <span>{tDetail("previewQr")}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="center"
                        sideOffset={8}
                        dir="rtl"
                        className="w-80 sm:w-96 p-4 text-start space-y-2.5 shadow-xl bg-surface/98 border border-border"
                      >
                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                            {tDetail("qrContentsTitle")}
                          </h4>
                        </div>
                        <div className="rounded-lg bg-surface-raised border border-border/60 p-3 overflow-hidden">
                          <pre
                            dir="rtl"
                            className="font-mono text-xs text-foreground/90 whitespace-pre-wrap break-words leading-relaxed select-all"
                          >
                            {qrPayloadText}
                          </pre>
                        </div>
                      </PopoverContent>
                    </Popover>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDownloadQr}
                      className="gap-2 text-xs font-medium text-muted hover:text-foreground min-h-[38px] sm:min-h-9 transition-colors duration-150"
                    >
                      <Download className="h-4 w-4" strokeWidth={1.5} />
                      <span>{tDetail("downloadQr")}</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Quantity Adjust Modal (Withdraw / Add) */}
      {product && adjustType && (
        <QuantityAdjustDialog
          open={adjustType !== null}
          onOpenChange={(open) => !open && setAdjustType(null)}
          product={{
            id: product.id,
            name: product.name,
            quantity: product.quantity,
          }}
          type={adjustType}
          onSuccess={() => {
            mutate();
            mutateTransactions();
          }}
        />
      )}

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
