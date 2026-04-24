import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { VisitForm } from "@/components/visits/VisitForm";

export const metadata: Metadata = { title: "زيارة جديدة" };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ customerId?: string; customerName?: string }>;
}

export default async function NewVisitPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { customerId, customerName } = await searchParams;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("create", "Visit")) redirect("/ar/dashboard");

  return (
    <div className="min-h-full flex flex-col">
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: "الرئيسية", href: "/ar/dashboard" },
            { label: "الزيارات", href: "/ar/visits" },
            { label: "زيارة جديدة" },
          ]}
        />
        <h1 className="text-2xl font-bold text-text-primary mt-2">زيارة جديدة</h1>
      </div>

      <div className="flex-1 flex items-start justify-center">
        <div className="w-full max-w-md">
          <div className="card p-6">
            <VisitForm
              {...(customerId !== undefined && { prefilledCustomerId: customerId })}
              {...(customerName !== undefined && { prefilledCustomerName: customerName })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
