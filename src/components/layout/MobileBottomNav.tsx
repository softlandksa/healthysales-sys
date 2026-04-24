"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MapPin, Users, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const BOTTOM_NAV = [
  { href: "/ar/dashboard",  label: "الرئيسية", icon: LayoutDashboard },
  { href: "/ar/visits",     label: "الزيارات",  icon: MapPin },
  { href: "/ar/customers",  label: "العملاء",   icon: Users },
  { href: "/ar/reports",    label: "التقارير",  icon: BarChart3 },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-0 border-t border-border safe-area-inset-bottom">
      <div className="flex items-center justify-around px-2 pb-safe pt-1">
        {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                active ? "text-brand-600" : "text-text-muted"
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.75} />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
