"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Edit, ToggleLeft, ToggleRight, Trash2, Search, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatSAR } from "@/lib/utils";
import { toggleProductStatus, deleteProduct } from "@/server/actions/products";
import type { ProductRow } from "@/types";
import { EmptyState } from "@/components/empty-state";

interface ProductsTableProps {
  rows: ProductRow[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
  status: string;
  canEdit: boolean;
  canDelete: boolean;
}

export function ProductsTable({
  rows,
  total,
  page,
  pageSize,
  q,
  status,
  canEdit,
  canDelete,
}: ProductsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const pageCount = Math.ceil(total / pageSize);

  function updateParam(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value); else p.delete(key);
    if (key !== "page") p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
  }

  function handleToggle(id: string) {
    startTransition(async () => {
      const r = await toggleProductStatus(id);
      if (r.error) toast.error(r.error);
      else toast.success("تم تغيير حالة المنتج");
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return;
    startTransition(async () => {
      const r = await deleteProduct(id);
      if (r.error) toast.error(r.error);
      else toast.success("تم حذف المنتج");
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <Input
            placeholder="البحث بالاسم أو الكود..."
            defaultValue={q}
            className="pr-9"
            onChange={(e) => {
              const v = e.target.value;
              clearTimeout((window as unknown as Record<string, unknown>)._pt as ReturnType<typeof setTimeout>);
              (window as unknown as Record<string, unknown>)._pt = setTimeout(() => updateParam("q", v), 350);
            }}
          />
        </div>

        <select
          className="h-9 rounded-input border border-border bg-surface-0 px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={status}
          onChange={(e) => updateParam("status", e.target.value)}
        >
          <option value="">الكل</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-1 border-b border-border">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">الكود</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">الاسم</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">الوحدة</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">السعر</th>
                <th className="text-right px-4 py-3 font-medium text-text-secondary">الحالة</th>
                {(canEdit || canDelete) && (
                  <th className="text-right px-4 py-3 font-medium text-text-secondary">إجراءات</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={Package}
                      title="لا توجد منتجات"
                      description="أضف منتجاتك لتتمكن المندوبون من إدراجها في طلبات المبيعات"
                      cta={{ label: "إضافة منتج", href: "/ar/products/new" }}
                    />
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-1 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">{row.code}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">{row.nameAr}</div>
                      {row.nameEn && (
                        <div className="text-xs text-text-muted" dir="ltr">{row.nameEn}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{row.unit}</td>
                    <td className="px-4 py-3 num font-medium">{formatSAR(row.price)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={row.isActive ? "success" : "secondary"}>
                        {row.isActive ? "نشط" : "غير نشط"}
                      </Badge>
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <>
                              <Link href={`/ar/products/${row.id}/edit`}>
                                <Button size="icon" variant="ghost" title="تعديل">
                                  <Edit size={15} />
                                </Button>
                              </Link>
                              <Button
                                size="icon"
                                variant="ghost"
                                title={row.isActive ? "تعطيل" : "تفعيل"}
                                onClick={() => handleToggle(row.id)}
                                disabled={isPending}
                              >
                                {row.isActive ? <ToggleLeft size={15} /> : <ToggleRight size={15} className="text-brand-600" />}
                              </Button>
                            </>
                          )}
                          {canDelete && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="حذف"
                              className="text-danger-600 hover:text-danger-700 hover:bg-danger-50"
                              onClick={() => handleDelete(row.id, row.nameAr)}
                              disabled={isPending}
                            >
                              <Trash2 size={15} />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
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
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => updateParam("page", String(page - 1))}
              >
                السابق
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pageCount}
                onClick={() => updateParam("page", String(page + 1))}
              >
                التالي
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
