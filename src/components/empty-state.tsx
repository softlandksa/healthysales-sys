import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon:        LucideIcon;
  title:       string;
  description?: string;
  cta?:        { label: string; href: string };
  className?:  string;
}

export function EmptyState({ icon: Icon, title, description, cta, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-6 text-center", className)}>
      {/* Illustration circle */}
      <div className="relative mb-5">
        <div className="w-20 h-20 rounded-full bg-brand-50 flex items-center justify-center">
          <Icon size={36} className="text-brand-400" strokeWidth={1.5} />
        </div>
        {/* Decorative ring */}
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-brand-100 scale-125 opacity-60" />
      </div>

      <h3 className="text-base font-semibold text-text-primary mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-text-secondary max-w-xs">{description}</p>
      )}

      {cta && (
        <Link
          href={cta.href}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-button bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
