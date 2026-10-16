"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { getUser } from "@/lib/auth/local";
import {
  create as createProduct,
  update as updateProduct,
} from "@/lib/data/products";
import {
  UploadCloud,
  X,
  QrCode,
  AlertTriangle,
} from "lucide-react";
import { formatProductQrPayload } from "@/lib/qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface InitialProductData {
  id: string;
  name: string;
  notes: string | null;
  photo_url: string | null;
  photo_path?: string | null;
  has_qr: boolean;
  qr_data: string | null;
  share_token?: string | null;
}

interface ProductFormProps {
  storeId: string;
  initialProduct?: InitialProductData | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ProductForm({
  storeId,
  initialProduct,
  onSuccess,
  onCancel,
}: ProductFormProps) {
  const t = useTranslations("productForm");
  const tQuantity = useTranslations("quantity");
  const tCommon = useTranslations("common");
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Form Fields initialized from initialProduct if editing
  const [name, setName] = React.useState(initialProduct?.name || "");
  const [notes, setNotes] = React.useState(initialProduct?.notes || "");
  const [hasQr, setHasQr] = React.useState(initialProduct?.has_qr ?? false);
  const [initialQuantity, setInitialQuantity] = React.useState("0");

  // Photo Upload State
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(
    initialProduct?.photo_url || null
  );
  const [isPhotoRemoved, setIsPhotoRemoved] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);

  // Validation & Loading
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // Confirm Discard Dialog
  const [showDiscardConfirm, setShowDiscardConfirm] = React.useState(false);

  const MAX_NOTES_LENGTH = 500;

  // Track if form is modified compared to initial state
  const isDirty = React.useMemo(() => {
    if (initialProduct) {
      return (
        name !== initialProduct.name ||
        notes !== (initialProduct.notes || "") ||
        hasQr !== initialProduct.has_qr ||
        photoFile !== null ||
        isPhotoRemoved
      );
    }
    return (
      name.trim().length > 0 ||
      notes.trim().length > 0 ||
      hasQr ||
      photoFile !== null ||
      parseInt(initialQuantity, 10) > 0
    );
  }, [name, notes, hasQr, photoFile, isPhotoRemoved, initialProduct, initialQuantity]);

  // Clean up object URL preview on unmount
  React.useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("photoFormats"));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("photoFormats"));
      return;
    }

    setPhotoFile(file);
    setIsPhotoRemoved(false);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRemovePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoFile(null);
    if (photoPreview && photoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
    setIsPhotoRemoved(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCancelClick = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onCancel();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setNameError(t("nameRequired"));
      return;
    }

    setNameError(null);
    setIsSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await getUser();

      if (userError || !user) {
        throw new Error("UNAUTHORIZED");
      }

      let finalPhotoPath: string | null =
        initialProduct?.photo_path || initialProduct?.photo_url || null;

      if (isPhotoRemoved) {
        finalPhotoPath = null;
      }

      // Upload photo if new file selected
      if (photoFile) {
        setUploadProgress(40);
        const formData = new FormData();
        formData.append("file", photoFile);

        const res = await fetch("/api/photos/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to upload photo");
        }

        setUploadProgress(85);
        const { path } = await res.json();
        finalPhotoPath = path;
      }

      setUploadProgress(95);

      if (initialProduct) {
        // UPDATE existing product
        let qrData: string | null = null;
        if (hasQr) {
          qrData = formatProductQrPayload({
            name: name.trim(),
            notes: notes.trim() || null,
          });
        }

        await updateProduct(
          initialProduct.id,
          {
            name: name.trim(),
            notes: notes.trim() || null,
            photo_path: finalPhotoPath,
            has_qr: hasQr,
            qr_data: qrData,
          },
          user.id
        );

        toast.success(t("updateSuccess"));
      } else {
        // CREATE new product
        const productId = crypto.randomUUID();
        const parsedInitialQty = Math.max(0, parseInt(initialQuantity, 10) || 0);
        let qrData: string | null = null;
        if (hasQr) {
          qrData = formatProductQrPayload({
            name: name.trim(),
            notes: notes.trim() || null,
            quantity: parsedInitialQty,
          });
        }

        await createProduct(
          {
            id: productId,
            store_id: storeId,
            name: name.trim(),
            notes: notes.trim() || null,
            photo_path: finalPhotoPath,
            has_qr: hasQr,
            qr_data: qrData,
            quantity: parsedInitialQty,
            initial_unit_name: tQuantity("openingBalance"),
          },
          user.id
        );

        toast.success(t("createSuccess"));
      }

      onSuccess();
    } catch (err: unknown) {
      console.error("Product form error:", err);
      const msg = err instanceof Error ? err.message : t("createError");
      toast.error(msg);
    } finally {
      setIsSaving(false);
      setUploadProgress(null);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 text-start">
        {/* Header */}
        <div className="space-y-1 border-b border-border/40 pb-4">
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            {initialProduct ? t("editTitle") : t("title")}
          </h2>
          <p className="text-xs text-muted leading-relaxed">
            {initialProduct ? t("editSubtitle") : t("subtitle")}
          </p>
        </div>

        {/* 1. Photo Dropzone Field */}
        <div className="space-y-2">
          <Label>{t("photoLabel")}</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
              }
            }}
            disabled={isSaving}
          />

          {photoPreview ? (
            <div className="relative group overflow-hidden rounded-xl border border-border bg-surface h-48 w-full flex items-center justify-center shadow-soft">
              <img
                src={photoPreview}
                alt="Product preview"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={handleRemovePhoto}
                  className="gap-1.5"
                >
                  <X className="h-4 w-4" />
                  {t("removePhoto")}
                </Button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-border bg-surface/50 cursor-pointer transition-all duration-150 ease-out text-center",
                "hover:border-accent hover:bg-surface",
                isDragOver && "border-accent bg-accent/5 ring-4 ring-accent/10"
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted mb-2 shadow-soft">
                <UploadCloud className="h-5 w-5" />
              </div>
              <p className="text-xs font-medium text-foreground">
                {isDragOver ? t("photoDropzoneActive") : t("photoDropzone")}
              </p>
              <p className="text-[11px] text-muted mt-1">
                {t("photoFormats")}
              </p>
            </div>
          )}

          {/* Uploading progress bar */}
          {uploadProgress !== null && (
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px] text-muted">
                <span>{t("photoUploading")}</span>
                <span>
                  {new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
                    style: "percent",
                  }).format(uploadProgress / 100)}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="h-px bg-border/40" />

        {/* 2. Product Name Field */}
        <div className="space-y-1.5">
          <Label htmlFor="product-name">{t("nameLabel")} *</Label>
          <Input
            id="product-name"
            placeholder={t("namePlaceholder")}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError(null);
            }}
            error={!!nameError}
            disabled={isSaving}
          />
          {nameError && (
            <p className="text-xs text-danger text-start">{nameError}</p>
          )}
        </div>

        {/* Initial Quantity Field (only shown when creating a new product) */}
        {!initialProduct && (
          <div className="space-y-1.5 text-start">
            <Label htmlFor="initial-quantity">{tQuantity("initialQuantity")}</Label>
            <Input
              id="initial-quantity"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={initialQuantity}
              onChange={(e) => setInitialQuantity(e.target.value)}
              disabled={isSaving}
            />
          </div>
        )}

        {/* 3. Notes Textarea with Character Counter */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="product-notes">{t("notesLabel")}</Label>
            <span className="text-[11px] text-muted">
              {t("charCount", {
                current: new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US").format(notes.length),
                max: new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US").format(MAX_NOTES_LENGTH),
              })}
            </span>
          </div>
          <Textarea
            id="product-notes"
            rows={3}
            maxLength={MAX_NOTES_LENGTH}
            placeholder={t("notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSaving}
          />
        </div>

        <div className="h-px bg-border/40" />

        {/* 4. Generate QR Code Option */}
        <div
          onClick={() => setHasQr(!hasQr)}
          className={cn(
            "flex items-start gap-3 p-3.5 rounded-lg border border-border/60 bg-surface/40 hover:bg-surface cursor-pointer transition-colors duration-150 select-none",
            hasQr && "border-accent/40 bg-accent/5"
          )}
        >
          <Checkbox
            id="generate-qr"
            checked={hasQr}
            onCheckedChange={(checked) => setHasQr(!!checked)}
            className="mt-0.5"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="space-y-0.5 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <QrCode className="h-3.5 w-3.5 text-accent" />
              <span>{t("generateQrLabel")}</span>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              {t("generateQrDescription")}
            </p>
          </div>
        </div>

        {/* 5. Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-4 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancelClick}
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
            className="w-full sm:w-auto min-h-[44px] sm:min-h-0 font-medium"
          >
            {initialProduct ? t("update") : t("save")}
          </Button>
        </div>
      </form>

      {/* Discard Confirmation Dialog */}
      <Dialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2 text-warning mb-1">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-base">
                {t("discardTitle")}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              {t("discardDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDiscardConfirm(false)}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
            >
              {t("discardCancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => {
                setShowDiscardConfirm(false);
                onCancel();
              }}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
            >
              {t("discardConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
