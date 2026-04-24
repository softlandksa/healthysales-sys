"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { X, LayoutDashboard, MapPin, ShoppingCart, Users, BarChart3, Target, UserCircle, Settings, Wallet, Package, ClipboardList, Trophy } from "lucide-react";
import { useEffect } from "react";
import { ROLE_LABELS } from "@/types";
import type { SessionUser } from "@/types";

const NAV_ITEMS = [
  { href: "/ar/dashboard",   label: "لوحة التحكم",  icon: LayoutDashboard },
  { href: "/ar/visits",      label: "الزيارات",      icon: MapPin },
  { href: "/ar/sales",       label: "طلبات البيع",   icon: ShoppingCart },
  { href: "/ar/collections", label: "التحصيلات",     icon: Wallet },
  { href: "/ar/tasks",       label: "المهام",          icon: ClipboardList },
  { href: "/ar/competitions", label: "المسابقات",     icon: Trophy },
  { href: "/ar/customers",   label: "العملاء",        icon: Users },
  { href: "/ar/products",    label: "المنتجات",       icon: Package },
  { href: "/ar/reports",     label: "التقارير",       icon: BarChart3 },
  { href: "/ar/targets",     label: "الأهداف",        icon: Target },
  { href: "/ar/users",       label: "المستخدمون",    icon: UserCircle },
  { href: "/ar/settings",    label: "الإعدادات",     icon: Settings },
] as const;

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  user: SessionUser;
}

export default function MobileNav({ open, onClose, user }: MobileNavProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] md:hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <nav className="absolute inset-y-0 right-0 w-64 bg-surface-0 shadow-modal flex flex-col">
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          <span className="font-bold text-brand-700">نظام المبيعات</span>
          <button onClick={onClose} className="p-1.5 rounded-button text-text-muted hover:bg-surface-2 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* User info strip */}
        <div className="px-4 py-3 bg-surface-1 border-b border-border">
          <p className="text-sm font-medium text-text-primary">{user.name ?? user.email}</p>
          <p className="text-xs text-brand-600">{ROLE_LABELS[user.role]}</p>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-button text-sm font-medium transition-all",
                  "hover:bg-surface-2 hover:text-brand-700",
                  active ? "bg-brand-50 text-brand-700" : "text-text-secondary"
                )}
              >
                <Icon size={18} className="shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
