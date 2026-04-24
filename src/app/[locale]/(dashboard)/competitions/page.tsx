import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompetitionsTable } from "@/components/competitions/CompetitionsTable";
import { listCompetitions } from "@/server/actions/competitions";
import { requireUser } from "@/lib/auth/current-user";
import type { CompetitionRow } from "@/types";

interface CompetitionsPageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function CompetitionsPage({ searchParams }: CompetitionsPageProps) {
  const sp     = await searchParams;
  const user   = await requireUser();
  const page   = Math.max(1, Number(sp.page ?? 1));
  const status = sp.status ?? "";

  const result = await listCompetitions({
    ...(status ? { status } : {}),
    page,
    pageSize: 20,
  }) as { competitions: CompetitionRow[]; total: number };

  const { competitions, total } = result;

  const canCreate = ["admin", "general_manager", "sales_manager"].includes(user.role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">المسابقات</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            إجمالي <span className="num">{total}</span> مسابقة
          </p>
        </div>
        {canCreate && (
          <Link href="/ar/competitions/new">
            <Button>
              <Plus size={16} />
              مسابقة جديدة
            </Button>
          </Link>
        )}
      </div>

      <Suspense>
        <CompetitionsTable
          rows={competitions}
          total={total}
          page={page}
          pageSize={20}
          status={status}
        />
      </Suspense>
    </div>
  );
}
