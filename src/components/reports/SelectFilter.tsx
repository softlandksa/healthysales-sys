"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface SelectFilterProps {
  paramKey: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  currentValue?: string;
}

function SelectFilterInner({ paramKey, label, options, currentValue }: SelectFilterProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const sp       = useSearchParams();

  function handleChange(v: string) {
    const next = new URLSearchParams(sp.toString());
    if (v) next.set(paramKey, v); else next.delete(paramKey);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs text-text-secondary font-medium">{label}</label>
      <select
        className="h-8 rounded-input border border-border bg-surface-0 px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
        value={currentValue ?? ""}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="">الكل</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function SelectFilter(props: SelectFilterProps) {
  return (
    <Suspense fallback={<div className="h-8 w-32 bg-surface-1 animate-pulse rounded-input" />}>
      <SelectFilterInner {...props} />
    </Suspense>
  );
}
