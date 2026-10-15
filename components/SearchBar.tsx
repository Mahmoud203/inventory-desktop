"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { getUser } from "@/lib/auth/local";
import {
  Search,
  ChevronRight,
  PackageSearch,
  ImageIcon,
  Loader2,
  X,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchResultItem {
  id: string;
  name: string;
  photo_url: string | null;
  store_id: string;
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

export function SearchBar({ mobileOnly = false }: { mobileOnly?: boolean }) {
  const t = useTranslations("search");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const supabase = createClient();

  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const mobileInputRef = React.useRef<HTMLInputElement>(null);

  // Debounce search query 300ms and execute
  React.useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    let isCurrent = true;

    const timer = setTimeout(async () => {
      try {
        const {
          data: { user },
        } = await getUser();

        if (!user || !isCurrent) return;

        const { data, error } = await supabase
          .from("products")
          .select(
            `
            id,
            name,
            photo_url,
            store_id,
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
          .eq("user_id", user.id)
          .ilike("name", `%${trimmed}%`)
          .limit(8);

        if (!isCurrent) return;

        if (error) {
          console.error("Search query error:", error);
          setResults([]);
        } else {
          setResults((data as unknown as SearchResultItem[]) || []);
          setActiveIndex(-1);
        }
      } catch (err) {
        console.error("Search error:", err);
        if (isCurrent) setResults([]);
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [query, supabase]);

  const handleSelectProduct = (productId: string) => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setIsLoading(false);
    inputRef.current?.blur();
    router.push(`/product/${productId}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" && query.trim()) {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length > 0) {
        setActiveIndex((prev) => (prev + 1) % results.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length > 0) {
        setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        handleSelectProduct(results[activeIndex].id);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
    }
  };

  const handleCloseMobile = () => {
    setIsMobileOpen(false);
    setQuery("");
    setResults([]);
    setIsLoading(false);
  };

  // If this instance is mobile-only (e.g. rendered in TopNav for mobile)
  if (mobileOnly) {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsMobileOpen(true);
            setTimeout(() => mobileInputRef.current?.focus(), 50);
          }}
          className="h-10 w-10 sm:h-8 sm:w-8 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-0 text-muted hover:text-foreground"
          title={t("placeholder")}
          aria-label={t("placeholder")}
        >
          <Search className="h-4 w-4" />
        </Button>

        {isMobileOpen && (
          <div
            className="fixed inset-0 z-50 bg-surface flex flex-col p-4 animate-in fade-in-0 duration-150"
            style={{
              paddingTop: "max(1rem, env(safe-area-inset-top, 0px))",
              paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
            }}
            role="dialog"
            aria-modal="true"
            aria-label={t("placeholder")}
          >
            {/* Header / Input row */}
            <div className="flex items-center gap-2 pb-3 border-b border-border/60">
              <div className="relative flex-1 flex items-center">
                <Search
                  className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  ref={mobileInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    const val = e.target.value;
                    setQuery(val);
                    if (!val.trim()) {
                      setResults([]);
                      setIsLoading(false);
                    } else {
                      setIsLoading(true);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      handleCloseMobile();
                    } else if (e.key === "Enter" && results.length > 0) {
                      const target = activeIndex >= 0 ? results[activeIndex] : results[0];
                      handleSelectProduct(target.id);
                      setIsMobileOpen(false);
                    }
                  }}
                  placeholder={t("placeholder")}
                  className="w-full h-11 rounded-lg border border-border bg-bg ps-9 pe-9 text-base text-foreground placeholder:text-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setResults([]);
                      mobileInputRef.current?.focus();
                    }}
                    className="absolute end-2 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center text-muted hover:text-foreground"
                    aria-label={tCommon("clear")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCloseMobile}
                className="min-h-[44px] px-3 text-sm text-muted hover:text-foreground shrink-0"
              >
                {tCommon("cancel")}
              </Button>
            </div>

            {/* Results list */}
            <div className="flex-1 overflow-y-auto py-3 space-y-1">
              {isLoading && results.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  <span>{t("loading")}</span>
                </div>
              ) : results.length > 0 ? (
                results.map((product) => {
                  const sectionName = product.stores?.sections?.name;
                  const storeName = product.stores?.name;

                  return (
                    <div
                      key={product.id}
                      onClick={() => {
                        handleSelectProduct(product.id);
                        setIsMobileOpen(false);
                      }}
                      className="min-h-[52px] flex items-center gap-3 p-2.5 rounded-lg active:bg-surface-hover hover:bg-surface-hover cursor-pointer border border-border/40 bg-surface shadow-soft transition-colors select-none"
                    >
                      <div className="h-10 w-10 rounded-md overflow-hidden bg-secondary/40 shrink-0 border border-border/40 flex items-center justify-center">
                        {product.photo_url ? (
                          <img
                            src={product.photo_url}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted/60 stroke-[1.5]" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 text-start">
                        <p className="text-sm font-medium text-foreground truncate">
                          {product.name}
                        </p>
                        {(sectionName || storeName) && (
                          <p className="text-xs text-muted truncate flex items-center gap-1 mt-0.5">
                            {sectionName && <span>{sectionName}</span>}
                            {sectionName && storeName && (
                              <ChevronRight className="h-3 w-3 rtl:rotate-180 text-muted/60 shrink-0" />
                            )}
                            {storeName && <span>{storeName}</span>}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : query.trim() ? (
                <div className="p-8 flex flex-col items-center justify-center text-center space-y-2 select-none">
                  <PackageSearch className="h-8 w-8 text-muted/50 stroke-[1.5]" />
                  <p className="text-sm font-medium text-muted">
                    {t("noResults")}
                  </p>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-muted/70">
                  {t("placeholder")}
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  const shouldShowDropdown =
    isOpen && (query.trim().length > 0 || isLoading);

  // Desktop search bar
  return (
    <div className="relative w-full">
      <Popover open={shouldShowDropdown} onOpenChange={setIsOpen}>
        <PopoverAnchor asChild>
          <div className="relative flex items-center w-full">
            <Search
              className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none stroke-[1.5]"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                const val = e.target.value;
                setQuery(val);
                if (!val.trim()) {
                  setResults([]);
                  setIsLoading(false);
                } else {
                  setIsLoading(true);
                  if (!isOpen) setIsOpen(true);
                }
              }}
              onFocus={() => {
                if (query.trim()) setIsOpen(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder={t("placeholder")}
              className={cn(
                "flex h-9 w-full rounded-md border border-border/80 bg-bg/60 ps-9 pe-8 py-1.5 text-base sm:text-xs text-foreground placeholder:text-muted/70",
                "shadow-soft transition-all duration-150 ease-out",
                "focus-visible:outline-none focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                isOpen && "border-accent/40 bg-surface ring-2 ring-accent/20"
              )}
            />
            {isLoading && (
              <Loader2 className="absolute end-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted" />
            )}
          </div>
        </PopoverAnchor>

        <PopoverContent
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-[var(--radix-popover-trigger-width)] min-w-[340px] max-w-[calc(100vw-2rem)] p-1 bg-surface/95 backdrop-blur-md border border-border shadow-popover rounded-xl overflow-hidden"
        >
          {isLoading && results.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted flex items-center justify-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
              <span>{t("loading")}</span>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-0.5 max-h-[360px] overflow-y-auto p-1">
              {results.map((product, idx) => {
                const isSelected = idx === activeIndex;
                const sectionName = product.stores?.sections?.name;
                const storeName = product.stores?.name;

                return (
                  <div
                    key={product.id}
                    onClick={() => handleSelectProduct(product.id)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={cn(
                      "h-12 flex items-center gap-3 px-3 rounded-lg text-start transition-colors duration-150 cursor-pointer select-none",
                      "hover:bg-surface-hover",
                      isSelected
                        ? "bg-surface-hover text-foreground ring-1 ring-border/80"
                        : "text-foreground"
                    )}
                  >
                    {/* Thumbnail Image / Fallback */}
                    <div className="h-8 w-8 rounded-md overflow-hidden bg-secondary/40 shrink-0 border border-border/40 flex items-center justify-center">
                      {product.photo_url ? (
                        <img
                          src={product.photo_url}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted/60 stroke-[1.5]" />
                      )}
                    </div>

                    {/* Product Name & Breadcrumb */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {product.name}
                      </p>
                      {(sectionName || storeName) && (
                        <p className="text-[11px] text-muted truncate flex items-center gap-1 mt-0.5">
                          {sectionName && <span>{sectionName}</span>}
                          {sectionName && storeName && (
                            <ChevronRight className="h-3 w-3 rtl:rotate-180 text-muted/60 shrink-0" />
                          )}
                          {storeName && <span>{storeName}</span>}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 flex flex-col items-center justify-center text-center space-y-2 select-none">
              <PackageSearch className="h-7 w-7 text-muted/50 stroke-[1.5]" />
              <p className="text-xs font-medium text-muted">
                {t("noResults")}
              </p>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
