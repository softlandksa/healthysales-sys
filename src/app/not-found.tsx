import Link from "next/link";
import { Search } from "lucide-react";

export default function NotFound() {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          {/* Large 404 */}
          <p className="text-8xl font-bold text-slate-200 select-none mb-4" aria-hidden>404</p>
          <h1 className="text-xl font-bold text-slate-900 mb-2">الصفحة غير موجودة</h1>
          <p className="text-slate-600 text-sm mb-6">
            الرابط الذي تبحث عنه غير موجود أو تم نقله.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/ar/dashboard"
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              الصفحة الرئيسية
            </Link>
            <Link
              href="/ar/customers"
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Search size={14} />
              تصفح العملاء
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
