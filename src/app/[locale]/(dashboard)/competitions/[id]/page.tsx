import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getCompetitionDetail, getCompetitionLeaderboard } from "@/server/actions/competitions";
import { CompetitionDetail } from "@/components/competitions/CompetitionDetail";
import type { CompetitionStatus } from "@/types";

interface CompetitionPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompetitionPage({ params }: CompetitionPageProps) {
  const { id } = await params;
  const user = await requireUser();

  const [detailResult, leaderboard] = await Promise.all([
    getCompetitionDetail(id).catch(() => null),
    getCompetitionLeaderboard(id, 50),
  ]);

  if (!detailResult) notFound();

  // Prisma returns Decimal for value — stringify for the component
  const raw = detailResult as {
    id: string; name: string; status: CompetitionStatus; prize: string;
    notes: string | null; startDate: Date; endDate: Date;
    product: { id: string; nameAr: string; code: string; unit: string };
    createdBy: { id: string; name: string | null; email: string };
    results: Array<{
      rank: number; units: number; value: { toFixed: (n: number) => string };
      user: { id: string; name: string | null; isActive: boolean };
    }>;
  };

  const competition = {
    ...raw,
    results: raw.results.map((r) => ({ ...r, value: r.value.toFixed(2) })),
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/ar/competitions" className="hover:text-brand-700 transition-colors">المسابقات</Link>
        <ChevronRight size={14} className="rotate-180" />
        <span className="text-text-primary font-medium line-clamp-1">{competition.name}</span>
      </nav>

      <CompetitionDetail
        competition={competition}
        leaderboard={leaderboard}
        currentUser={user}
      />
    </div>
  );
}
