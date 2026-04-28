"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      dir="rtl"
      className={cn("p-3 select-none", className)}
      classNames={{
        months:              "flex flex-col",
        month:               "space-y-3",
        caption:             "flex justify-center items-center relative pt-1",
        caption_label:       "text-sm font-semibold text-text-primary",
        nav:                 "flex items-center gap-1",
        nav_button:          "absolute h-7 w-7 flex items-center justify-center rounded-md border border-border bg-surface-0 hover:bg-surface-1 transition-colors text-text-secondary",
        nav_button_previous: "right-0",
        nav_button_next:     "left-0",
        table:               "w-full border-collapse",
        head_row:            "flex",
        head_cell:           "w-9 text-center text-xs font-medium text-text-muted pb-1",
        row:                 "flex w-full mt-1",
        cell:                "w-9 h-9 text-center p-0",
        day:                 "w-9 h-9 rounded-lg text-sm font-normal text-text-primary hover:bg-surface-1 transition-colors inline-flex items-center justify-center cursor-pointer",
        day_selected:        "!bg-blue-500 !text-white hover:!bg-blue-600 font-semibold",
        day_today:           "border border-blue-300 font-semibold",
        day_outside:         "text-text-muted opacity-40",
        day_disabled:        "text-text-muted opacity-30 cursor-not-allowed hover:bg-transparent",
        day_hidden:          "invisible",
        ...classNames,
      }}
      components={{
        IconLeft:  () => <ChevronRight size={14} />,
        IconRight: () => <ChevronLeft  size={14} />,
      }}
      {...props}
    />
  );
}
