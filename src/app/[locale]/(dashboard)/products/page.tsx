import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Plus, AlertTriangle } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { prisma } from "@/lib/prisma";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Button } from "@/components/ui/button";
import { ProductsTable } from "@/components/products/ProductsTable";
import { ProductExcelActions } from "@/components/products/ProductExcelActions";

export const metadata: Metadata = { title: "المنتجات" };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}

export default async function ProductsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { q = "", page = "1", status = "" } = await searchParams;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("read", "Product")) redirect("/ar/dashboard");

  const canCreate = ability.can("create", "Product");

  const pageSize = 20;
  const pageNum  = Math.max(1, parseInt(page, 10));

  let rows: {
    id: string; code: string; nameAr: string; nameEn: string | null;
    unit: string; price: string; isActive: boolean; createdAt: Date;
  }[] = [];
  let total = 0;
  let pageError: string | null = null;

  try {
    const where = {
      ...(q
        ? {
            OR: [
              { nameAr: { contains: q, mode: "insensitive" as const } },
              { nameEn: { contains: q, mode: "insensitive" as const } },
              { code:   { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(status === "active"
        ? { isActive: true }
        : status === "inactive"
        ? { isActive: false }
        : {}),
    };

    const [products, count] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { nameAr: "asc" },
        skip:    (pageNum - 1) * pageSize,
        take:    pageSize,
        select: {
          id: true, code: true, nameAr: true, nameEn: true,
          unit: true, price: true, isActive: true, createdAt: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    total = count;
    rows  = products.map((p) => ({ ...p, price: p.price.toFixed(2) }));
  } catch {
    pageError = "تعذر تحميل قائمة المنتجات. يرجى المحاولة مجدداً.";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Breadcrumb
            items={[
              { label: "الرئيسية", href: "/ar/dashboard" },
              { label: "المنتجات" },
            ]}
          />
          <h1 className="text-2xl font-bold text-text-primary mt-2">المنتجات</h1>
          {!pageError && (
            <p className="text-sm text-text-secondary mt-0.5">
              <span className="num">{total}</span> منتج
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ProductExcelActions canImport={canCreate} />
          {canCreate && (
            <Link href="/ar/products/new">
              <Button>
                <Plus size={16} />
                منتج جديد
              </Button>
            </Link>
          )}
        </div>
      </div>

      {pageError ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="p-3 rounded-full bg-danger-50">
            <AlertTriangle size={24} className="text-danger-600" />
          </div>
          <p className="text-sm text-text-secondary max-w-sm">{pageError}</p>
        </div>
      ) : (
        <ProductsTable
          rows={rows}
          total={total}
          page={pageNum}
          pageSize={pageSize}
          q={q}
          status={status}
          canEdit={ability.can("update", "Product")}
          canDelete={ability.can("delete", "Product")}
        />
      )}
    </div>
  );
}
