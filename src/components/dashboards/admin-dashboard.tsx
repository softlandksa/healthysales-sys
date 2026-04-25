import { ShoppingCart, MapPin, Wallet, Users, Activity, AlertTriangle } from "lucide-react";
import NextLink from "next/link";
import { prisma } from "@/lib/db/prisma";
import { StatCard } from "@/components/kpi/stat-card";
import { currentMonthPeriod } from "@/lib/targets/periods";
import { formatSAR, formatNumber } from "@/lib/utils";

export async function AdminDashboard() {
  const now   = new Date();
  const month = currentMonthPeriod(now);
  const { periodStart, periodEnd } = month;

  const [salesAgg, prevSalesAgg, collectionsAgg, visitsCount, activeUsers, recentAudit] =
    await Promise.all([
      prisma.salesOrder.aggregate({
        where: { status: "collected", collectedAt: { gte: periodStart, lte: periodEnd } },
        _sum: { total: true },
      }),
      prisma.salesOrder.aggregate({
        where: {
          status: "collected",
          collectedAt: {
            gte: new Date(periodStart.getTime() - 30 * 24 * 60 * 60 * 1000),
            lt:  periodStart,
          },
        },
        _sum: { total: true },
      }),
      prisma.collection.aggregate({
        where: { isCancelled: false, collectedAt: { gte: periodStart, lte: periodEnd } },
        _sum: { amount: true },
      }),
      prisma.visit.count({ where: { visitedAt: { gte: periodStart, lte: periodEnd } } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          action: true,
          entityType: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      }),
    ]);

  const sales      = Number(salesAgg._sum.total ?? 0);
  const prevSales  = Number(prevSalesAgg._sum.total ?? 0);
  const colls      = Number(collectionsAgg._sum.amount ?? 0);
  const salesDelta = prevSales > 0 ? ((sales - prevSales) / prevSales) * 100 : 0;

  // System health counts
  const now90   = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const [openTasks, activeCompetitions, pendingOrders, nearExpiryCount, expiredCount] = await Promise.all([
    prisma.task.count({ where: { status: { in: ["pending", "in_progress", "blocked"] } } }),
    prisma.competition.count({ where: { status: "active" } }),
    prisma.salesOrder.count({ where: { status: { in: ["confirmed", "delivered"] } } }),
    prisma.salesOrderItem.count({
      where: {
        expiryDate: { gt: now, lte: now90 },
        order: { status: { in: ["delivered", "collected"] } },
      },
    }),
    prisma.salesOrderItem.count({
      where: {
        expiryDate: { lt: now },
        order: { status: { in: ["delivered", "collected"] } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      {/* Global KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي المبيعات"
          value={formatSAR(sales)}
          delta={salesDelta}
          icon={ShoppingCart}
          iconColor="text-brand-600"
          iconBg="bg-brand-50"
        />
        <StatCard
          label="إجمالي التحصيلات"
          value={formatSAR(colls)}
          icon={Wallet}
          iconColor="text-success-600"
          iconBg="bg-success-50"
        />
        <StatCard
          label="إجمالي الزيارات"
          value={formatNumber(visitsCount)}
          icon={MapPin}
          iconColor="text-warning-600"
          iconBg="bg-warning-50"
        />
        <StatCard
          label="المستخدمون النشطون"
          value={formatNumber(activeUsers)}
          icon={Users}
          iconColor="text-chart-5"
          iconBg="bg-purple-50"
        />
      </div>

      {/* System health */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">صحة النظام</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-bold num text-text-primary">{formatNumber(openTasks)}</p>
            <p className="text-sm text-text-secondary">مهام مفتوحة</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-bold num text-text-primary">{formatNumber(activeCompetitions)}</p>
            <p className="text-sm text-text-secondary">منافسات جارية</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-bold num text-text-primary">{formatNumber(pendingOrders)}</p>
            <p className="text-sm text-text-secondary">طلبات معلقة</p>
          </div>
          <NextLink href="/ar/reports/expiry?status=warning" className="flex flex-col gap-1 group">
            <div className="flex items-center gap-1.5">
              <p className={`text-2xl font-bold num ${nearExpiryCount > 0 ? "text-warning-600" : "text-text-primary"}`}>
                {formatNumber(nearExpiryCount)}
              </p>
              {nearExpiryCount > 0 && <AlertTriangle size={16} className="text-warning-500" />}
            </div>
            <p className="text-sm text-text-secondary group-hover:text-brand-600 transition-colors">قرب الانتهاء</p>
          </NextLink>
          <NextLink href="/ar/reports/expiry?status=expired" className="flex flex-col gap-1 group">
            <div className="flex items-center gap-1.5">
              <p className={`text-2xl font-bold num ${expiredCount > 0 ? "text-danger-600" : "text-text-primary"}`}>
                {formatNumber(expiredCount)}
              </p>
              {expiredCount > 0 && <AlertTriangle size={16} className="text-danger-500" />}
            </div>
            <p className="text-sm text-text-secondary group-hover:text-brand-600 transition-colors">منتهي الصلاحية</p>
          </NextLink>
        </div>
      </div>

      {/* Recent audit log */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-text-secondary" />
          <h3 className="text-sm font-semibold text-text-primary">آخر النشاطات</h3>
        </div>
        <div className="divide-y divide-border">
          {recentAudit.map((log) => (
            <div key={log.id} className="flex items-center justify-between py-2.5 gap-4">
              <div className="min-w-0">
                <p className="text-sm text-text-primary truncate">
                  <span className="font-medium">{log.user?.name ?? "النظام"}</span>
                  {" · "}
                  <span className="text-text-secondary">{log.action}</span>
                </p>
                <p className="text-xs text-text-secondary">{log.entityType}</p>
              </div>
              <time className="text-xs text-text-secondary whitespace-nowrap num">
                {log.createdAt.toLocaleDateString("ar-SA")}
              </time>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
