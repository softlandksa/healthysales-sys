"use client";

import { Search, Menu, LogOut, Settings } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import MobileNav from "./MobileNav";
import { NotificationBell } from "./NotificationBell";
import { CommandPalette } from "@/components/global-search/CommandPalette";
import { ROLE_LABELS } from "@/types";
import type { SessionUser, NotificationItem } from "@/types";

interface HeaderProps {
  user: SessionUser;
  unreadCount: number;
  notifications: NotificationItem[];
}

export default function Header({ user, unreadCount, notifications }: HeaderProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen,   setPaletteOpen]   = useState(false);

  const initials = user.name
    ? user.name.split(" ").map((w) => w[0]).slice(0, 2).join("")
    : user.email[0]?.toUpperCase();

  // Global Ctrl+K keybinding
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <header
        className={cn(
          "h-16 bg-surface-0 border-b border-border flex items-center px-4 md:px-6 gap-4 shrink-0 sticky top-0",
          "z-[var(--z-header)]"
        )}
      >
        {/* Mobile menu */}
        <button
          onClick={() => setMobileNavOpen(true)}
          className="md:hidden p-2 rounded-button text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors"
          aria-label="القائمة"
        >
          <Menu size={20} />
        </button>

        {/* Search trigger */}
        <div className="flex-1 max-w-sm">
          <button
            onClick={() => setPaletteOpen(true)}
            className={cn(
              "w-full flex items-center gap-2 bg-surface-1 border border-border rounded-button",
              "pr-3 pl-4 py-2 text-sm text-text-muted",
              "hover:border-brand-400 hover:bg-surface-2 transition-colors text-right"
            )}
          >
            <Search size={16} className="shrink-0" />
            <span className="flex-1 text-right">بحث…</span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 text-[10px] border border-border rounded px-1.5 py-0.5 text-text-muted font-mono bg-surface-0">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 mr-auto">
          <NotificationBell unreadCount={unreadCount} items={notifications} />

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-8 h-8 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center hover:bg-brand-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
                aria-label="الحساب الشخصي"
              >
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="font-semibold text-text-primary truncate">{user.name ?? "المستخدم"}</p>
                <p className="text-xs text-text-muted font-normal truncate">{user.email}</p>
                <p className="text-xs text-brand-600 font-normal mt-0.5">{ROLE_LABELS[user.role]}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/ar/settings">
                  <Settings size={15} />
                  الإعدادات
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/ar/login" })}
                className="text-danger-600 focus:text-danger-600 focus:bg-danger-50"
              >
                <LogOut size={15} />
                تسجيل الخروج
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} user={user} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
