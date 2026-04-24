import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SAR_FORMATTER = new Intl.NumberFormat("ar-SA", {
  style: "currency",
  currency: "SAR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  numberingSystem: "latn", // English numerals
});

export function formatSAR(amount: number | string | bigint): string {
  const n = typeof amount === "string" ? parseFloat(amount) : Number(amount);
  return SAR_FORMATTER.format(n);
}

export function formatNumber(n: number | string): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(typeof n === "string" ? parseFloat(n) : n);
}

export function formatPercent(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}
