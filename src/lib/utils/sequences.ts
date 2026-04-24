import type { Prisma } from "@prisma/client";

// Minimal structural type — only $queryRaw is needed; compatible with both base and extended tx
export type TX = {
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Prisma.PrismaPromise<T>;
};

// Atomically increment a named sequence counter stored in the settings table.
// Returns the NEW value (1-based). Safe against concurrent transactions.
export async function nextSequence(tx: TX, key: string): Promise<number> {
  const rows = await tx.$queryRaw<{ value: string }[]>`
    INSERT INTO settings (key, value, "updatedAt")
    VALUES (${key}, '1', NOW())
    ON CONFLICT (key) DO UPDATE
      SET value      = (CAST(settings.value AS BIGINT) + 1)::TEXT,
          "updatedAt" = NOW()
    RETURNING value
  `;
  const val = rows[0]?.value;
  return val !== undefined ? parseInt(val, 10) : 1;
}

export function formatCode(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

export async function nextVisitCode(tx: TX): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await nextSequence(tx, `visit_seq_${year}`);
  return formatCode("VIS", year, seq);
}

export async function nextSalesOrderCode(tx: TX): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await nextSequence(tx, `sales_order_seq_${year}`);
  return formatCode("SO", year, seq);
}

export async function nextCollectionCode(tx: TX): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await nextSequence(tx, `collection_seq_${year}`);
  return formatCode("RCV", year, seq);
}
