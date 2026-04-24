import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="مسار التنقل" className={cn("flex items-center gap-1.5 text-sm", className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronLeft size={14} className="text-text-muted shrink-0" />}
            {item.href && !isLast ? (
              <Link href={item.href} className="text-text-secondary hover:text-text-primary transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-text-primary font-medium" : "text-text-secondary"}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
