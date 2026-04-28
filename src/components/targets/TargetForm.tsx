"use client";

import { useActionState, useState } from "react";
import { createTarget } from "@/server/actions/targets";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { TARGET_METRIC_LABELS, TARGET_PERIOD_LABELS } from "@/types";
import type { ActionResult, TargetMetric, TargetPeriod } from "@/types";

interface RepOption {
  id: string;
  name: string | null;
}

interface TargetFormProps {
  reps: RepOption[];
}

function buildPeriodOptions(period: TargetPeriod): { key: string; label: string }[] {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  if (period === "monthly") {
    const opts = [];
    for (let i = 0; i < 6; i++) {
      const m  = month - i;
      const y  = m <= 0 ? year - 1 : year;
      const mm = ((m - 1 + 12) % 12) + 1;
      const key = `${y}-${String(mm).padStart(2, "0")}`;
      opts.push({ key, label: key });
    }
    return opts;
  }

  if (period === "quarterly") {
    const q    = Math.ceil(month / 3);
    const opts = [];
    for (let i = 0; i < 4; i++) {
      const qi = q - i;
      const y  = qi <= 0 ? year - 1 : year;
      const qq = ((qi - 1 + 4) % 4) + 1;
      opts.push({ key: `${y}-Q${qq}`, label: `${y} — الربع ${qq}` });
    }
    return opts;
  }

  if (period === "yearly") {
    return [
      { key: String(year),     label: String(year) },
      { key: String(year - 1), label: String(year - 1) },
      { key: String(year - 2), label: String(year - 2) },
    ];
  }

  return [];
}

const METRICS: TargetMetric[] = ["sales_amount", "collections_amount", "visits_count"];
const PERIODS: TargetPeriod[] = ["monthly", "quarterly", "yearly", "custom"];

const initialState: ActionResult<{ id: string }> = { success: false };

export function TargetForm({ reps }: TargetFormProps) {
  const [state, action, pending]    = useActionState(createTarget, initialState);
  const [period, setPeriod]         = useState<TargetPeriod>("monthly");

  const periodOpts    = buildPeriodOptions(period);
  const defaultPeriodKey = periodOpts[0]?.key ?? "";

  return (
    <form action={action} className="space-y-5">
      {state.error && (
        <div className="rounded-card bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger-700">
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="userId">المندوب</Label>
        <select
          id="userId"
          name="userId"
          required
          className="flex h-10 w-full rounded-card border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">اختر مندوبًا...</option>
          {reps.map((r) => (
            <option key={r.id} value={r.id}>{r.name ?? r.id}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="metric">المقياس</Label>
          <Select name="metric" required>
            <SelectTrigger id="metric">
              <SelectValue placeholder="اختر المقياس..." />
            </SelectTrigger>
            <SelectContent>
              {METRICS.map((m) => (
                <SelectItem key={m} value={m}>{TARGET_METRIC_LABELS[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="period">نوع الفترة</Label>
          <Select
            name="period"
            required
            defaultValue="monthly"
            onValueChange={(v) => setPeriod(v as TargetPeriod)}
          >
            <SelectTrigger id="period"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p} value={p}>{TARGET_PERIOD_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {period === "custom" ? (
        <>
          <input type="hidden" name="periodStart" value="custom" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customStart">تاريخ البداية</Label>
              <DatePicker id="customStart" name="customStart" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customEnd">تاريخ النهاية</Label>
              <DatePicker id="customEnd" name="customEnd" />
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="periodStart">الفترة</Label>
          <Select name="periodStart" required defaultValue={defaultPeriodKey} key={period}>
            <SelectTrigger id="periodStart"><SelectValue /></SelectTrigger>
            <SelectContent>
              {periodOpts.map((o) => (
                <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="value">قيمة الهدف</Label>
        <Input
          id="value"
          name="value"
          type="number"
          min="1"
          step="any"
          required
          placeholder="0.00"
        />
      </div>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "جارٍ الحفظ..." : "حفظ الهدف"}
      </Button>
    </form>
  );
}
