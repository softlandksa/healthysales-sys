import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { getAuditLogs, getAuditEntityTypes } from "@/server/actions/audit";
import { AuditLogTable } from "./AuditLogTable";
import { currentMonthPeriod } from "@/lib/targets/periods";

export const metadata: Metadata = { title: "سجل التدقيق" };

interface Props {
  searchParams: Promise<Record<string, string>>;
}

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

export default async function AuditLogPage({ searchParams }: Props) {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "general_manager") redirect("/ar/403");

  const sp  = await searchParams;
  const now = new Date();
  const { periodStart } = currentMonthPeriod(now);

  const from       = parseDate(sp.from, periodStart);
  const to         = parseDate(sp.to, now);
  to.setHours(23, 59, 59, 999);

  const entityType = sp.entityType || undefined;
  const userId     = sp.userId     || undefined;
  const action     = sp.action     || undefined;
  const cursor     = sp.cursor     || undefined;

  const [{ rows, nextCursor }, entityTypes] = await Promise.all([
    getAuditLogs({
      from,
      to,
      ...(entityType ? { entityType } : {}),
      ...(userId     ? { userId }     : {}),
      ...(action     ? { action }     : {}),
      ...(cursor     ? { cursor }     : {}),
    }),
    getAuditEntityTypes(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">سجل التدقيق</h1>
        <p className="text-sm text-text-secondary mt-1">تتبع كل العمليات على البيانات</p>
      </div>

      <AuditLogTable
        rows={rows}
        entityTypes={entityTypes}
        nextCursor={nextCursor}
        initialFilters={{
          from,
          to,
          ...(entityType ? { entityType } : {}),
          ...(userId     ? { userId }     : {}),
          ...(action     ? { action }     : {}),
        }}
      />
    </div>
  );
}
