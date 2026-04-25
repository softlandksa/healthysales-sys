import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { prisma } from "@/lib/db/prisma";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ProductForm } from "@/components/products/ProductForm";

export const metadata: Metadata = { title: "منتج جديد" };

interface Props { params: Promise<{ locale: string }> }

export default async function NewProductPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("create", "Product")) redirect("/ar/products");

  const unitRows = await prisma.productUnit.findMany({
    where: { isActive: true },
    orderBy: { nameAr: "asc" },
    select: { nameAr: true },
  });
  const units = unitRows.map((u) => u.nameAr);

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: "الرئيسية", href: "/ar/dashboard" },
            { label: "المنتجات", href: "/ar/products" },
            { label: "منتج جديد" },
          ]}
        />
        <h1 className="text-2xl font-bold text-text-primary mt-2">منتج جديد</h1>
      </div>
      <ProductForm mode="create" units={units} />
    </div>
  );
}
