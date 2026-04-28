"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Search } from "lucide-react";
import type { ReactNode } from "react";

interface DateRangeFilterProps {
  extraFilters?: ReactNode;
}

function DateRangeFilterInner({ extraFilters }: DateRangeFilterProps) {
  const router     = useRouter();
  const pathname   = usePathname();
  const sp         = useSearchParams();

  const from = sp.get("from") ?? "";
  const to   = sp.get("to")   ?? "";

  const apply = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd   = new FormData(e.currentTarget);
      const next = new URLSearchParams(sp.toString());
      const f    = fd.get("from") as string;
      const t    = fd.get("to")   as string;
      if (f) next.set("from", f); else next.delete("from");
      if (t) next.set("to", t);   else next.delete("to");
      router.push(`${pathname}?${next.toString()}`);
    },
    [router, pathname, sp]
  );

  return (
    <form onSubmit={apply} className="card p-4 flex flex-wrap items-end gap-4 print:hidden">
      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="from" className="text-xs">من</Label>
          <DatePicker id="from" name="from" defaultValue={from} className="w-44" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to" className="text-xs">إلى</Label>
          <DatePicker id="to" name="to" defaultValue={to} className="w-44" />
        </div>
      </div>

      {extraFilters}

      <Button type="submit" size="sm" className="h-8">
        <Search size={14} />
        تطبيق
      </Button>
    </form>
  );
}

export function DateRangeFilter({ extraFilters }: DateRangeFilterProps) {
  return (
    <Suspense fallback={
      <div className="card p-4 h-16 bg-surface-1 animate-pulse rounded-card print:hidden" />
    }>
      <DateRangeFilterInner extraFilters={extraFilters} />
    </Suspense>
  );
}
