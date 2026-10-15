"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  FileSpreadsheet,
  Search,
  Calendar,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  MinusCircle,
  PlusCircle,
  Package,
  Layers,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Link, useRouter } from "@/i18n/routing";
import { getSession, getUser } from "@/lib/auth/local";
import {
  getSummaryByProduct,
  type ProductSummary,
} from "@/lib/data/transactions";
import { TopNav } from "@/components/TopNav";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function getTodayStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDaysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type SortField = "name" | "withdrawn" | "added" | "quantity";
type SortOrder = "asc" | "desc";

export default function ReportsPage() {
  const t = useTranslations("reports");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tQuantity = useTranslations("quantity");

  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const router = useRouter();

  // Filters State
  const [fromDate, setFromDate] = React.useState<string>(getDaysAgoStr(7));
  const [toDate, setToDate] = React.useState<string>(getTodayStr());
  const [filterType, setFilterType] = React.useState<"all" | "withdraw" | "add">("all");

  // Data State
  const [summaries, setSummaries] = React.useState<ProductSummary[] | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [hasSearched, setHasSearched] = React.useState<boolean>(false);

  // Sorting and Expansion
  const [sortField, setSortField] = React.useState<SortField>("name");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("asc");
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

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

  // Load initial search on mount
  React.useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    setIsLoading(true);
    setHasSearched(true);
    try {
      const {
        data: { user },
      } = await getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const data = await getSummaryByProduct(user.id, fromDate, toDate, filterType);
      setSummaries(data);
    } catch (err) {
      console.error("Failed to load report data:", err);
      toast.error(tCommon("retry"));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedSummaries = React.useMemo(() => {
    if (!summaries) return [];
    return [...summaries].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.product_name.localeCompare(b.product_name, locale);
      } else if (sortField === "withdrawn") {
        cmp = a.total_withdrawn - b.total_withdrawn;
      } else if (sortField === "added") {
        cmp = a.total_added - b.total_added;
      } else if (sortField === "quantity") {
        cmp = a.current_quantity - b.current_quantity;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [summaries, sortField, sortOrder, locale]);

  // Metrics Calculations
  const totalItems = summaries?.length ?? 0;
  const totalWithdrawn = summaries?.reduce((sum, s) => sum + s.total_withdrawn, 0) ?? 0;
  const totalAdded = summaries?.reduce((sum, s) => sum + s.total_added, 0) ?? 0;

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

  // Excel Export
  const handleExportExcel = () => {
    if (!summaries || summaries.length === 0) {
      toast.error(t("noResults"));
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Summary
      const isAr = locale === "ar";
      const summaryRows = sortedSummaries.map((s) => ({
        [isAr ? "اسم الصنف" : "Item Name"]: s.product_name,
        [isAr ? "إجمالي المصروف" : "Total Withdrawn"]: s.total_withdrawn,
        [isAr ? "إجمالي المضاف" : "Total Added"]: s.total_added,
        [isAr ? "الكمية المتبقية" : "Remaining Quantity"]: s.current_quantity,
      }));

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      if (isAr) {
        wsSummary["!views"] = [{ RTL: true }];
      }
      XLSX.utils.book_append_sheet(wb, wsSummary, t("summary"));

      // Sheet 2: Details
      const detailsRows: Record<string, string | number>[] = [];
      for (const s of sortedSummaries) {
        for (const tx of s.transactions) {
          detailsRows.push({
            [isAr ? "اسم الصنف" : "Item Name"]: s.product_name,
            [isAr ? "اسم الوحدة" : "Unit Name"]: tx.unit_name,
            [isAr ? "الكمية" : "Quantity"]:
              tx.type === "withdraw" ? -tx.quantity : tx.quantity,
            [isAr ? "النوع" : "Type"]:
              tx.type === "withdraw"
                ? (isAr ? "صرف" : "Withdraw")
                : (isAr ? "إضافة" : "Add"),
            [isAr ? "التاريخ" : "Date"]: formatDateTime(tx.created_at),
            [isAr ? "ملاحظة" : "Note"]: tx.note || "",
          });
        }
      }

      const wsDetails = XLSX.utils.json_to_sheet(detailsRows);
      if (isAr) {
        wsDetails["!views"] = [{ RTL: true }];
      }
      XLSX.utils.book_append_sheet(wb, wsDetails, t("details"));

      const filename = `inventory-report-${fromDate}-to-${toDate}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success(t("exportExcel"));
    } catch (err) {
      console.error("Excel export error:", err);
      toast.error("Failed to generate Excel file");
    }
  };

  return (
    <div className="min-h-screen bg-bg text-foreground">
      <TopNav currentLocale={locale} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-4 text-start">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <FileSpreadsheet className="h-7 w-7 text-accent" />
              <span>{t("title")}</span>
            </h1>
          </div>

          {summaries && summaries.length > 0 && (
            <Button
              type="button"
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-medium shadow-soft min-h-[44px] sm:min-h-10 shrink-0"
            >
              <Download className="h-4 w-4" />
              <span>{t("exportExcel")}</span>
            </Button>
          )}
        </div>

        {/* 1. Filters Card */}
        <div className="rounded-xl border border-border bg-surface p-4 sm:p-6 shadow-soft space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {/* From Date */}
            <div className="space-y-1.5 text-start">
              <Label htmlFor="from-date" className="text-xs font-medium text-muted">
                {t("fromDate")}
              </Label>
              <div className="relative">
                <Input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="ps-9 text-xs sm:text-sm"
                />
                <Calendar className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
              </div>
            </div>

            {/* To Date */}
            <div className="space-y-1.5 text-start">
              <Label htmlFor="to-date" className="text-xs font-medium text-muted">
                {t("toDate")}
              </Label>
              <div className="relative">
                <Input
                  id="to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="ps-9 text-xs sm:text-sm"
                />
                <Calendar className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
              </div>
            </div>

            {/* Filter Type */}
            <div className="space-y-1.5 text-start">
              <Label className="text-xs font-medium text-muted">
                {t("type")}
              </Label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as "all" | "withdraw" | "add")}
                className="w-full h-11 sm:h-10 px-3 rounded-md border border-border bg-surface text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">{t("allTypes")}</option>
                <option value="withdraw">{t("withdrawOnly")}</option>
                <option value="add">{t("addOnly")}</option>
              </select>
            </div>

            {/* Search Button */}
            <div className="pt-2 sm:pt-0">
              <Button
                type="button"
                onClick={handleSearch}
                isLoading={isLoading}
                className="w-full min-h-[44px] sm:min-h-10 gap-2 font-medium"
              >
                <Search className="h-4 w-4" />
                <span>{t("search")}</span>
              </Button>
            </div>
          </div>

          {/* Quick Date Range Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
            <span className="text-xs text-muted me-1">{tCommon("actions")}:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFromDate(getDaysAgoStr(7));
                setToDate(getTodayStr());
              }}
              className="text-xs h-8 px-2.5 min-h-0"
            >
              {t("last7days")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFromDate(getDaysAgoStr(30));
                setToDate(getTodayStr());
              }}
              className="text-xs h-8 px-2.5 min-h-0"
            >
              {t("last30days")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFromDate(getTodayStr());
                setToDate(getTodayStr());
              }}
              className="text-xs h-8 px-2.5 min-h-0"
            >
              {t("today")}
            </Button>
          </div>
        </div>

        {/* 2. Summary Metrics Bar */}
        {hasSearched && summaries && summaries.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-surface p-4 shadow-soft flex items-center gap-3 text-start">
              <div className="p-2.5 rounded-lg bg-accent/10 text-accent shrink-0">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted font-medium">{t("totalItems")}</p>
                <p className="text-xl sm:text-2xl font-bold text-foreground">
                  {totalItems.toLocaleString(locale)}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 shadow-soft flex items-center gap-3 text-start">
              <div className="p-2.5 rounded-lg bg-danger/10 text-danger shrink-0">
                <MinusCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted font-medium">{t("totalWithdrawn")}</p>
                <p className="text-xl sm:text-2xl font-bold text-danger">
                  {totalWithdrawn.toLocaleString(locale)}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 shadow-soft flex items-center gap-3 text-start">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <PlusCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted font-medium">{t("totalAdded")}</p>
                <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {totalAdded.toLocaleString(locale)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 3. Results Table */}
        <div className="rounded-xl border border-border bg-surface shadow-soft overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          ) : !summaries || summaries.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Layers className="h-10 w-10 text-muted mx-auto opacity-40" />
              <p className="text-sm text-muted font-medium">{t("noResults")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm">
                <thead className="bg-surface-raised border-b border-border/80 text-muted text-xs uppercase font-medium">
                  <tr>
                    <th
                      onClick={() => handleSort("name")}
                      className="py-3 px-4 text-start cursor-pointer hover:text-foreground select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{t("itemName")}</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("withdrawn")}
                      className="py-3 px-4 text-end cursor-pointer hover:text-foreground select-none"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>{t("totalWithdrawn")}</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("added")}
                      className="py-3 px-4 text-end cursor-pointer hover:text-foreground select-none"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>{t("totalAdded")}</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("quantity")}
                      className="py-3 px-4 text-end cursor-pointer hover:text-foreground select-none"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>{t("remaining")}</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-center w-24">
                      {t("transactions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {sortedSummaries.map((s) => {
                    const isExpanded = expandedIds.has(s.product_id);
                    return (
                      <React.Fragment key={s.product_id}>
                        {/* Parent Product Row */}
                        <tr
                          onClick={() => toggleExpand(s.product_id)}
                          className={cn(
                            "cursor-pointer transition-colors hover:bg-surface-raised/60",
                            isExpanded && "bg-surface-raised/40"
                          )}
                        >
                          <td className="py-3.5 px-4 font-semibold text-foreground">
                            <div className="flex flex-col text-start">
                              <Link
                                href={`/product/${s.product_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:underline text-foreground hover:text-accent inline-block font-semibold"
                              >
                                {s.product_name}
                              </Link>
                              {(s.store_name || s.section_name) && (
                                <span className="text-[11px] text-muted font-normal">
                                  {s.store_name} {s.section_name ? `• ${s.section_name}` : ""}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-end font-semibold text-danger tabular-nums">
                            {s.total_withdrawn > 0
                              ? `-${s.total_withdrawn.toLocaleString(locale)}`
                              : "0"}
                          </td>

                          <td className="py-3.5 px-4 text-end font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {s.total_added > 0
                              ? `+${s.total_added.toLocaleString(locale)}`
                              : "0"}
                          </td>

                          <td className="py-3.5 px-4 text-end font-semibold text-foreground tabular-nums">
                            {s.current_quantity.toLocaleString(locale)}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted hover:text-foreground"
                              aria-label={t("transactions")}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </td>
                        </tr>

                        {/* Expandable Child Row: Transaction Details */}
                        {isExpanded && (
                          <tr className="bg-surface-raised/20">
                            <td colSpan={5} className="p-4 sm:p-5">
                              <div className="rounded-lg border border-border/80 bg-surface overflow-hidden shadow-inner">
                                <div className="px-4 py-2.5 border-b border-border/60 bg-surface-raised text-xs font-semibold text-muted flex items-center justify-between">
                                  <span>{t("transactions")} ({s.transactions.length})</span>
                                </div>
                                <div className="divide-y divide-border/40">
                                  {s.transactions.map((tx) => {
                                    const isWithdraw = tx.type === "withdraw";
                                    return (
                                      <div
                                        key={tx.id}
                                        className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-start hover:bg-surface-raised/40 transition-colors"
                                      >
                                        <div className="flex items-start gap-3">
                                          <div
                                            className={cn(
                                              "p-1.5 rounded-full shrink-0 mt-0.5",
                                              isWithdraw
                                                ? "bg-danger/10 text-danger"
                                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                            )}
                                          >
                                            {isWithdraw ? (
                                              <MinusCircle className="h-3.5 w-3.5" />
                                            ) : (
                                              <PlusCircle className="h-3.5 w-3.5" />
                                            )}
                                          </div>
                                          <div>
                                            <p className="text-sm font-semibold text-foreground">
                                              {tx.unit_name}
                                            </p>
                                            <p className="text-xs text-muted">
                                              {formatDateTime(tx.created_at)}
                                            </p>
                                            {tx.note && (
                                              <p className="text-xs text-muted-foreground italic pt-0.5">
                                                {tx.note}
                                              </p>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-3 sm:text-end shrink-0 ps-8 sm:ps-0">
                                          <span
                                            className={cn(
                                              "text-xs px-2 py-0.5 rounded-full font-medium",
                                              isWithdraw
                                                ? "bg-danger/10 text-danger"
                                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                            )}
                                          >
                                            {isWithdraw ? tQuantity("withdraw") : tQuantity("add")}
                                          </span>
                                          <span
                                            className={cn(
                                              "text-sm font-semibold tabular-nums",
                                              isWithdraw
                                                ? "text-danger"
                                                : "text-emerald-600 dark:text-emerald-400"
                                            )}
                                          >
                                            {isWithdraw ? `-${tx.quantity}` : `+${tx.quantity}`}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
