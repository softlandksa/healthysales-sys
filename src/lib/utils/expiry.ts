// Expiry date helpers for sales order line items.
// Thresholds (days remaining): fresh ≥ 180 | watch ≥ 90 | near ≥ 30 | critical ≥ 7 | danger ≥ 1 | expired < 0

export type ExpiryStatus = "fresh" | "watch" | "near" | "critical" | "danger" | "expired";

export function daysToExpiry(expiryDate: Date): number {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfExpiry = new Date(
    expiryDate.getFullYear(),
    expiryDate.getMonth(),
    expiryDate.getDate()
  );
  return Math.floor((startOfExpiry.getTime() - startOfToday.getTime()) / 86_400_000);
}

export function expiryStatus(expiryDate: Date): ExpiryStatus {
  const days = daysToExpiry(expiryDate);
  if (days < 0)  return "expired";
  if (days < 1)  return "danger";
  if (days < 7)  return "critical";
  if (days < 30) return "near";
  if (days < 90) return "watch";
  return "fresh";
}

export function statusLabel(expiryDate: Date): string {
  const days = daysToExpiry(expiryDate);
  if (days < 0)  return `منتهي منذ ${Math.abs(days)} يوم`;
  if (days === 0) return "ينتهي اليوم";
  if (days === 1) return "ينتهي غداً";
  return `${days} أيام متبقية`;
}

export const EXPIRY_STATUS_CLASSES: Record<ExpiryStatus, string> = {
  fresh:    "bg-success-50 text-success-600 border-success-200",
  watch:    "bg-blue-50 text-blue-600 border-blue-200",
  near:     "bg-warning-50 text-warning-600 border-warning-200",
  critical: "bg-orange-50 text-orange-600 border-orange-200",
  danger:   "bg-danger-50 text-danger-600 border-danger-200",
  expired:  "bg-red-100 text-red-800 border-red-300",
};
