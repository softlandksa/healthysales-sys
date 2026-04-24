"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, MapPin, ShoppingCart, Users, BarChart3,
  Target, UserCircle, Settings, ChevronLeft, Package, Wallet, ClipboardList, Trophy,
} from "lucide-react";
import { useState } from "react";
import type { SessionUser, UserRole } from "@/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/ar/dashboard",    label: "لوحة التحكم",  icon: LayoutDashboard },
  { href: "/ar/visits",       label: "الزيارات",      icon: MapPin },
  { href: "/ar/sales",        label: "طلبات البيع",   icon: ShoppingCart },
  { href: "/ar/collections",  label: "التحصيلات",     icon: Wallet },
  { href: "/ar/tasks",        label: "المهام",          icon: ClipboardList },
  { href: "/ar/competitions", label: "المسابقات",      icon: Trophy },
  { href: "/ar/customers",    label: "العملاء",        icon: Users },
  { href: "/ar/products",     label: "المنتجات",       icon: Package },
  { href: "/ar/reports",      label: "التقارير",       icon: BarChart3 },
  { href: "/ar/targets",      label: "الأهداف",        icon: Target },
  {
    href: "/ar/users",
    label: "المستخدمون",
    icon: UserCircle,
    roles: ["admin", "general_manager", "sales_manager", "team_manager"],
  },
  {
    href: "/ar/teams",
    label: "الفرق",
    icon: Users,
    roles: ["admin", "general_manager", "sales_manager", "team_manager"],
  },
  { href: "/ar/settings", label: "الإعدادات", icon: Settings },
];

interface SidebarProps {
  user: SessionUser;
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user.role)
  );

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col bg-surface-0 border-l border-border transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
      style={{ boxShadow: "var(--shadow-sidebar)" }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-border shrink-0">
        {!collapsed && (
          <span className="font-bold text-brand-700 text-sm leading-tight">
            نظام المبيعات
            <br />
            <span className="text-xs font-normal text-text-muted">الميداني</span>
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "p-1.5 rounded-button text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors",
            collapsed && "mx-auto"
          )}
          aria-label={collapsed ? "توسيع القائمة" : "طي القائمة"}
        >
          <ChevronLeft
            size={16}
            className={cn("transition-transform duration-300", collapsed && "rotate-180")}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-button text-sm font-medium transition-all duration-150",
                "hover:bg-surface-2 hover:text-brand-700",
                active ? "bg-brand-50 text-brand-700 shadow-sm" : "text-text-secondary",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-border">
          <p className="text-xs text-text-muted text-center num">v0.1.0</p>
        </div>
      )}
    </aside>
  );
}
