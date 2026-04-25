"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { ExpiryStatus } from "@/lib/reports/types";

const STATUSES: Array<{ value: ExpiryStatus; label: string }> = [
  { value: "fresh",    label: "سليم"   },
  { value: "warning",  label: "تحذير"  },
  { value: "critical", label: "حرج"    },
  { value: "expired",  label: "منتهي"  },
];

interface ExpiryStatusFilterProps {
  currentStatus?: ExpiryStatus;
}

function ExpiryStatusFilterInner({ currentStatus }: ExpiryStatusFilterProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();

  function handleChange(v: string) {
    const next = new URLSearchParams(sp.toString());
    if (v) next.set("status", v);
    else   next.delete("status");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs text-text-secondary font-medium">حالة الصلاحية</label>
      <select
        className="h-8 rounded-input border border-border bg-surface-0 px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
        value={currentStatus ?? ""}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="">الكل</option>
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}

export function ExpiryStatusFilter({ currentStatus }: ExpiryStatusFilterProps) {
  return (
    <Suspense fallback={<div className="h-8 w-28 bg-surface-1 animate-pulse rounded-input" />}>
      <ExpiryStatusFilterInner {...(currentStatus ? { currentStatus } : {})} />
    </Suspense>
  );
}
