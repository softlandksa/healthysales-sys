"use client";

import * as React from "react";
import { Command } from "cmdk";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Search } from "lucide-react";

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  onSearchChange?: (q: string) => void;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "اختر...",
  searchPlaceholder = "بحث...",
  emptyText = "لا توجد نتائج",
  disabled,
  className,
  onSearchChange,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selected = options.find((o) => o.value === value);

  function handleSearch(val: string) {
    setSearch(val);
    onSearchChange?.(val);
  }

  function handleSelect(val: string) {
    onChange(val === value ? "" : val);
    setOpen(false);
    setSearch("");
  }

  const filtered = onSearchChange
    ? options
    : options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        (o.sublabel ?? "").toLowerCase().includes(search.toLowerCase())
      );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !selected && "text-text-muted", className)}
        >
          <span className="truncate">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown size={14} className="shrink-0 text-text-muted" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b border-border px-3">
            <Search size={14} className="shrink-0 text-text-muted me-2" />
            <Command.Input
              value={search}
              onValueChange={handleSearch}
              placeholder={searchPlaceholder}
              className="flex h-10 w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </div>
          <Command.List className="max-h-60 overflow-y-auto p-1">
            <Command.Empty className="py-6 text-center text-sm text-text-muted">
              {emptyText}
            </Command.Empty>
            {filtered.map((option) => (
              <Command.Item
                key={option.value}
                value={option.value}
                onSelect={handleSelect}
                className="flex items-center gap-2 px-3 py-2 rounded-button text-sm cursor-pointer hover:bg-surface-1 aria-selected:bg-brand-50"
              >
                <Check
                  size={14}
                  className={cn(
                    "shrink-0 text-brand-600",
                    value === option.value ? "opacity-100" : "opacity-0"
                  )}
                />
                <div>
                  <div className="text-text-primary">{option.label}</div>
                  {option.sublabel && (
                    <div className="text-xs text-text-muted num">{option.sublabel}</div>
                  )}
                </div>
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
