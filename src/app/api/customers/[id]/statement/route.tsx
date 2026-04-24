import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { prisma } from "@/lib/db/prisma";
import { StatementDocument } from "@/components/pdf/StatementDocument";
import type { SessionUser, TransactionType } from "@/types";
import { TRANSACTION_TYPE_LABELS } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionUser = session.user as SessionUser;
  const ability = defineAbilitiesFor(sessionUser);
  if (!ability.can("read", "Customer")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") ?? "xlsx";
  const fromDate = sp.get("from") ?? "";
  const toDate = sp.get("to") ?? "";
  const typeFilter = sp.get("type") ?? "";

  // Fetch customer
  const customer = await prisma.customer.findUnique({
    where: { id },
    select: {
      code: true, nameAr: true,
      balance: true, openingBalance: true,
    },
  });
  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch ALL matching transactions (no pagination for export)
  const txWhere = {
    customerId: id,
    ...(fromDate || toDate ? { transactionDate: {
      ...(fromDate ? { gte: new Date(fromDate) } : {}),
      ...(toDate ? { lte: new Date(toDate + "T23:59:59") } : {}),
    }} : {}),
    ...(typeFilter ? { type: typeFilter as TransactionType } : {}),
  };

  const transactions = await prisma.customerTransaction.findMany({
    where: txWhere,
    orderBy: { transactionDate: "asc" },
    select: {
      id: true, type: true, amount: true, balance: true,
      description: true, reference: true, transactionDate: true,
    },
  });

  const rows = transactions.map((t) => ({
    id: t.id,
    type: t.type as TransactionType,
    amount: t.amount.toFixed(2),
    balance: t.balance.toFixed(2),
    description: t.description,
    reference: t.reference,
    transactionDate: t.transactionDate,
  }));

  const generatedAt = new Date().toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" });

  // ── PDF export ────────────────────────────────────────────────────────────────
  if (format === "pdf") {
    const buffer = await renderToBuffer(
      <StatementDocument
        customerCode={customer.code}
        customerName={customer.nameAr}
        balance={customer.balance.toFixed(2)}
        openingBalance={customer.openingBalance.toFixed(2)}
        {...(fromDate ? { fromDate } : {})}
        {...(toDate ? { toDate } : {})}
        rows={rows}
        generatedAt={generatedAt}
      />
    );

    return new NextResponse(new Blob([buffer as unknown as ArrayBuffer], { type: "application/pdf" }), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="statement-${customer.code}.pdf"`,
      },
    });
  }

  // ── Excel export ──────────────────────────────────────────────────────────────
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Field Sales System";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("كشف الحساب", {
    properties: { tabColor: { argb: "FF2563EB" } },
    views: [{ rightToLeft: true }],
  });

  // Title rows
  sheet.mergeCells("A1:F1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `كشف حساب — ${customer.nameAr} (${customer.code})`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center" };

  sheet.mergeCells("A2:F2");
  const subCell = sheet.getCell("A2");
  subCell.value = fromDate || toDate
    ? `الفترة: ${fromDate || "البداية"} إلى ${toDate || "اليوم"}`
    : "كل الحركات";
  subCell.alignment = { horizontal: "center" };
  subCell.font = { color: { argb: "FF64748B" } };

  sheet.addRow([]);
  const summaryRow = sheet.addRow([
    "الرصيد الافتتاحي",
    parseFloat(customer.openingBalance.toFixed(2)),
    "",
    "",
    "الرصيد الحالي",
    parseFloat(customer.balance.toFixed(2)),
  ]);
  summaryRow.font = { bold: true };
  sheet.addRow([]);

  // Header row
  const headerRow = sheet.addRow([
    "التاريخ", "النوع", "البيان", "مدين", "دائن", "الرصيد",
  ]);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  headerRow.alignment = { horizontal: "right" };

  // Column widths
  sheet.getColumn(1).width = 14;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 35;
  sheet.getColumn(4).width = 16;
  sheet.getColumn(5).width = 16;
  sheet.getColumn(6).width = 16;

  const amtFmt = '#,##0.00 "ر.س"';

  rows.forEach((row, i) => {
    const isDebit = ["opening_balance", "sale", "adjustment"].includes(row.type);
    const bal = parseFloat(row.balance);
    const dataRow = sheet.addRow([
      new Date(row.transactionDate).toLocaleDateString("en-SA"),
      TRANSACTION_TYPE_LABELS[row.type],
      `${row.description ?? ""}${row.reference ? ` (${row.reference})` : ""}`.trim(),
      isDebit ? parseFloat(row.amount) : null,
      !isDebit ? parseFloat(row.amount) : null,
      parseFloat(row.balance),
    ]);

    if (i % 2 === 1) {
      dataRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    }

    dataRow.getCell(4).numFmt = amtFmt;
    dataRow.getCell(5).numFmt = amtFmt;
    const balCell = dataRow.getCell(6);
    balCell.numFmt = amtFmt;
    balCell.font = { bold: true, color: { argb: bal > 0 ? "FFDC2626" : "FF16A34A" } };
    dataRow.alignment = { horizontal: "right" };
  });

  sheet.addRow([]);
  const totalsRow = sheet.addRow([
    "الإجمالي", "", "",
    rows.reduce((s, r) => {
      if (["opening_balance", "sale", "adjustment"].includes(r.type)) return s + parseFloat(r.amount);
      return s;
    }, 0),
    rows.reduce((s, r) => {
      if (["payment", "return_credit"].includes(r.type)) return s + parseFloat(r.amount);
      return s;
    }, 0),
    parseFloat(customer.balance.toFixed(2)),
  ]);
  totalsRow.font = { bold: true };
  totalsRow.getCell(4).numFmt = amtFmt;
  totalsRow.getCell(5).numFmt = amtFmt;
  totalsRow.getCell(6).numFmt = amtFmt;

  const rawBuffer = await workbook.xlsx.writeBuffer();
  // Cast through unknown — writeBuffer returns Buffer in Node which is BlobPart-compatible at runtime
  const blob = new Blob([rawBuffer as unknown as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="statement-${customer.code}.xlsx"`,
    },
  });
}
