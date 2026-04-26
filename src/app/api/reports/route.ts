import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { getAccessibleUserIds } from "@/lib/rbac/access";
import { buildRepReport }           from "@/lib/reports/builders/rep-report";
import { buildTeamReport }          from "@/lib/reports/builders/team-report";
import { buildCustomersReport }     from "@/lib/reports/builders/customers-report";
import { buildExpiryReport }        from "@/lib/reports/builders/expiry-report";
import { buildCollectionsReport }   from "@/lib/reports/builders/collections-report";
import { buildCompetitionsReport }  from "@/lib/reports/builders/competitions-report";
import { buildActivityHeatmap }     from "@/lib/reports/builders/activity-heatmap";
import { prisma } from "@/lib/db/prisma";
import {
  PAYMENT_METHOD_LABELS, VISIT_TYPE_LABELS, TASK_STATUS_LABELS,
  TARGET_METRIC_LABELS, TARGET_PERIOD_LABELS,
} from "@/types";
import type { SessionUser, VisitType, TaskStatus, TargetMetric } from "@/types";

const BLUE   = "FF2563EB";
const WHITE  = "FFFFFFFF";
const GREY   = "FFF8FAFC";
const HEADER = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } } as const;
const ALT    = { type: "pattern", pattern: "solid", fgColor: { argb: GREY  } } as const;
const SAR_FMT = '#,##0.00 "ر.س"';

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: WHITE } };
  row.fill = HEADER;
  row.alignment = { horizontal: "right" };
}

function parseDate(s: string | null): Date {
  if (!s) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(s);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionUser = session.user as SessionUser;
  const ability     = defineAbilitiesFor(sessionUser);
  if (!ability.can("read", "Report")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp     = req.nextUrl.searchParams;
  const type   = sp.get("type") ?? "rep";
  const format = sp.get("format") ?? "xlsx";
  const from   = parseDate(sp.get("from"));
  const to     = parseDate(sp.get("to"));
  to.setHours(23, 59, 59, 999);

  const accessible = await getAccessibleUserIds(sessionUser);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Field Sales System";
  workbook.created = new Date();

  let filename = `report-${type}-${format}`;

  // ── Build data + sheet per report type ─────────────────────────────────────

  if (type === "rep") {
    const repId = sp.get("repId") ?? sessionUser.id;
    if (sessionUser.role === "sales_rep" && repId !== sessionUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data   = await buildRepReport({ repId, from, to }, accessible);
    filename     = `rep-report-${data.rep.name ?? repId}`;
    const sheet  = workbook.addWorksheet("تقرير المندوب", { views: [{ rightToLeft: true }] });

    sheet.addRow([`تقرير المندوب: ${data.rep.name ?? repId}`]).font = { bold: true, size: 14 };
    sheet.addRow([`الفترة: ${from.toLocaleDateString("en-SA")} إلى ${to.toLocaleDateString("en-SA")}`]);
    sheet.addRow([]);
    sheet.addRow(["إجمالي المبيعات", "إجمالي التحصيلات", "عدد الزيارات", "عدد الطلبات", "متوسط الطلب"]);
    styleHeader(sheet.lastRow!);
    sheet.addRow([
      data.summary.totalSales,
      data.summary.totalCollections,
      data.summary.totalVisits,
      data.summary.totalOrders,
      data.summary.avgOrderValue,
    ]);
    ["B", "C"].forEach((col) => {
      sheet.getColumn(col).numFmt = SAR_FMT;
      sheet.getColumn(col).width  = 18;
    });
    sheet.addRow([]);

    // Monthly trend
    sheet.addRow(["الشهر", "المبيعات", "التحصيلات", "الزيارات"]).font = { bold: true };
    data.monthlyTrend.forEach((m, i) => {
      const r = sheet.addRow([m.month, m.sales, m.collections, m.visits]);
      if (i % 2 === 1) r.fill = ALT;
    });
    sheet.addRow([]);

    // Top customers
    sheet.addRow(["أفضل العملاء", "المبيعات", "الزيارات"]).font = { bold: true };
    data.topCustomers.forEach((c, i) => {
      const r = sheet.addRow([c.customerName, c.sales, c.visits]);
      if (i % 2 === 1) r.fill = ALT;
    });

  } else if (type === "team") {
    const teamId = sp.get("teamId") ?? undefined;
    const data   = await buildTeamReport({ from, to, ...(teamId ? { teamId } : {}) }, accessible);
    filename     = "team-report";
    const sheet  = workbook.addWorksheet("تقرير الفرق", { views: [{ rightToLeft: true }] });

    sheet.addRow(["تقرير الفرق"]).font = { bold: true, size: 14 };
    sheet.addRow([`الفترة: ${from.toLocaleDateString("en-SA")} إلى ${to.toLocaleDateString("en-SA")}`]);
    sheet.addRow([]);
    sheet.addRow(["الفريق", "المبيعات", "التحصيلات", "الزيارات", "عدد المندوبين"]);
    styleHeader(sheet.lastRow!);
    data.teams.forEach((t, i) => {
      const r = sheet.addRow([t.teamName, t.sales, t.collections, t.visits, t.repCount]);
      if (i % 2 === 1) r.fill = ALT;
    });
    sheet.addRow([]);
    sheet.addRow(["المندوب", "الفريق", "المبيعات", "التحصيلات", "الزيارات"]);
    styleHeader(sheet.lastRow!);
    data.reps.forEach((r, i) => {
      const row = sheet.addRow([r.repName ?? r.repId, r.teamName, r.sales, r.collections, r.visits]);
      if (i % 2 === 1) row.fill = ALT;
    });

  } else if (type === "customers") {
    const repId  = sp.get("repId") ?? (sessionUser.role === "sales_rep" ? sessionUser.id : undefined);
    const teamId = sp.get("teamId") ?? undefined;
    const data   = await buildCustomersReport(
      { from, to, ...(repId ? { repId } : {}), ...(teamId ? { teamId } : {}) },
      accessible
    );
    filename     = "customers-report";
    const sheet  = workbook.addWorksheet("تقرير العملاء", { views: [{ rightToLeft: true }] });

    sheet.addRow(["تقرير العملاء"]).font = { bold: true, size: 14 };
    sheet.addRow([]);
    sheet.addRow(["العميل", "المبيعات", "عدد الطلبات", "التصنيف"]);
    styleHeader(sheet.lastRow!);
    data.topBuyers.forEach((b, i) => {
      const r = sheet.addRow([b.name, b.sales, b.orders, b.category]);
      if (i % 2 === 1) r.fill = ALT;
    });
    sheet.addRow([]);
    sheet.addRow(["العميل ذو رصيد", "الرصيد", "حد الائتمان", "المندوب"]);
    styleHeader(sheet.lastRow!);
    data.highBalances.forEach((b, i) => {
      const r = sheet.addRow([b.name, b.balance, b.creditLimit ?? "", b.repName ?? ""]);
      if (i % 2 === 1) r.fill = ALT;
    });

  } else if (type === "expiry") {
    const repId = sp.get("repId") ?? (sessionUser.role === "sales_rep" ? sessionUser.id : undefined);
    const status = sp.get("status") ?? undefined;
    const data   = await buildExpiryReport(
      { from, to, ...(repId ? { repId } : {}), ...(status ? { status: status as "fresh" | "warning" | "critical" | "expired" } : {}) },
      accessible
    );
    filename     = "expiry-report";
    const sheet  = workbook.addWorksheet("تقرير الصلاحية", { views: [{ rightToLeft: true }] });

    sheet.addRow(["تقرير صلاحية المنتجات"]).font = { bold: true, size: 14 };
    sheet.addRow([]);
    sheet.addRow(["الطلب", "المنتج", "الكود", "المندوب", "الكمية", "تاريخ الانتهاء", "الأيام المتبقية", "الحالة"]);
    styleHeader(sheet.lastRow!);
    data.items.forEach((item, i) => {
      const r = sheet.addRow([
        item.orderCode,
        item.productName,
        item.productCode,
        item.repName ?? "",
        item.quantity,
        item.expiryDate.toLocaleDateString("en-SA"),
        item.daysUntilExpiry,
        item.status,
      ]);
      if (i % 2 === 1) r.fill = ALT;
    });

  } else if (type === "collections") {
    const repId = sp.get("repId") ?? (sessionUser.role === "sales_rep" ? sessionUser.id : undefined);
    const data  = await buildCollectionsReport(
      { from, to, ...(repId ? { repId } : {}) },
      accessible
    );
    filename    = "collections-report";
    const sheet = workbook.addWorksheet("تقرير التحصيلات", { views: [{ rightToLeft: true }] });

    sheet.addRow(["تقرير التحصيلات"]).font = { bold: true, size: 14 };
    sheet.addRow([]);
    sheet.addRow(["طريقة الدفع", "المبلغ الإجمالي", "عدد المعاملات", "النسبة %"]);
    styleHeader(sheet.lastRow!);
    data.byMethod.forEach((m, i) => {
      const r = sheet.addRow([m.label, m.amount, m.count, `${m.pct}%`]);
      if (i % 2 === 1) r.fill = ALT;
    });
    sheet.addRow([]);
    sheet.addRow(["أفضل المحصّلين", "المبلغ", "عدد العمليات"]).font = { bold: true };
    data.topCollectors.forEach((c, i) => {
      const r = sheet.addRow([c.repName ?? c.repId, c.amount, c.count]);
      if (i % 2 === 1) r.fill = ALT;
    });
    void PAYMENT_METHOD_LABELS;

  } else if (type === "competitions") {
    const status = sp.get("status") ?? undefined;
    const data   = await buildCompetitionsReport(
      { from, to, ...(status ? { status } : {}) }
    );
    filename     = "competitions-report";
    const sheet  = workbook.addWorksheet("تقرير المسابقات", { views: [{ rightToLeft: true }] });

    sheet.addRow(["تقرير المسابقات"]).font = { bold: true, size: 14 };
    sheet.addRow([]);
    sheet.addRow(["الاسم", "المنتج", "الحالة", "تاريخ البدء", "تاريخ الانتهاء", "الجائزة", "المشاركون", "الأول", "الثاني", "الثالث"]);
    styleHeader(sheet.lastRow!);
    data.competitions.forEach((c, i) => {
      const winners = ["", "", ""];
      c.winners.forEach((w) => { winners[w.rank - 1] = w.name ?? ""; });
      const r = sheet.addRow([
        c.name, c.productName, c.status,
        c.startDate.toLocaleDateString("en-SA"),
        c.endDate.toLocaleDateString("en-SA"),
        c.prize, c.participantCount,
        ...winners,
      ]);
      if (i % 2 === 1) r.fill = ALT;
    });

  } else if (type === "sales") {
    const repId  = sp.get("repId") ?? (sessionUser.role === "sales_rep" ? sessionUser.id : undefined);
    const status = sp.get("status") ?? undefined;
    const orders = await prisma.salesOrder.findMany({
      where: {
        ...(repId ? { repId } : {}),
        createdAt: { gte: from, lte: to },
        ...(status ? { status: status as "draft" | "confirmed" | "delivered" | "collected" | "cancelled" } : {}),
      },
      include: {
        customer: { select: { nameAr: true, code: true } },
        rep:      { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });
    filename     = "sales-report";
    const sheet  = workbook.addWorksheet("تقرير المبيعات", { views: [{ rightToLeft: true }] });
    sheet.addRow(["تقرير المبيعات"]).font = { bold: true, size: 14 };
    sheet.addRow([`الفترة: ${from.toLocaleDateString("en-SA")} إلى ${to.toLocaleDateString("en-SA")}`]);
    sheet.addRow([]);
    sheet.addRow(["رقم الطلب", "العميل", "المندوب", "الحالة", "الإجمالي", "التاريخ"]);
    styleHeader(sheet.lastRow!);
    orders.forEach((o, i) => {
      const r = sheet.addRow([
        o.code,
        o.customer.nameAr,
        o.rep?.name ?? "",
        o.status,
        Number(o.total),
        o.createdAt.toLocaleDateString("en-SA"),
      ]);
      if (i % 2 === 1) r.fill = ALT;
    });
    sheet.getColumn("E").numFmt = SAR_FMT;

  } else if (type === "visits") {
    const repId      = sp.get("repId") ?? (sessionUser.role === "sales_rep" ? sessionUser.id : undefined);
    const visitType  = sp.get("visitType") ?? undefined;
    const visits     = await prisma.visit.findMany({
      where: {
        ...(repId ? { repId } : {}),
        visitedAt: { gte: from, lte: to },
        ...(visitType ? { visitType: visitType as VisitType } : {}),
      },
      include: {
        customer: { select: { nameAr: true, code: true } },
        rep:      { select: { name: true } },
      },
      orderBy: { visitedAt: "desc" },
      take: 2000,
    });
    filename     = "visits-report";
    const sheet  = workbook.addWorksheet("تقرير الزيارات", { views: [{ rightToLeft: true }] });
    sheet.addRow(["تقرير الزيارات"]).font = { bold: true, size: 14 };
    sheet.addRow([`الفترة: ${from.toLocaleDateString("en-SA")} إلى ${to.toLocaleDateString("en-SA")}`]);
    sheet.addRow([]);
    sheet.addRow(["التاريخ", "العميل", "المندوب", "النوع", "ملاحظات"]);
    styleHeader(sheet.lastRow!);
    visits.forEach((v, i) => {
      const r = sheet.addRow([
        v.visitedAt.toLocaleDateString("en-SA"),
        v.customer.nameAr,
        v.rep?.name ?? "",
        VISIT_TYPE_LABELS[v.visitType as VisitType] ?? v.visitType,
        v.notes ?? "",
      ]);
      if (i % 2 === 1) r.fill = ALT;
    });

  } else if (type === "tasks") {
    const assigneeId = sessionUser.role === "sales_rep" ? sessionUser.id : undefined;
    const statusF    = sp.get("status") ?? undefined;
    const tasks      = await prisma.task.findMany({
      where: {
        ...(assigneeId ? { assignedToId: assigneeId } : {}),
        createdAt: { gte: from, lte: to },
        ...(statusF ? { status: statusF as TaskStatus } : {}),
      },
      include: {
        assignedTo: { select: { name: true } },
        assignedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });
    filename     = "tasks-report";
    const sheet  = workbook.addWorksheet("تقرير المهام", { views: [{ rightToLeft: true }] });
    sheet.addRow(["تقرير المهام"]).font = { bold: true, size: 14 };
    sheet.addRow([`الفترة: ${from.toLocaleDateString("en-SA")} إلى ${to.toLocaleDateString("en-SA")}`]);
    sheet.addRow([]);
    sheet.addRow(["المهمة", "المسند إليه", "المنشئ", "الحالة", "تاريخ الاستحقاق", "تاريخ الإنشاء"]);
    styleHeader(sheet.lastRow!);
    tasks.forEach((t, i) => {
      const r = sheet.addRow([
        t.title,
        t.assignedTo?.name ?? "",
        t.assignedBy?.name ?? "",
        TASK_STATUS_LABELS[t.status as TaskStatus] ?? t.status,
        t.dueDate.toLocaleDateString("en-SA"),
        t.createdAt.toLocaleDateString("en-SA"),
      ]);
      if (i % 2 === 1) r.fill = ALT;
    });

  } else if (type === "products") {
    const activeF   = sp.get("active") ?? undefined;
    const products  = await prisma.product.findMany({
      where: activeF === "active" ? { isActive: true } : activeF === "inactive" ? { isActive: false } : {},
      orderBy: { nameAr: "asc" },
    });
    filename     = "products-report";
    const sheet  = workbook.addWorksheet("تقرير المنتجات", { views: [{ rightToLeft: true }] });
    sheet.addRow(["تقرير المنتجات"]).font = { bold: true, size: 14 };
    sheet.addRow([]);
    sheet.addRow(["الكود", "الاسم", "الوحدة", "السعر", "الحالة"]);
    styleHeader(sheet.lastRow!);
    products.forEach((p, i) => {
      const r = sheet.addRow([
        p.code,
        p.nameAr,
        p.unit,
        Number(p.price) > 0 ? Number(p.price) : "",
        p.isActive ? "نشط" : "غير نشط",
      ]);
      if (i % 2 === 1) r.fill = ALT;
    });
    sheet.getColumn("D").numFmt = SAR_FMT;

  } else if (type === "targets") {
    const userScope  = sessionUser.role === "sales_rep" ? { userId: sessionUser.id } : {};
    const targets    = await prisma.target.findMany({
      where: { ...userScope, periodStart: { gte: from, lte: to } },
      include: { user: { select: { name: true, email: true } } },
      orderBy: [{ periodStart: "desc" }, { metric: "asc" }],
    });
    filename     = "targets-report";
    const sheet  = workbook.addWorksheet("تقرير الأهداف", { views: [{ rightToLeft: true }] });
    sheet.addRow(["تقرير الأهداف"]).font = { bold: true, size: 14 };
    sheet.addRow([`الفترة: ${from.toLocaleDateString("en-SA")} إلى ${to.toLocaleDateString("en-SA")}`]);
    sheet.addRow([]);
    sheet.addRow(["المندوب", "المؤشر", "الهدف", "الفترة", "من", "إلى"]);
    styleHeader(sheet.lastRow!);
    targets.forEach((t, i) => {
      const r = sheet.addRow([
        t.user.name ?? t.user.email,
        TARGET_METRIC_LABELS[t.metric as TargetMetric] ?? t.metric,
        Number(t.value),
        TARGET_PERIOD_LABELS[t.period as keyof typeof TARGET_PERIOD_LABELS] ?? t.period,
        t.periodStart.toLocaleDateString("en-SA"),
        t.periodEnd.toLocaleDateString("en-SA"),
      ]);
      if (i % 2 === 1) r.fill = ALT;
    });

  } else if (type === "heatmap") {
    const repId = sp.get("repId") ?? (sessionUser.role === "sales_rep" ? sessionUser.id : undefined);
    const data  = await buildActivityHeatmap(
      { from, to, ...(repId ? { repId } : {}) },
      accessible
    );
    filename    = "activity-heatmap";
    const sheet = workbook.addWorksheet("خريطة النشاط", { views: [{ rightToLeft: true }] });

    const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    sheet.addRow(["خريطة النشاط — زيارات حسب اليوم والساعة"]).font = { bold: true, size: 14 };
    sheet.addRow([]);
    sheet.addRow(["المندوب", "إجمالي الزيارات"]).font = { bold: true };
    data.repActivity.forEach((r, i) => {
      const row = sheet.addRow([r.repName ?? r.repId, r.totalVisits]);
      if (i % 2 === 1) row.fill = ALT;
    });
    sheet.addRow([]);
    // Heatmap table (DOW × hour)
    sheet.addRow(["اليوم", ...Array.from({ length: 24 }, (_, h) => `${h}:00`)]).font = { bold: true };
    for (let d = 0; d < 7; d++) {
      const hourCounts = Array.from({ length: 24 }, (_, h) => {
        const cell = data.heatmap.find((c) => c.dayOfWeek === d && c.hour === h);
        return cell?.count ?? 0;
      });
      sheet.addRow([DAYS[d], ...hourCounts]);
    }
  }

  // ── Respond ──────────────────────────────────────────────────────────────────

  if (format === "csv") {
    // ExcelJS can output CSV
    const csv = await workbook.csv.writeBuffer();
    return new NextResponse(new Blob([csv as unknown as ArrayBuffer], { type: "text/csv;charset=utf-8" }), {
      headers: {
        "Content-Type":        "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  const raw  = await workbook.xlsx.writeBuffer();
  const blob = new Blob([raw as unknown as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return new NextResponse(blob, {
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
    },
  });
}
