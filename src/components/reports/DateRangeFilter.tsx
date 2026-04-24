"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface DateRangeFilterProps {
  extraFilters?: ReactNode;
}

import type { ReactNode } from "react";

export function DateRangeFilter({ extraFilters }: DateRangeFilterProps) {
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
          <Input id="from" name="from" type="date" defaultValue={from} className="h-8 text-sm w-36" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to" className="text-xs">إلى</Label>
          <Input id="to" name="to" type="date" defaultValue={to} className="h-8 text-sm w-36" />
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
