"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatSAR } from "@/lib/utils";
import { TRANSACTION_TYPE_LABELS } from "@/types";
import type { TransactionRow, TransactionType } from "@/types";

interface AccountStatementProps {
  customerId: string;
  balance: string;
  openingBalance: string;
  rows: TransactionRow[];
  total: number;
  page: number;
  pageSize: number;
  fromDate: string;
  toDate: string;
  typeFilter: string;
}

const TYPE_BADGE: Record<TransactionType, "default" | "secondary" | "success" | "warning" | "danger"> = {
  opening_balance: "secondary",
  sale: "warning",
  collection: "success",
  return_credit: "default",
  adjustment: "secondary",
};

export function AccountStatement({
  customerId,
  balance,
  openingBalance,
  rows,
  total,
  page,
  pageSize,
  fromDate,
  toDate,
  typeFilter,
}: AccountStatementProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pageCount = Math.ceil(total / pageSize);

  function updateParam(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value); else p.delete(key);
    if (key !== "page") p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
  }

  function downloadExport(format: "xlsx" | "pdf") {
    const p = new URLSearchParams();
    if (fromDate) p.set("from", fromDate);
    if (toDate) p.set("to", toDate);
    if (typeFilter) p.set("type", typeFilter);
    p.set("format", format);
    window.open(`/api/customers/${customerId}/statement?${p.toString()}`, "_blank");
  }

  const balanceNum = parseFloat(balance);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">الرصيد الحالي</p>
          <p className={`text-xl font-bold num ${balanceNum > 0 ? "text-danger-600" : "text-success-600"}`}>
            {formatSAR(balance)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">الرصيد الافتتاحي</p>
          <p className="text-xl font-bold num text-text-primary">{formatSAR(openingBalance)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-text-muted mb-1">عدد الحركات</p>
          <p className="text-xl font-bold num text-text-primary">{total}</p>
        </div>
        <div className="card p-4 flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => downloadExport("xlsx")} title="تصدير Excel">
            <FileSpreadsheet size={15} className="text-success-600" />
            Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadExport("pdf")} title="تصدير PDF">
            <FileText size={15} className="text-danger-600" />
            PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-secondary whitespace-nowrap">من:</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => updateParam("from", e.target.value)}
            className="h-9 rounded-input border border-border bg-surface-0 px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-secondary whitespace-nowrap">إلى:</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => updateParam("to", e.target.value)}
            className="h-9 rounded-input border border-border bg-surface-0 px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          className="h-9 rounded-input border border-border bg-surface-0 px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={typeFilter}
          onChange={(e) => updateParam("type", e.target.value)}
        >
          <option value="">كل الأنواع</option>
          {(Object.entries(TRANSACTION_TYPE_LABELS) as [TransactionType, string][]).map(
            ([k, v]) => <option key={k} value={k}>{v}</option>
          )}
        </select>
        {(fromDate || toDate || typeFilter) && (
          <Button size="sm" variant="ghost" onClick={() => router.push(pathname)}>
            مسح الفلاتر
          </Button>
        )}
      </div>

      {/* Transactions table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-1 border-b border-border">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">التاريخ</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">النوع</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">البيان</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">مدين</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">دائن</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">الرصيد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-text-muted">
                    لا توجد حركات في هذه الفترة
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isDebit = ["opening_balance", "sale", "adjustment"].includes(row.type);
                  const bal = parseFloat(row.balance);
                  return (
                    <tr key={row.id} className="hover:bg-surface-1 transition-colors">
                      <td className="px-4 py-3 text-text-secondary num text-xs">
                        {new Date(row.transactionDate).toLocaleDateString("ar-SA")}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={TYPE_BADGE[row.type]}>
                          {TRANSACTION_TYPE_LABELS[row.type]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-text-secondary max-w-[200px] truncate">
                        {row.description ?? "—"}
                        {row.reference && (
                          <span className="text-text-muted text-xs mr-1">({row.reference})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 num text-danger-600 font-medium">
                        {isDebit ? formatSAR(row.amount) : "—"}
                      </td>
                      <td className="px-4 py-3 num text-success-600 font-medium">
                        {!isDebit ? formatSAR(row.amount) : "—"}
                      </td>
                      <td className={`px-4 py-3 num font-semibold ${bal > 0 ? "text-danger-600" : "text-success-600"}`}>
                        {formatSAR(row.balance)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-text-secondary">
              صفحة <span className="num">{page}</span> من <span className="num">{pageCount}</span>
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => updateParam("page", String(page - 1))}>
                السابق
              </Button>
              <Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => updateParam("page", String(page + 1))}>
                التالي
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
