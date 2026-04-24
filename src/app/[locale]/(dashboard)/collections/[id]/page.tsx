import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { getCollectionDetail } from "@/server/actions/collections";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { CollectionDetail } from "@/components/collections/CollectionDetail";
import type { PaymentMethod } from "@/types";

export const metadata: Metadata = { title: "تفاصيل التحصيل" };

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export default async function CollectionDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const currentUser = await requireUser();
  const ability = defineAbilitiesFor(currentUser);
  if (!ability.can("read", "Collection")) redirect("/ar/dashboard");

  const canCancel = ["admin", "general_manager"].includes(currentUser.role);

  const col = await getCollectionDetail(id).catch(() => null);
  if (!col) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: "الرئيسية", href: "/ar/dashboard" },
            { label: "التحصيلات", href: "/ar/collections" },
            { label: col.code },
          ]}
        />
        <h1 className="text-2xl font-bold text-text-primary mt-2 num">{col.code}</h1>
      </div>

      <CollectionDetail
        id={col.id}
        code={col.code}
        amount={col.amount.toFixed(2)}
        method={col.method as PaymentMethod}
        reference={col.reference}
        notes={col.notes}
        cancelReason={col.cancelReason}
        isCancelled={col.isCancelled}
        cancelledAt={col.cancelledAt}
        collectedAt={col.collectedAt}
        customer={{
          id: col.customer.id,
          code: col.customer.code,
          nameAr: col.customer.nameAr,
        }}
        rep={col.rep}
        visit={col.visit ? { id: col.visit.id, code: col.visit.code } : null}
        canCancel={canCancel}
      />
    </div>
  );
}
