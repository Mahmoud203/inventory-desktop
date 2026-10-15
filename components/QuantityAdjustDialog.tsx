"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { getUser } from "@/lib/auth/local";
import { adjustQuantity } from "@/lib/data/products";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MinusCircle, PlusCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QuantityAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: string;
    name: string;
    quantity: number;
  };
  type: "withdraw" | "add";
  onSuccess?: () => void;
}

export function QuantityAdjustDialog({
  open,
  onOpenChange,
  product,
  type,
  onSuccess,
}: QuantityAdjustDialogProps) {
  const t = useTranslations("quantity");
  const tCommon = useTranslations("common");

  const [unitName, setUnitName] = React.useState("");
  const [quantityStr, setQuantityStr] = React.useState("");
  const [note, setNote] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [unitNameError, setUnitNameError] = React.useState<string | null>(null);

  const handleClose = () => {
    setUnitName("");
    setQuantityStr("");
    setNote("");
    setUnitNameError(null);
    setIsSubmitting(false);
    onOpenChange(false);
  };

  const parsedQty = parseInt(quantityStr, 10);
  const isValidNumber = !isNaN(parsedQty) && parsedQty > 0;
  const isOverLimit = type === "withdraw" && isValidNumber && parsedQty > product.quantity;
  const remainingAfter = isValidNumber ? product.quantity - parsedQty : product.quantity;

  const isFormValid =
    unitName.trim().length > 0 &&
    isValidNumber &&
    !isOverLimit &&
    !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!unitName.trim()) {
      setUnitNameError(t("unitName") + " *");
      return;
    }

    if (!isValidNumber) {
      return;
    }

    if (isOverLimit) {
      return;
    }

    setIsSubmitting(true);
    setUnitNameError(null);

    try {
      const {
        data: { user },
      } = await getUser();

      if (!user) {
        toast.error("Unauthorized");
        return;
      }

      const result = await adjustQuantity(product.id, user.id, {
        type,
        unitName: unitName.trim(),
        quantity: parsedQty,
        note: note.trim() || null,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(type === "withdraw" ? t("successWithdraw") : t("successAdd"));
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error("Failed to adjust quantity:", err);
      toast.error(err instanceof Error ? err.message : tCommon("retry"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isWithdraw = type === "withdraw";

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <div className="flex items-center gap-2 text-start">
            {isWithdraw ? (
              <div className="p-2 rounded-full bg-danger/10 text-danger shrink-0">
                <MinusCircle className="h-5 w-5" />
              </div>
            ) : (
              <div className="p-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <PlusCircle className="h-5 w-5" />
              </div>
            )}
            <div>
              <DialogTitle className="text-base sm:text-lg">
                {isWithdraw ? t("withdraw") : t("add")}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted">
                {product.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Current Quantity Badge */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-surface-raised border border-border/80 text-sm">
          <span className="text-muted">{t("label")}</span>
          <span className="font-semibold text-foreground text-base">
            {product.quantity.toLocaleString()}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Field 1: Unit Name */}
          <div className="space-y-1.5 text-start">
            <Label htmlFor="unit-name" className="text-xs font-medium">
              {t("unitName")} <span className="text-danger">*</span>
            </Label>
            <Input
              id="unit-name"
              placeholder={t("unitName")}
              value={unitName}
              onChange={(e) => {
                setUnitName(e.target.value);
                if (unitNameError) setUnitNameError(null);
              }}
              disabled={isSubmitting}
              autoFocus
              className="text-start"
            />
            {unitNameError && (
              <p className="text-xs text-danger">{unitNameError}</p>
            )}
          </div>

          {/* Field 2: Quantity */}
          <div className="space-y-1.5 text-start">
            <Label htmlFor="adjust-quantity" className="text-xs font-medium">
              {t("quantityLabel")} <span className="text-danger">*</span>
            </Label>
            <Input
              id="adjust-quantity"
              type="number"
              min="1"
              step="1"
              placeholder="1"
              value={quantityStr}
              onChange={(e) => setQuantityStr(e.target.value)}
              disabled={isSubmitting}
              className={cn("text-start", isOverLimit && "border-danger focus-visible:ring-danger")}
            />

            {/* Withdraw Live Hint & Limit Validation */}
            {isWithdraw && (
              <div className="pt-1">
                {isOverLimit ? (
                  <div className="flex items-center gap-1.5 text-xs text-danger font-medium">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{t("insufficient")}</span>
                  </div>
                ) : isValidNumber ? (
                  <p className="text-xs text-muted">
                    {t("remaining")}:{" "}
                    <span className="font-medium text-foreground">
                      {remainingAfter.toLocaleString()}
                    </span>
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {/* Field 3: Note (Optional) */}
          <div className="space-y-1.5 text-start">
            <Label htmlFor="adjust-note" className="text-xs font-medium">
              {t("note")}
            </Label>
            <Textarea
              id="adjust-note"
              rows={2}
              placeholder={t("note")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isSubmitting}
              className="text-start text-xs sm:text-sm resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={isSubmitting}
              className="min-h-[44px] sm:min-h-0"
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!isFormValid}
              isLoading={isSubmitting}
              className={cn(
                "min-h-[44px] sm:min-h-0",
                isWithdraw
                  ? "bg-danger text-danger-foreground hover:bg-danger-hover"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              )}
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
