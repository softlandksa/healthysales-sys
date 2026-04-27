import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";

// ─── Row schema ──────────────────────────────────────────────────────────────

const rowSchema = z.object({
  nameAr:         z.string().min(2, "الاسم العربي مطلوب (حرفان على الأقل)").max(200).trim(),
  nameEn:         z.string().max(200).trim().optional().or(z.literal("")),
  phone:          z
    .string()
    .regex(/^[0-9+\s-]{7,20}$/, "رقم الهاتف غير صالح")
    .optional()
    .or(z.literal("")),
  phone2:         z
    .string()
    .regex(/^[0-9+\s-]{7,20}$/, "رقم الهاتف 2 غير صالح")
    .optional()
    .or(z.literal("")),
  address:        z.string().max(500).trim().optional().or(z.literal("")),
  notes:          z.string().max(2000).trim().optional().or(z.literal("")),
  openingBalance: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "الرصيد الافتتاحي غير صالح")
    .optional()
    .default("0"),
  creditLimit:    z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "حد الائتمان غير صالح")
    .optional()
    .or(z.literal("")),
  isActive:       z.string().optional(),
});

export interface CustomerImportRow {
  rowNum:         number;
  nameAr:         string;
  nameEn:         string;
  phone:          string;
  phone2:         string;
  address:        string;
  notes:          string;
  openingBalance: string;
  creditLimit:    string;
  isActive:       boolean;
  errors:         string[];
  valid:          boolean;
}

// ─── Code generator ──────────────────────────────────────────────────────────

async function nextCustomerCode(): Promise<string> {
  const count = await prisma.customer.count();
  return `CUS-${String(count + 1).padStart(4, "0")}`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  const ability = defineAbilitiesFor(user);
  if (!ability.can("create", "Customer")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const action = req.nextUrl.searchParams.get("action") ?? "preview";

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "لم يتم إرفاق ملف" }, { status: 400 });
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());

    const ws = wb.worksheets[0];
    if (!ws) {
      return NextResponse.json({ error: "الملف فارغ أو غير صالح" }, { status: 400 });
    }

    // Map headers → column numbers
    const colMap: Record<string, number> = {};
    ws.getRow(1).eachCell((cell, col) => {
      const v = String(cell.value ?? "").trim();
      if (/الاسم بالعربي|عربي|nameAr/i.test(v))            colMap.nameAr         = col;
      else if (/إنجليزي|english|nameEn/i.test(v))           colMap.nameEn         = col;
      else if (/هاتف 2|phone2/i.test(v))                    colMap.phone2         = col;
      else if (/هاتف|phone/i.test(v))                       colMap.phone          = col;
      else if (/عنوان|address/i.test(v))                    colMap.address        = col;
      else if (/ملاحظات|notes/i.test(v))                    colMap.notes          = col;
      else if (/افتتاحي|opening/i.test(v))                  colMap.openingBalance = col;
      else if (/ائتمان|credit/i.test(v))                    colMap.creditLimit    = col;
      else if (/نشط|active/i.test(v))                       colMap.isActive       = col;
    });

    const rows: CustomerImportRow[] = [];

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const get = (key: string) => {
        const col = colMap[key];
        if (!col) return "";
        const val = row.getCell(col).value;
        if (val === null || val === undefined) return "";
        if (typeof val === "number") return String(val);
        return String(val).trim();
      };

      const rawNameAr = get("nameAr");
      if (!rawNameAr) return; // skip blank rows

      const cleanNum = (s: string) => s.replace(/[,٫]/g, ".").replace(/[^\d.]/g, "") || "0";

      const rawRow = {
        nameAr:         rawNameAr,
        nameEn:         get("nameEn"),
        phone:          get("phone"),
        phone2:         get("phone2"),
        address:        get("address"),
        notes:          get("notes"),
        openingBalance: cleanNum(get("openingBalance")) || "0",
        creditLimit:    cleanNum(get("creditLimit")),
        isActive:       get("isActive"),
      };

      const parsed = rowSchema.safeParse(rawRow);
      const errors = parsed.success ? [] : parsed.error.errors.map((e) => e.message);

      const rawActive = rawRow.isActive.toLowerCase();
      const isActive  = rawActive === "لا" || rawActive === "no" || rawActive === "false" ? false : true;

      rows.push({
        rowNum:         rowNumber,
        nameAr:         rawRow.nameAr,
        nameEn:         rawRow.nameEn,
        phone:          rawRow.phone,
        phone2:         rawRow.phone2,
        address:        rawRow.address,
        notes:          rawRow.notes,
        openingBalance: rawRow.openingBalance,
        creditLimit:    rawRow.creditLimit,
        isActive,
        errors,
        valid: errors.length === 0,
      });
    });

    if (action === "preview") {
      return NextResponse.json({
        rows,
        total:      rows.length,
        validCount: rows.filter((r) => r.valid).length,
      });
    }

    // action === "import" — create valid customers
    const valid = rows.filter((r) => r.valid);
    let saved   = 0;
    let skipped = 0;

    for (const row of valid) {
      try {
        const code           = await nextCustomerCode();
        const openingBalance = new Prisma.Decimal(row.openingBalance || "0");

        await prisma.$transaction(async (tx) => {
          const customer = await tx.customer.create({
            data: {
              code,
              nameAr:         row.nameAr,
              nameEn:         row.nameEn || null,
              phone:          row.phone  || null,
              phone2:         row.phone2 || null,
              address:        row.address || null,
              notes:          row.notes  || null,
              openingBalance,
              balance:        openingBalance,
              creditLimit:    row.creditLimit ? new Prisma.Decimal(row.creditLimit) : null,
              isActive:       row.isActive,
            },
          });

          if (openingBalance.greaterThan(0)) {
            await tx.customerTransaction.create({
              data: {
                type:            "opening_balance",
                amount:          openingBalance,
                balance:         openingBalance,
                description:     "رصيد افتتاحي",
                transactionDate: new Date(),
                customerId:      customer.id,
                createdById:     user.id,
              },
            });
          }
        });

        saved++;
      } catch {
        skipped++;
      }
    }

    return NextResponse.json({ saved, skipped, total: valid.length });
  } catch (err) {
    console.error("[customers/import]", err);
    return NextResponse.json({ error: "تعذر معالجة الملف. تأكد من أنه ملف Excel صالح." }, { status: 500 });
  }
}
