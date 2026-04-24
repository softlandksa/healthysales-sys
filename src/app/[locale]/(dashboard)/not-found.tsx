import Link from "next/link";
import { Search } from "lucide-react";

export default function DashboardNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4 text-center p-8">
      <p className="text-6xl font-bold text-surface-3 select-none" aria-hidden>404</p>
      <div>
        <h2 className="text-lg font-semibold text-text-primary">الصفحة غير موجودة</h2>
        <p className="text-sm text-text-secondary mt-1">
          العنصر الذي تبحث عنه غير موجود أو ليس لديك صلاحية الوصول إليه.
        </p>
      </div>
      <div className="flex gap-2">
        <Link
          href="/ar/dashboard"
          className="px-4 py-2 bg-brand-600 text-white text-sm rounded-button hover:bg-brand-700 transition-colors"
        >
          الرئيسية
        </Link>
        <Link
          href="/ar/customers"
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-border text-text-secondary text-sm rounded-button hover:bg-surface-1 transition-colors"
        >
          <Search size={14} />
          بحث
        </Link>
      </div>
    </div>
  );
}
