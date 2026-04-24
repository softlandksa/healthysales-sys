"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { Command } from "cmdk";
import {
  Users, Package, ShoppingCart, Wallet, MapPin, Trophy, ClipboardList, Building2, Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { searchGlobal } from "@/server/actions/search";
import type { SearchResults, SearchResultItem, SearchResultType } from "@/lib/search/global-search";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<SearchResultType, string> = {
  customer:    "العملاء",
  user:        "المستخدمون",
  product:     "المنتجات",
  sales_order: "طلبات المبيعات",
  collection:  "التحصيلات",
  visit:       "الزيارات",
  competition: "المسابقات",
  task:        "المهام",
};

const TYPE_ICONS: Record<SearchResultType, React.ElementType> = {
  customer:    Building2,
  user:        Users,
  product:     Package,
  sales_order: ShoppingCart,
  collection:  Wallet,
  visit:       MapPin,
  competition: Trophy,
  task:        ClipboardList,
};

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase().trim());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-brand-100 text-brand-800 rounded-sm">{text.slice(idx, idx + query.trim().length)}</mark>
      {text.slice(idx + query.trim().length)}
    </>
  );
}

interface Props {
  open:    boolean;
  onClose: () => void;
}

const EMPTY: SearchResults = {
  customers: [], users: [], products: [], salesOrders: [],
  collections: [], visits: [], competitions: [], tasks: [],
};

const SECTIONS: { key: keyof SearchResults; type: SearchResultType }[] = [
  { key: "customers",    type: "customer" },
  { key: "users",        type: "user" },
  { key: "products",     type: "product" },
  { key: "salesOrders",  type: "sales_order" },
  { key: "collections",  type: "collection" },
  { key: "visits",       type: "visit" },
  { key: "competitions", type: "competition" },
  { key: "tasks",        type: "task" },
];

export function CommandPalette({ open, onClose }: Props) {
  const router  = useRouter();
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [isPending, startTransition] = useTransition();

  // Debounced search
  useEffect(() => {
    if (query.length < 2) { setResults(EMPTY); return; }
    const t = setTimeout(() => {
      startTransition(async () => {
        const data = await searchGlobal(query).catch(() => EMPTY);
        setResults(data);
      });
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  // Reset on close
  useEffect(() => {
    if (!open) { setQuery(""); setResults(EMPTY); }
  }, [open]);

  const navigate = useCallback((href: string) => {
    router.push(href);
    onClose();
  }, [router, onClose]);

  const hasResults = SECTIONS.some(({ key }) => results[key].length > 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center pt-[10vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl mx-4 bg-surface-0 border border-border rounded-card shadow-modal overflow-hidden">
        <Command shouldFilter={false} loop>
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search size={16} className="text-text-muted shrink-0" />
            <Command.Input
              autoFocus
              placeholder="ابحث عن عميل، منتج، طلب…"
              value={query}
              onValueChange={setQuery}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
            />
            {isPending && (
              <span className="text-xs text-text-muted">جارٍ البحث…</span>
            )}
            <kbd className="text-xs text-text-muted border border-border rounded px-1.5 py-0.5 font-mono">Esc</kbd>
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            {query.length < 2 && (
              <Command.Empty className="py-8 text-center text-sm text-text-muted">
                ابدأ بكتابة حرفين على الأقل للبحث
              </Command.Empty>
            )}
            {query.length >= 2 && !hasResults && !isPending && (
              <Command.Empty className="py-8 text-center text-sm text-text-muted">
                لا توجد نتائج لـ «{query}»
              </Command.Empty>
            )}

            {SECTIONS.map(({ key, type }) => {
              const items = results[key] as SearchResultItem[];
              if (items.length === 0) return null;
              const Icon = TYPE_ICONS[type];
              return (
                <Command.Group key={key} heading={TYPE_LABELS[type]} className="mb-1">
                  {items.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={`${type}:${item.id}`}
                      onSelect={() => navigate(item.href)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-button cursor-pointer text-sm",
                        "text-text-primary hover:bg-surface-2",
                        "data-[selected=true]:bg-brand-50 data-[selected=true]:text-brand-700",
                        "transition-colors"
                      )}
                    >
                      <Icon size={15} className="text-text-muted shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate font-medium">
                          {highlightMatch(item.title, query)}
                        </span>
                        {item.subtitle && (
                          <span className="block text-xs text-text-muted truncate">
                            {highlightMatch(item.subtitle, query)}
                          </span>
                        )}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-xs text-text-muted">
            <span><kbd className="font-mono border border-border rounded px-1">↑↓</kbd> تنقل</span>
            <span><kbd className="font-mono border border-border rounded px-1">↵</kbd> فتح</span>
            <span><kbd className="font-mono border border-border rounded px-1">Esc</kbd> إغلاق</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
