import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export const metadata: Metadata = { title: "الإعدادات" };

interface Props { params: Promise<{ locale: string }> }

export default async function SettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb items={[{ label: "الرئيسية", href: "/ar/dashboard" }, { label: "الإعدادات" }]} />
        <h1 className="text-2xl font-bold text-text-primary mt-2">الإعدادات</h1>
      </div>
      <div className="card p-8 text-center text-text-muted">
        <p>الإعدادات قيد التطوير — ستكون متاحة في مرحلة لاحقة</p>
      </div>
    </div>
  );
}
