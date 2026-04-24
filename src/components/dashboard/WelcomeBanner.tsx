import { formatSAR } from "@/lib/utils";

export default function WelcomeBanner() {
  return (
    <div className="rounded-card bg-gradient-to-l from-brand-600 to-brand-800 p-6 text-white">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">مرحباً بك في نظام المبيعات الميداني</h2>
          <p className="mt-1 text-brand-200 text-sm">
            الأربعاء، ٢٣ أبريل ٢٠٢٦ — نظرة عامة على أداء الفريق
          </p>
        </div>
        <div className="bg-white/10 rounded-card px-5 py-3 text-center min-w-32">
          <p className="text-xs text-brand-200 mb-1">هدف الشهر</p>
          <p className="text-2xl font-bold num">{formatSAR(500000)}</p>
        </div>
      </div>
    </div>
  );
}
