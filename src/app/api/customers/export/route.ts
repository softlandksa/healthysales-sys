import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { getAccessibleUserIds } from "@/lib/rbac/access";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";

const BLUE  = "FF2563EB";
const WHITE = "FFFFFFFF";
const GREY  = "FFF8FAFC";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  const ability = defineAbilitiesFor(user);
  if (!ability.can("read", "Customer")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Build role-scoped where clause
  let scopedWhere = {};
  if (user.role !== "admin" && user.role !== "general_manager") {
    if (user.role === "sales_manager" || user.role === "team_manager") {
      const accessibleIds = await getAccessibleUserIds(user);
      const teams = await prisma.team.findMany({
        where: { members: { some: { id: { in: accessibleIds } } } },
        select: { id: true },
      });
      scopedWhere = { teamId: { in: teams.map((t) => t.id) } };
    } else {
      scopedWhere = { assignedToId: user.id };
    }
  }

  const customers = await prisma.customer.findMany({
    where: scopedWhere,
    orderBy: { nameAr: "asc" },
    select: {
      code: true, nameAr: true, nameEn: true,
      phone: true, phone2: true, address: true, notes: true,
      openingBalance: true, balance: true, creditLimit: true,
      isActive: true, createdAt: true,
      assignedTo: { select: { name: true } },
      team:       { select: { nameAr: true } },
      region:     { select: { nameAr: true } },
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "نظام المبيعات الميداني";
  wb.created = new Date();

  const ws = wb.addWorksheet("العملاء", { views: [{ rightToLeft: true }] });

  ws.columns = [
    { header: "الكود",              key: "code",           width: 15 },
    { header: "الاسم بالعربي",      key: "nameAr",         width: 35 },
    { header: "الاسم بالإنجليزي",   key: "nameEn",         width: 35 },
    { header: "الهاتف",             key: "phone",          width: 18 },
    { header: "الهاتف 2",           key: "phone2",         width: 18 },
    { header: "العنوان",            key: "address",        width: 45 },
    { header: "الملاحظات",          key: "notes",          width: 40 },
    { header: "الرصيد الافتتاحي",   key: "openingBalance", width: 22 },
    { header: "الرصيد الحالي",      key: "balance",        width: 22 },
    { header: "حد الائتمان",        key: "creditLimit",    width: 22 },
    { header: "نشط",                key: "isActive",       width: 10 },
    { header: "المندوب",            key: "rep",            width: 25 },
    { header: "الفريق",             key: "team",           width: 25 },
    { header: "المنطقة",            key: "region",         width: 25 },
    { header: "تاريخ الإنشاء",      key: "createdAt",      width: 22 },
  ];

  const hdr = ws.getRow(1);
  hdr.font      = { bold: true, color: { argb: WHITE }, size: 11 };
  hdr.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  hdr.alignment = { horizontal: "right", vertical: "middle" };
  hdr.height    = 24;

  customers.forEach((c, i) => {
    const row = ws.addRow({
      code:           c.code,
      nameAr:         c.nameAr,
      nameEn:         c.nameEn ?? "",
      phone:          c.phone ?? "",
      phone2:         c.phone2 ?? "",
      address:        c.address ?? "",
      notes:          c.notes ?? "",
      openingBalance: c.openingBalance.toNumber(),
      balance:        c.balance.toNumber(),
      creditLimit:    c.creditLimit?.toNumber() ?? 0,
      isActive:       c.isActive ? "نعم" : "لا",
      rep:            c.assignedTo?.name ?? "",
      team:           c.team?.nameAr ?? "",
      region:         c.region?.nameAr ?? "",
      createdAt:      c.createdAt.toLocaleDateString("ar-SA"),
    });
    if (i % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREY } };
    }
    row.alignment = { horizontal: "right" };
  });

  for (const col of ["openingBalance", "balance", "creditLimit"]) {
    ws.getColumn(col).numFmt = '#,##0.00 "ر.س"';
  }

  const rawBuf = await wb.xlsx.writeBuffer();
  const date   = new Date().toISOString().slice(0, 10);
  const blob   = new Blob([rawBuf as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return new NextResponse(blob, {
    headers: {
      "Content-Disposition": `attachment; filename*=UTF-8''customers-${date}.xlsx`,
    },
  });
}
