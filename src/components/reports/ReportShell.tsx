import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "./ExportMenu";
import type { ReportType } from "@/lib/reports/types";

interface ReportShellProps {
  title:       string;
  description?: string;
  type:        ReportType;
  exportParams?: Record<string, string | undefined>;
  children:    ReactNode;
}

export function ReportShell({
  title,
  description,
  type,
  exportParams,
  children,
}: ReportShellProps) {
  return (
    <div className="space-y-6 print:space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-text-secondary print:hidden">
        <Link href="/ar/reports" className="hover:text-brand-700 transition-colors">التقارير</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-text-primary font-medium">{title}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
          {description && <p className="text-sm text-text-secondary mt-1">{description}</p>}
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
          >
            <Printer size={15} />
            طباعة
          </Button>
          <ExportMenu type={type} {...(exportParams ? { params: exportParams } : {})} />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}
