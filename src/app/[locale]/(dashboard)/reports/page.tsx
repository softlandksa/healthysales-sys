import type { Metadata } from "next";
import Link from "next/link";
import {
  User, Users, ShoppingBag, Package, Wallet, Trophy, Activity,
} from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "التقارير" };

const REPORTS = [
  {
    href:  "/ar/reports/rep",
    icon:  User,
    title: "تقرير المندوب",
    desc:  "أداء مندوب بعينه: مبيعات، تحصيلات، زيارات، أفضل عملاء ومنتجات",
    color: "bg-brand-50 text-brand-600",
    roles: ["admin", "general_manager", "sales_manager", "team_manager", "sales_rep"],
  },
  {
    href:  "/ar/reports/team",
    icon:  Users,
    title: "تقرير الفرق",
    desc:  "مقارنة الفرق ومندوبيها خلال فترة زمنية",
    color: "bg-success-50 text-success-600",
    roles: ["admin", "general_manager", "sales_manager", "team_manager"],
  },
  {
    href:  "/ar/reports/customers",
    icon:  ShoppingBag,
    title: "تقرير العملاء",
    desc:  "أكثر العملاء شراءً، أعلى الأرصدة، تحليل ABC/باريتو",
    color: "bg-warning-50 text-warning-600",
    roles: ["admin", "general_manager", "sales_manager", "team_manager", "sales_rep"],
  },
  {
    href:  "/ar/reports/expiry",
    icon:  Package,
    title: "تقرير الصلاحية",
    desc:  "منتجات على وشك الانتهاء الصلاحية مع تصنيف الأولوية",
    color: "bg-danger-50 text-danger-600",
    roles: ["admin", "general_manager", "sales_manager", "team_manager", "sales_rep"],
  },
  {
    href:  "/ar/reports/collections",
    icon:  Wallet,
    title: "تقرير التحصيلات",
    desc:  "توزيع طرق الدفع، أفضل المحصّلين، الاتجاهات الشهرية",
    color: "bg-purple-50 text-purple-600",
    roles: ["admin", "general_manager", "sales_manager", "team_manager", "sales_rep"],
  },
  {
    href:  "/ar/reports/competitions",
    icon:  Trophy,
    title: "تقرير المسابقات",
    desc:  "تاريخ المسابقات، الفائزون، الأداء التراكمي",
    color: "bg-amber-50 text-amber-600",
    roles: ["admin", "general_manager", "sales_manager", "team_manager", "sales_rep"],
  },
  {
    href:  "/ar/reports/heatmap",
    icon:  Activity,
    title: "خريطة النشاط",
    desc:  "توزيع الزيارات حسب اليوم والساعة لكشف أوقات الذروة",
    color: "bg-teal-50 text-teal-600",
    roles: ["admin", "general_manager", "sales_manager", "team_manager"],
  },
] as const;

export default async function ReportsHubPage() {
  const user = await requireUser();

  const visible = REPORTS.filter((r) => (r.roles as readonly string[]).includes(user.role));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">التقارير</h1>
        <p className="text-sm text-text-secondary mt-1">اختر التقرير الذي تريد عرضه</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {visible.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="card p-5 flex gap-4 hover:border-brand-300 hover:shadow-elev transition-all group"
          >
            <div className={`p-2.5 rounded-card shrink-0 ${r.color}`}>
              <r.icon size={20} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-text-primary group-hover:text-brand-700 transition-colors">
                {r.title}
              </p>
              <p className="text-sm text-text-secondary mt-0.5 leading-snug">{r.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
