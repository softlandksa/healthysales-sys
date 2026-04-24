import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-badge px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-brand-100 text-brand-700",
        secondary: "bg-surface-2 text-text-secondary",
        success: "bg-success-50 text-success-600",
        warning: "bg-warning-50 text-warning-600",
        danger: "bg-danger-50 text-danger-600",
        outline: "border border-border text-text-secondary",
        // Role-specific
        admin: "bg-purple-100 text-purple-700",
        general_manager: "bg-blue-100 text-blue-700",
        sales_manager: "bg-sky-100 text-sky-700",
        team_manager: "bg-teal-100 text-teal-700",
        sales_rep: "bg-green-100 text-green-700",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
