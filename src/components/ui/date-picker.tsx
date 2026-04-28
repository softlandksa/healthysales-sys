"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  /** Current value as YYYY-MM-DD (controlled mode) */
  value?: string;
  /** Initial value as YYYY-MM-DD (uncontrolled / form mode) */
  defaultValue?: string;
  /** Called with YYYY-MM-DD string on date selection */
  onChange?: (value: string) => void;
  /** Hidden input name for form submission */
  name?: string;
  id?: string;
  placeholder?: string;
  /** Earliest selectable date as YYYY-MM-DD */
  min?: string;
  className?: string;
}

function ymdToDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? undefined : date;
}

function dateToYmd(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function DatePicker({
  value,
  defaultValue,
  onChange,
  name,
  id,
  placeholder = "اختر التاريخ",
  min,
  className,
}: DatePickerProps) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState<string>(defaultValue ?? "");
  const [open, setOpen]         = useState(false);

  const current  = controlled ? value : internal;
  const selected = ymdToDate(current);
  const minDate  = ymdToDate(min);

  function handleSelect(date: Date | undefined) {
    if (!date) return;
    const ymd = dateToYmd(date);
    if (!controlled) setInternal(ymd);
    onChange?.(ymd);
    setOpen(false);
  }

  const displayLabel = selected
    ? format(selected, "d MMMM yyyy", { locale: ar })
    : null;

  return (
    <div className={cn("relative", className)}>
      {/* Hidden input for form submission */}
      {name && (
        <input type="hidden" name={name} id={id} value={current} />
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full h-10 justify-start gap-2 font-normal",
              "border-border bg-surface-0 hover:bg-surface-1",
              "text-right",
              !selected && "text-text-muted"
            )}
          >
            <CalendarIcon size={15} className="text-text-secondary shrink-0" />
            <span className="truncate">{displayLabel ?? placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 rounded-2xl shadow-lg border border-gray-200"
          align="start"
          sideOffset={6}
        >
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            disabled={minDate ? (d: Date) => d < minDate! : undefined}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
