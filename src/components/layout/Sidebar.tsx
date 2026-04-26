"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, MapPin, ShoppingCart, Users, BarChart3,
  Target, UserCircle, Settings, ChevronLeft, Package, Wallet,
  ClipboardList, Trophy, ShieldCheck, FileSearch, LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import type { SessionUser, UserRole } from "@/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: UserRole[];
}

interface NavSection {
  title?: string;
  roles?: UserRole[];
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
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
    ],
  },
  {
    title: "الإدارة",
    roles: ["admin", "general_manager", "sales_manager", "team_manager"],
    items: [
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
      {
        href: "/ar/audit-log",
        label: "سجل التدقيق",
        icon: FileSearch,
        roles: ["admin", "general_manager"],
      },
    ],
  },
  {
    items: [
      { href: "/ar/settings", label: "الإعدادات", icon: Settings },
    ],
  },
];

interface SidebarProps {
  user: SessionUser;
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isItemVisible = (item: NavItem) =>
    !item.roles || item.roles.includes(user.role);

  const isSectionVisible = (section: NavSection) =>
    (!section.roles || section.roles.includes(user.role)) &&
    section.items.some(isItemVisible);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-l border-border transition-all duration-300",
        "bg-white",
        collapsed ? "w-16" : "w-64"
      )}
      style={{
        boxShadow: "2px 0 8px -2px rgba(0,0,0,0.08), 4px 0 6px -1px rgba(0,0,0,0.05)",
        background: "linear-gradient(180deg, #ffffff 0%, #fafbff 100%)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-border shrink-0 bg-white">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-button bg-brand-600 flex items-center justify-center shrink-0">
              <ShieldCheck size={16} className="text-white" />
            </div>
            <div className="leading-tight">
              <p className="font-bold text-text-primary text-sm">نظام المبيعات</p>
              <p className="text-[11px] text-text-muted">الميداني</p>
            </div>
          </div>
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
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {NAV_SECTIONS.map((section, sIdx) => {
          if (!isSectionVisible(section)) return null;
          const visibleItems = section.items.filter(isItemVisible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx}>
              {/* Section separator (not first section) */}
              {sIdx > 0 && <div className="mx-2 my-2 border-t border-border" />}

              {/* Section title */}
              {section.title && !collapsed && (
                <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted select-none">
                  {section.title}
                </p>
              )}

              {visibleItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-button text-base transition-all duration-150 relative group",
                      active
                        ? "bg-brand-50 text-brand-700 font-semibold border-r-2 border-brand-600"
                        : "text-text-secondary font-semibold hover:bg-surface-1 hover:text-text-primary",
                      collapsed && "justify-center px-2"
                    )}
                    title={collapsed ? label : undefined}
                  >
                    <Icon
                      size={20}
                      className={cn(
                        "shrink-0 transition-colors",
                        active ? "text-brand-600" : "text-text-muted group-hover:text-text-secondary"
                      )}
                    />
                    {!collapsed && <span className="leading-none">{label}</span>}
                    {/* Tooltip for collapsed */}
                    {collapsed && (
                      <span className="absolute right-full mr-2 px-2 py-1 rounded-button bg-text-primary text-text-inverse text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-modal">
                        {label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Logout + footer */}
      <div className="shrink-0 border-t border-border p-2 space-y-1">
        <button
          onClick={() => signOut({ callbackUrl: "/ar/login" })}
          title="تسجيل الخروج"
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-button text-sm font-semibold transition-colors",
            "text-danger-600 hover:bg-danger-50",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>تسجيل الخروج</span>}
        </button>
        {!collapsed && (
          <p className="text-[10px] text-text-muted text-center num px-3">v0.1.0</p>
        )}
      </div>
    </aside>
  );
}
