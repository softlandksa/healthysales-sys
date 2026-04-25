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

  const ws = wb.addWorksheet("المنتجات", { views: [{ rightToLeft: true }] });

  ws.columns = [
    { header: "الكود",              key: "code",        width: 18 },
    { header: "الاسم بالعربي",      key: "nameAr",      width: 35 },
    { header: "الاسم بالإنجليزي",   key: "nameEn",      width: 35 },
    { header: "الوصف",              key: "description", width: 45 },
    { header: "الوحدة",             key: "unit",        width: 18 },
    { header: "السعر",              key: "price",       width: 18 },
    { header: "نشط (نعم / لا)",     key: "isActive",    width: 18 },
  ];

  // Style header row
  const hdr = ws.getRow(1);
  hdr.font      = { bold: true, color: { argb: WHITE }, size: 11 };
  hdr.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  hdr.alignment = { horizontal: "right", vertical: "middle" };
  hdr.height    = 24;

  // Sample row 1
  const r2 = ws.addRow({
    code: "PROD-001", nameAr: "عصير برتقال", nameEn: "Orange Juice",
    description: "عصير طازج", unit: "علبة", price: 12.5, isActive: "نعم",
  });
  r2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREY } };

  // Sample row 2
  ws.addRow({
    code: "PROD-002", nameAr: "مياه معدنية", nameEn: "Mineral Water",
    description: "", unit: "زجاجة", price: 5, isActive: "نعم",
  });

  // Instructions row
  ws.addRow([]);
  const note = ws.addRow(["ملاحظة: أعمدة الكود والاسم العربي والوحدة والسعر إلزامية. للحالة: نعم = نشط، لا = غير نشط"]);
  note.font = { italic: true, color: { argb: "FF64748B" }, size: 10 };

  ws.getColumn("price").numFmt = '#,##0.00 "ر.س"';

  const rawBuf = await wb.xlsx.writeBuffer();
  const blob   = new Blob([rawBuf as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return new NextResponse(blob, {
    headers: {
      "Content-Disposition": "attachment; filename*=UTF-8''products-template.xlsx",
    },
  });
}
