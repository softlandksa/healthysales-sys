"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";
import { ar } from "date-fns/locale";
import { CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMyNotificationsPaged, markNotificationsRead } from "@/server/actions/notifications";
import type { NotificationItem } from "@/types";

const FILTER_TYPES = [
  { value: "",       label: "الكل" },
  { value: "task",   label: "المهام" },
  { value: "system", label: "النظام" },
];

function groupByDate(items: NotificationItem[]): { label: string; items: NotificationItem[] }[] {
  const map = new Map<string, NotificationItem[]>();
  for (const item of items) {
    const d = new Date(item.createdAt);
    let key: string;
    if (isToday(d))     key = "اليوم";
    else if (isYesterday(d)) key = "أمس";
    else key = format(d, "d MMMM yyyy", { locale: ar });

    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

interface Props {
  initialItems:      NotificationItem[];
  initialNextCursor: string | null;
}

export function NotificationsClient({ initialItems, initialNextCursor }: Props) {
  const [items,     setItems]     = useState(initialItems);
  const [cursor,    setCursor]    = useState(initialNextCursor);
  const [typeFilter, setTypeFilter] = useState("");
  const [, start] = useTransition();

  const loadMore = useCallback(() => {
    if (!cursor) return;
    start(async () => {
      const { items: next, nextCursor } = await getMyNotificationsPaged(cursor, typeFilter || undefined);
      setItems((prev) => [...prev, ...next]);
      setCursor(nextCursor);
    });
  }, [cursor, typeFilter]);

  const changeFilter = useCallback((type: string) => {
    setTypeFilter(type);
    start(async () => {
      const { items: next, nextCursor } = await getMyNotificationsPaged(undefined, type || undefined);
      setItems(next);
      setCursor(nextCursor);
    });
  }, []);

  const markAllRead = useCallback(() => {
    start(async () => {
      await markNotificationsRead();
      setItems((prev) => prev.map((i) => ({ ...i, isRead: true })));
    });
  }, []);

  const unreadCount = items.filter((i) => !i.isRead).length;
  const grouped     = groupByDate(items);

  return (
    <div className="space-y-4">
      {/* Filter + mark-all-read */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => changeFilter(value)}
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                typeFilter === value
                  ? "bg-brand-600 text-white"
                  : "bg-surface-1 text-text-secondary hover:bg-surface-2"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
          >
            <CheckCheck size={15} />
            تعيين الكل كمقروء ({unreadCount})
          </button>
        )}
      </div>

      {/* Grouped list */}
      {items.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="text-text-muted text-sm">لا توجد إشعارات</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ label, items: group }) => (
            <div key={label}>
              <p className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide">{label}</p>
              <div className="card divide-y divide-border overflow-hidden">
                {group.map((item) => {
                  const inner = (
                    <div className={cn("px-4 py-3 transition-colors", !item.isRead && "bg-brand-50")}>
                      <div className="flex items-start gap-2">
                        {!item.isRead && (
                          <span className="mt-1.5 w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary line-clamp-1">{item.title}</p>
                          {item.body && (
                            <p className="text-xs text-text-secondary line-clamp-2 mt-0.5">{item.body}</p>
                          )}
                          <p className="text-xs text-text-muted mt-1 num">
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ar })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );

                  return item.link ? (
                    <Link key={item.id} href={item.link} className="block hover:bg-surface-1">
                      {inner}
                    </Link>
                  ) : (
                    <div key={item.id}>{inner}</div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {cursor && (
        <div className="text-center">
          <button
            onClick={loadMore}
            className="text-sm text-brand-600 hover:underline px-4 py-2"
          >
            تحميل المزيد
          </button>
        </div>
      )}
    </div>
  );
}
