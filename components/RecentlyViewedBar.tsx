"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Clock, ImageIcon } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getSession } from "@/lib/auth/local";
import { list as listRecentlyViewed } from "@/lib/data/recently-viewed";
import { cn } from "@/lib/utils";

interface ProductRecord {
  id: string;
  name: string;
  photo_url: string | null;
}

interface RecentlyViewedItem {
  id: string;
  viewed_at: string;
  product: ProductRecord;
}

export function RecentlyViewedBar() {
  const t = useTranslations("recentlyViewed");

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollStart, setCanScrollStart] = React.useState(false);
  const [canScrollEnd, setCanScrollEnd] = React.useState(false);

  const fetchRecentlyViewed = async (): Promise<RecentlyViewedItem[]> => {
    const {
      data: { session },
    } = await getSession();
    if (!session?.user) {
      return [];
    }

    const rows = await listRecentlyViewed(session.user.id);
    const result: RecentlyViewedItem[] = [];
    const seenProductIds = new Set<string>();

    for (const row of rows) {
      const product = row.products;

      if (product && product.id && !seenProductIds.has(product.id)) {
        seenProductIds.add(product.id);
        result.push({
          id: row.id,
          viewed_at: row.viewed_at,
          product: {
            id: product.id,
            name: product.name,
            photo_url: product.photo_url,
          },
        });
      }
    }

    return result;
  };

  const { data: items } = useSWR<RecentlyViewedItem[]>(
    "recently-viewed",
    fetchRecentlyViewed,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  const updateScrollState = React.useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 2) {
      setCanScrollStart(false);
      setCanScrollEnd(false);
      return;
    }

    const isRtl = document.documentElement.dir === "rtl";
    let atStart = false;
    let atEnd = false;

    if (isRtl) {
      if (el.scrollLeft <= 0) {
        const scrollPos = Math.abs(el.scrollLeft);
        atStart = scrollPos <= 4;
        atEnd = scrollPos >= maxScroll - 4;
      } else {
        atStart = Math.abs(el.scrollLeft - maxScroll) <= 4;
        atEnd = el.scrollLeft <= 4;
      }
    } else {
      atStart = el.scrollLeft <= 4;
      atEnd = el.scrollLeft >= maxScroll - 4;
    }

    setCanScrollStart(!atStart);
    setCanScrollEnd(!atEnd);
  }, []);

  React.useEffect(() => {
    updateScrollState();
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleResize = () => updateScrollState();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [items, updateScrollState]);

  // Hide completely when list is empty
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <aside
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface/85 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.04)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.25)] transition-all duration-200 animate-in fade-in-50 slide-in-from-bottom-2 hide-on-short-screen"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      aria-label={t("title")}
    >
      <div className="mx-auto w-full max-w-[1200px] px-3 sm:px-6 h-16 md:h-[72px] flex items-center">
        <div className="flex items-center gap-2 sm:gap-3 w-full">
          {/* Label indicator (desktop/tablet) */}
          <div className="hidden sm:flex items-center gap-2 shrink-0 pe-3 border-e border-border/60 select-none">
            <Clock className="h-4 w-4 text-muted" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t("title")}
            </span>
          </div>

          {/* Compact Clock Icon on mobile */}
          <div className="flex sm:hidden items-center shrink-0 ps-1 text-muted min-h-[44px] min-w-[28px] justify-center" title={t("title")}>
            <Clock className="h-4 w-4" aria-hidden="true" />
          </div>

          {/* Scroll Area Wrapper with RTL-aware Edge Masks */}
          <div className="relative flex-1 min-w-0 overflow-hidden">
            {/* Start Edge Fade Mask */}
            <div
              className={cn(
                "pointer-events-none absolute inset-y-0 start-0 w-8 sm:w-12 z-10 bg-gradient-to-r rtl:bg-gradient-to-l from-surface via-surface/80 to-transparent transition-opacity duration-150",
                canScrollStart ? "opacity-100" : "opacity-0"
              )}
              aria-hidden="true"
            />

            {/* End Edge Fade Mask */}
            <div
              className={cn(
                "pointer-events-none absolute inset-y-0 end-0 w-8 sm:w-12 z-10 bg-gradient-to-l rtl:bg-gradient-to-r from-surface via-surface/80 to-transparent transition-opacity duration-150",
                canScrollEnd ? "opacity-100" : "opacity-0"
              )}
              aria-hidden="true"
            />

            {/* Horizontally scrollable row of product chips */}
            <div
              ref={scrollContainerRef}
              onScroll={updateScrollState}
              className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto scroll-smooth snap-x snap-mandatory py-1 px-1 no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-none"
              tabIndex={0}
              role="region"
              aria-label={t("title")}
            >
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={`/product/${item.product.id}`}
                  className="group shrink-0 snap-start flex items-center gap-2 sm:gap-2.5 p-1 pe-2.5 sm:pe-3 rounded-xl border border-border/70 bg-bg/50 hover:bg-surface hover:border-accent/40 hover:-translate-y-0.5 hover:ring-2 hover:ring-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent shadow-none hover:shadow-card transition-all duration-150 ease-out min-h-[44px]"
                  title={t("viewProduct", { name: item.product.name })}
                >
                  {/* Thumbnail (44x44 mobile, 48x48 sm, 56x56 desktop) */}
                  <div className="relative h-11 w-11 min-w-[44px] min-h-[44px] sm:h-12 sm:w-12 sm:min-w-[48px] sm:min-h-[48px] md:h-14 md:w-14 md:min-w-[56px] md:min-h-[56px] rounded-lg overflow-hidden border border-border/60 bg-secondary/30 flex items-center justify-center shrink-0 group-hover:ring-2 group-hover:ring-accent/30 transition-all duration-150">
                    {item.product.photo_url ? (
                      <img
                        src={item.product.photo_url}
                        alt={item.product.name}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-150"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted/50">
                        <ImageIcon className="h-5 w-5 sm:h-6 sm:w-6 stroke-[1.5]" />
                        <span className="sr-only">{t("noImage")}</span>
                      </div>
                    )}
                  </div>

                  {/* Name (single line, truncated) */}
                  <div className="flex flex-col min-w-0 max-w-[100px] sm:max-w-[150px] text-start">
                    <span className="text-xs sm:text-sm font-medium text-foreground truncate group-hover:text-accent transition-colors duration-150">
                      {item.product.name}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
