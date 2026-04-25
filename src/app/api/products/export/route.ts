import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/types";

const BLUE  = "FF2563EB";
const WHITE = "FFFFFFFF";
const GREY  = "FFF8FAFC";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  const ability = defineAbilitiesFor(user);
  if (!ability.can("read", "Product")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const products = await prisma.product.findMany({
    orderBy: { nameAr: "asc" },
    select: {
      code: true, nameAr: true, nameEn: true,
      description: true, unit: true, price: true,
      isActive: true, createdAt: true,
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "نظام المبيعات الميداني";
  wb.created = new Date();

  const ws = wb.addWorksheet("المنتجات", { views: [{ rightToLeft: true }] });

  ws.columns = [
    { header: "الكود",              key: "code",        width: 18 },
    { header: "الاسم بالعربي",      key: "nameAr",      width: 35 },
    { header: "الاسم بالإنجليزي",   key: "nameEn",      width: 35 },
    { header: "الوصف",              key: "description", width: 45 },
    { header: "الوحدة",             key: "unit",        width: 18 },
    { header: "السعر",              key: "price",       width: 18 },
    { header: "نشط",                key: "isActive",    width: 10 },
    { header: "تاريخ الإنشاء",      key: "createdAt",   width: 22 },
  ];

  const hdr = ws.getRow(1);
  hdr.font      = { bold: true, color: { argb: WHITE }, size: 11 };
  hdr.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  hdr.alignment = { horizontal: "right", vertical: "middle" };
  hdr.height    = 24;

  products.forEach((p, i) => {
    const row = ws.addRow({
      code:        p.code,
      nameAr:      p.nameAr,
      nameEn:      p.nameEn ?? "",
      description: p.description ?? "",
      unit:        p.unit,
      price:       p.price.toNumber(),
      isActive:    p.isActive ? "نعم" : "لا",
      createdAt:   p.createdAt.toLocaleDateString("ar-SA"),
    });
    if (i % 2 === 1) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREY } };
    }
    row.alignment = { horizontal: "right" };
  });

  ws.getColumn("price").numFmt = '#,##0.00 "ر.س"';

  const rawBuf = await wb.xlsx.writeBuffer();
  const date   = new Date().toISOString().slice(0, 10);
  const blob   = new Blob([rawBuf as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return new NextResponse(blob, {
    headers: {
      "Content-Disposition": `attachment; filename*=UTF-8''products-${date}.xlsx`,
    },
  });
}
