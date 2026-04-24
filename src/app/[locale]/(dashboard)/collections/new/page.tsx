import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { CollectionForm } from "@/components/collections/CollectionForm";

export const metadata: Metadata = { title: "تحصيل جديد" };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ customerId?: string; customerName?: string; visitId?: string }>;
}

export default async function NewCollectionPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { customerId, customerName, visitId } = await searchParams;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("create", "Collection")) redirect("/ar/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: "الرئيسية", href: "/ar/dashboard" },
            { label: "التحصيلات", href: "/ar/collections" },
            { label: "تحصيل جديد" },
          ]}
        />
        <h1 className="text-2xl font-bold text-text-primary mt-2">تحصيل جديد</h1>
      </div>

      <div className="max-w-lg">
        <div className="card p-6">
          <CollectionForm
            {...(customerId !== undefined && { prefilledCustomerId: customerId })}
            {...(customerName !== undefined && { prefilledCustomerName: customerName })}
            {...(visitId !== undefined && { prefilledVisitId: visitId })}
          />
        </div>
      </div>
    </div>
  );
}
