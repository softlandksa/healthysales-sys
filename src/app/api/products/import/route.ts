import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { defineAbilitiesFor } from "@/lib/rbac/abilities";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types";

// ─── Row schema ──────────────────────────────────────────────────────────────

const rowSchema = z.object({
  code:        z.string().min(1, "الكود مطلوب").max(50).trim(),
  nameAr:      z.string().min(2, "الاسم العربي مطلوب (حرفان على الأقل)").max(200).trim(),
  nameEn:      z.string().max(200).trim().optional().or(z.literal("")),
  description: z.string().max(2000).trim().optional().or(z.literal("")),
  unit:        z.string().min(1, "الوحدة مطلوبة").max(50).trim(),
  price:       z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "السعر يجب أن يكون رقماً موجباً (مثال: 10.50)")
    .refine((v) => parseFloat(v) >= 0, "السعر لا يمكن أن يكون سالباً"),
  isActive:    z.string().optional(),
});

export interface ProductImportRow {
  rowNum:      number;
  code:        string;
  nameAr:      string;
  nameEn:      string;
  description: string;
  unit:        string;
  price:       string;
  isActive:    boolean;
  errors:      string[];
  valid:       boolean;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  const ability = defineAbilitiesFor(user);
  if (!ability.can("create", "Product")) {
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

    // Map header names → column numbers
    const colMap: Record<string, number> = {};
    ws.getRow(1).eachCell((cell, col) => {
      const v = String(cell.value ?? "").trim();
      if (/كود|code/i.test(v))             colMap.code        = col;
      else if (/عربي|nameAr/i.test(v))     colMap.nameAr      = col;
      else if (/إنجليزي|english|nameEn/i.test(v)) colMap.nameEn  = col;
      else if (/وصف|desc/i.test(v))        colMap.description = col;
      else if (/وحدة|unit/i.test(v))       colMap.unit        = col;
      else if (/سعر|price/i.test(v))       colMap.price       = col;
      else if (/نشط|active/i.test(v))      colMap.isActive    = col;
    });

    const rows: ProductImportRow[] = [];

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const get = (key: string) => {
        const col = colMap[key];
        if (!col) return "";
        const val = row.getCell(col).value;
        if (val === null || val === undefined) return "";
        if (val instanceof Date) return val.toISOString();
        return String(val).trim();
      };

      const rawCode   = get("code");
      const rawNameAr = get("nameAr");
      if (!rawCode && !rawNameAr) return; // skip blank rows

      const rawPrice = get("price").replace(/[,٫]/g, ".").replace(/[^\d.]/g, "");

      const rawRow = {
        code:        rawCode,
        nameAr:      rawNameAr,
        nameEn:      get("nameEn"),
        description: get("description"),
        unit:        get("unit"),
        price:       rawPrice,
        isActive:    get("isActive"),
      };

      const parsed = rowSchema.safeParse(rawRow);
      const errors: string[] = parsed.success ? [] : parsed.error.errors.map((e) => e.message);

      const rawActive = rawRow.isActive.toLowerCase();
      const isActive  = rawActive === "لا" || rawActive === "no" || rawActive === "false" ? false : true;

      rows.push({
        rowNum:      rowNumber,
        code:        rawRow.code,
        nameAr:      rawRow.nameAr,
        nameEn:      rawRow.nameEn,
        description: rawRow.description,
        unit:        rawRow.unit,
        price:       rawPrice,
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

    // action === "import" — upsert valid rows
    const valid = rows.filter((r) => r.valid);
    let saved   = 0;
    let skipped = 0;

    for (const row of valid) {
      try {
        await prisma.product.upsert({
          where:  { code: row.code },
          create: {
            code:        row.code,
            nameAr:      row.nameAr,
            nameEn:      row.nameEn || null,
            description: row.description || null,
            unit:        row.unit,
            price:       row.price,
            isActive:    row.isActive,
          },
          update: {
            nameAr:      row.nameAr,
            nameEn:      row.nameEn || null,
            description: row.description || null,
            unit:        row.unit,
            price:       row.price,
            isActive:    row.isActive,
          },
        });
        saved++;
      } catch {
        skipped++;
      }
    }

    return NextResponse.json({ saved, skipped, total: valid.length });
  } catch (err) {
    console.error("[products/import]", err);
    return NextResponse.json({ error: "تعذر معالجة الملف. تأكد من أنه ملف Excel صالح." }, { status: 500 });
  }
}
