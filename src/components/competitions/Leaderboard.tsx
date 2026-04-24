"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatSAR } from "@/lib/utils";
import type { LeaderboardEntry } from "@/types";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  competitionId: string;
}

const RANK_STYLES = [
  "bg-yellow-50 border-yellow-300 text-yellow-700",  // 🥇 1st
  "bg-slate-50  border-slate-200  text-slate-600",   // 🥈 2nd
  "bg-orange-50 border-orange-200 text-orange-700",  // 🥉 3rd
];

const RANK_LABELS = ["الأول", "الثاني", "الثالث"];
const RANK_MEDALS = ["🥇", "🥈", "🥉"];

export function Leaderboard({ entries }: LeaderboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(() => { router.refresh(); });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text-primary flex items-center gap-2">
          <Medal size={16} className="text-yellow-500" />
          لوحة المتصدرين
        </h3>
        <Button size="sm" variant="outline" onClick={refresh} disabled={isPending}>
          <RefreshCw size={13} className={isPending ? "animate-spin" : ""} />
          تحديث
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-text-muted text-sm">لا توجد مبيعات محصَّلة بعد</p>
          <p className="text-text-muted text-xs mt-1">تظهر النتائج عند تحصيل الطلبات المرتبطة بالمسابقة</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.userId}
              className={cn(
                "card p-4 flex items-center gap-4 border-2 transition-shadow hover:shadow-elev",
                entry.rank <= 3
                  ? RANK_STYLES[entry.rank - 1]
                  : "border-border"
              )}
            >
              {/* Rank */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-base bg-white/60 border border-current/20">
                {entry.rank <= 3 ? (
                  <span>{RANK_MEDALS[entry.rank - 1]}</span>
                ) : (
                  <span className="text-text-secondary num">{entry.rank}</span>
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-text-primary text-sm">
                    {entry.name ?? "مستخدم"}
                  </span>
                  {entry.rank <= 3 && (
                    <span className="text-xs font-medium opacity-70">
                      المركز {RANK_LABELS[entry.rank - 1]}
                    </span>
                  )}
                  {entry.isInactive && (
                    <span className="text-[10px] bg-danger-100 text-danger-600 rounded px-1.5 py-0.5">
                      غير نشط
                    </span>
                  )}
                </div>
                {entry.team && (
                  <p className="text-xs text-text-muted mt-0.5">{entry.team}</p>
                )}
              </div>

              {/* Stats */}
              <div className="text-left shrink-0 space-y-0.5">
                <div className="font-bold text-base num">
                  {entry.units.toLocaleString("en")} <span className="text-xs font-normal">وحدة</span>
                </div>
                <div className="text-xs text-text-muted num">
                  {formatSAR(Number(entry.value))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
