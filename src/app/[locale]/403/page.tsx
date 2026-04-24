import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import Link from "next/link";

export const metadata: Metadata = { title: "403 — غير مصرح" };

interface Props { params: Promise<{ locale: string }> }

export default async function ForbiddenPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-surface-1 p-4">
      <div className="text-center max-w-sm">
        <div className="text-6xl font-bold text-danger-500 num mb-4">403</div>
        <h1 className="text-xl font-bold text-text-primary mb-2">غير مصرح لك بالوصول</h1>
        <p className="text-text-secondary text-sm mb-6">
          ليس لديك الصلاحية للوصول إلى هذه الصفحة. تواصل مع مدير النظام إذا كنت تعتقد أن هناك خطأً.
        </p>
        <Link
          href="/ar/dashboard"
          className="inline-flex items-center justify-center rounded-button bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
