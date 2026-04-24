import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { prisma } from "@/lib/db/prisma";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ProductForm } from "@/components/products/ProductForm";

export const metadata: Metadata = { title: "تعديل المنتج" };

interface Props { params: Promise<{ locale: string; id: string }> }

export default async function EditProductPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("update", "Product")) redirect("/ar/products");

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true, code: true, nameAr: true, nameEn: true,
      description: true, unit: true, price: true, isActive: true,
    },
  });

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: "الرئيسية", href: "/ar/dashboard" },
            { label: "المنتجات", href: "/ar/products" },
            { label: product.nameAr },
          ]}
        />
        <h1 className="text-2xl font-bold text-text-primary mt-2">تعديل المنتج</h1>
        <p className="text-sm text-text-secondary">{product.code}</p>
      </div>
      <ProductForm
        mode="edit"
        productId={id}
        defaultValues={{
          code: product.code,
          nameAr: product.nameAr,
          ...(product.nameEn !== null && { nameEn: product.nameEn }),
          ...(product.description !== null && { description: product.description }),
          unit: product.unit,
          price: product.price.toFixed(2),
          isActive: product.isActive,
        }}
      />
    </div>
  );
}
