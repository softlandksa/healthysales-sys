import { Activity, AlertTriangle } from "lucide-react";
import NextLink from "next/link";
import { prisma } from "@/lib/prisma";
import { DashboardSummary } from "@/components/dashboard/DashboardSummary";
import { formatNumber } from "@/lib/utils";

export async function AdminDashboard() {
  const now = new Date();

  const [openTasksR, activeCompR, pendingOrdersR, recentAuditR] = await Promise.allSettled([
    prisma.task.count({ where: { status: { in: ["pending", "in_progress", "blocked"] } } }),
    prisma.competition.count({ where: { status: "active" } }),
    prisma.salesOrder.count({ where: { status: { in: ["confirmed", "delivered"] } } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true, action: true, entityType: true, createdAt: true,
        user: { select: { name: true } },
      },
    }),
  ] as const);

  const openTasks       = openTasksR.status    === "fulfilled" ? openTasksR.value    : 0;
  const activeComp      = activeCompR.status   === "fulfilled" ? activeCompR.value   : 0;
  const pendingOrders   = pendingOrdersR.status === "fulfilled" ? pendingOrdersR.value : 0;
  const recentAudit     = recentAuditR.status  === "fulfilled" ? recentAuditR.value  : [];

  const now90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const [nearExpiryR, expiredR] = await Promise.allSettled([
    prisma.salesOrderItem.count({
      where: { expiryDate: { gt: now, lte: now90 }, order: { status: { in: ["delivered", "collected"] } } },
    }),
    prisma.salesOrderItem.count({
      where: { expiryDate: { lt: now }, order: { status: { in: ["delivered", "collected"] } } },
    }),
  ] as const);
  const nearExpiry = nearExpiryR.status === "fulfilled" ? nearExpiryR.value : 0;
  const expired    = expiredR.status    === "fulfilled" ? expiredR.value    : 0;

  return (
    <div className="space-y-6">
      <DashboardSummary />

      {/* System health */}
      <div className="card p-5 space-y-4" style={{ background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 70%)" }}>
        <h3 className="text-sm font-bold text-text-primary">صحة النظام</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-bold num text-text-primary">{formatNumber(openTasks)}</p>
            <p className="text-sm text-text-secondary">مهام مفتوحة</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-bold num text-text-primary">{formatNumber(activeComp)}</p>
            <p className="text-sm text-text-secondary">منافسات جارية</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-bold num text-text-primary">{formatNumber(pendingOrders)}</p>
            <p className="text-sm text-text-secondary">طلبات معلقة</p>
          </div>
          <NextLink href="/ar/reports/expiry?status=warning" className="flex flex-col gap-1 group">
            <div className="flex items-center gap-1.5">
              <p className={`text-2xl font-bold num ${nearExpiry > 0 ? "text-warning-600" : "text-text-primary"}`}>
                {formatNumber(nearExpiry)}
              </p>
              {nearExpiry > 0 && <AlertTriangle size={16} className="text-warning-500" />}
            </div>
            <p className="text-sm text-text-secondary group-hover:text-brand-600 transition-colors">قرب الانتهاء</p>
          </NextLink>
          <NextLink href="/ar/reports/expiry?status=expired" className="flex flex-col gap-1 group">
            <div className="flex items-center gap-1.5">
              <p className={`text-2xl font-bold num ${expired > 0 ? "text-danger-600" : "text-text-primary"}`}>
                {formatNumber(expired)}
              </p>
              {expired > 0 && <AlertTriangle size={16} className="text-danger-500" />}
            </div>
            <p className="text-sm text-text-secondary group-hover:text-brand-600 transition-colors">منتهي الصلاحية</p>
          </NextLink>
        </div>
      </div>

      {/* Recent audit log */}
      <div className="card p-5 space-y-4" style={{ background: "linear-gradient(135deg, #eef2ff 0%, #ffffff 70%)" }}>
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-indigo-500" />
          <h3 className="text-sm font-bold text-text-primary">آخر النشاطات</h3>
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
