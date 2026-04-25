import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";

const BLUE  = "FF2563EB";
const WHITE = "FFFFFFFF";
const GREY  = "FFF1F5F9";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "نظام المبيعات الميداني";

  const ws = wb.addWorksheet("العملاء", { views: [{ rightToLeft: true }] });

  ws.columns = [
    { header: "الاسم بالعربي",     key: "nameAr",         width: 35 },
    { header: "الاسم بالإنجليزي",  key: "nameEn",         width: 35 },
    { header: "الهاتف",            key: "phone",          width: 18 },
    { header: "الهاتف 2",          key: "phone2",         width: 18 },
    { header: "العنوان",           key: "address",        width: 45 },
    { header: "الملاحظات",         key: "notes",          width: 45 },
    { header: "الرصيد الافتتاحي",  key: "openingBalance", width: 22 },
    { header: "حد الائتمان",       key: "creditLimit",    width: 22 },
    { header: "نشط (نعم / لا)",    key: "isActive",       width: 18 },
  ];

  const hdr = ws.getRow(1);
  hdr.font      = { bold: true, color: { argb: WHITE }, size: 11 };
  hdr.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  hdr.alignment = { horizontal: "right", vertical: "middle" };
  hdr.height    = 24;

  const r2 = ws.addRow({
    nameAr: "أحمد محمد العمري", nameEn: "Ahmed Al-Omari",
    phone: "0501234567", phone2: "", address: "الرياض، حي النزهة",
    notes: "", openingBalance: 0, creditLimit: 5000, isActive: "نعم",
  });
  r2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREY } };

  ws.addRow({
    nameAr: "شركة النور للتجارة", nameEn: "Al-Nour Trading Co.",
    phone: "0551234567", phone2: "0561234567", address: "جدة، حي الصفا",
    notes: "عميل مميز", openingBalance: 1000, creditLimit: 10000, isActive: "نعم",
  });

  ws.addRow([]);
  const note = ws.addRow([
    "ملاحظة: الاسم بالعربي إلزامي. الرصيد الافتتاحي وحد الائتمان أرقام (0 إذا فارغ). للحالة: نعم = نشط، لا = غير نشط",
  ]);
  note.font = { italic: true, color: { argb: "FF64748B" }, size: 10 };

  ws.getColumn("openingBalance").numFmt = '#,##0.00 "ر.س"';
  ws.getColumn("creditLimit").numFmt   = '#,##0.00 "ر.س"';

  const rawBuf = await wb.xlsx.writeBuffer();
  const blob   = new Blob([rawBuf as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return new NextResponse(blob, {
    headers: {
      "Content-Disposition": "attachment; filename*=UTF-8''customers-template.xlsx",
    },
  });
}
