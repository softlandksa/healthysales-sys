"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExportMenuProps {
  type: string;
  params?: Record<string, string | undefined>;
  className?: string;
}

export function ExportMenu({ type, params = {}, className }: ExportMenuProps) {
  const [open, setOpen] = useState(false);

  function buildUrl(format: string) {
    const sp = new URLSearchParams({ type, format });
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v);
    }
    return `/api/reports?${sp.toString()}`;
  }

  return (
    <div className={cn("relative", className)}>
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
        <Download size={15} />
        تصدير
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-surface-0 border border-border rounded-card shadow-elev py-1 min-w-36">
            <a
              href={buildUrl("xlsx")}
              download
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-surface-2 transition-colors"
            >
              <FileSpreadsheet size={15} className="text-success-600" />
              Excel (.xlsx)
            </a>
            <a
              href={buildUrl("csv")}
              download
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-surface-2 transition-colors"
            >
              <FileText size={15} className="text-brand-600" />
              CSV
            </a>
          </div>
        </>
      )}
    </div>
  );
}
