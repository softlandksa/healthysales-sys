"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { markNotificationsRead, getUnreadCount } from "@/server/actions/notifications";
import type { NotificationItem } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface NotificationBellProps {
  unreadCount:   number;
  items:         NotificationItem[];
}

export function NotificationBell({ unreadCount: initialCount, items }: NotificationBellProps) {
  const [open,       setOpen]       = useState(false);
  const [localCount, setLocalCount] = useState(initialCount);
  const prevCount = useRef(initialCount);
  const [, startTransition] = useTransition();

  // Poll for new notifications every 30s + on window focus
  useEffect(() => {
    async function fetchCount() {
      try {
        const count = await getUnreadCount();
        setLocalCount(count);
      } catch { /* silent */ }
    }

    const interval = setInterval(fetchCount, 30_000);
    window.addEventListener("focus", fetchCount);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", fetchCount);
    };
  }, []);

  // Track previous to detect increases
  useEffect(() => {
    prevCount.current = localCount;
  }, [localCount]);

  function handleOpen() {
    setOpen((prev) => !prev);
    if (!open && localCount > 0) {
      setLocalCount(0);
      startTransition(async () => {
        await markNotificationsRead();
      });
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-button text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        aria-label="الإشعارات"
        aria-expanded={open}
      >
        <Bell size={20} />

        <AnimatePresence>
          {localCount > 0 && (
            <motion.span
              key={localCount}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1,   opacity: 1 }}
              exit={  { scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-0.5 bg-danger-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center num leading-none"
            >
              {localCount > 99 ? "99+" : localCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[var(--z-dropdown)]"
            onClick={() => setOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute left-0 top-full mt-2 w-80 bg-surface-0 border border-border rounded-card shadow-modal z-[calc(var(--z-dropdown)+1)] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <p className="font-semibold text-sm text-text-primary">الإشعارات</p>
            </div>

            {items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-text-muted text-center">لا توجد إشعارات</p>
            ) : (
              <ul className="divide-y divide-border max-h-96 overflow-y-auto">
                {items.map((item) => (
                  <li key={item.id}>
                    {item.link ? (
                      <Link
                        href={item.link}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "block px-4 py-3 hover:bg-surface-1 transition-colors",
                          !item.isRead && "bg-brand-50"
                        )}
                      >
                        <NotificationRow item={item} />
                      </Link>
                    ) : (
                      <div className={cn("px-4 py-3", !item.isRead && "bg-brand-50")}>
                        <NotificationRow item={item} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="px-4 py-2 border-t border-border">
              <Link
                href="/ar/notifications"
                onClick={() => setOpen(false)}
                className="text-xs text-brand-600 hover:underline"
              >
                عرض كل الإشعارات
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NotificationRow({ item }: { item: NotificationItem }) {
  return (
    <>
      <p className="text-sm font-medium text-text-primary line-clamp-1">{item.title}</p>
      {item.body && (
        <p className="text-xs text-text-secondary line-clamp-2 mt-0.5">{item.body}</p>
      )}
      <p className="text-xs text-text-muted mt-1 num">
        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ar })}
      </p>
    </>
  );
}
