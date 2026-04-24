"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cancelCompetition, updateCompetition } from "@/server/actions/competitions";
import { COMPETITION_STATUS_LABELS, COMPETITION_STATUS_COLORS } from "@/types";
import type { CompetitionStatus, SessionUser } from "@/types";
import { Leaderboard } from "./Leaderboard";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useRouter } from "next/navigation";
import type { LeaderboardEntry } from "@/types";

interface CompetitionDetailProps {
  competition: {
    id: string;
    name: string;
    status: CompetitionStatus;
    prize: string;
    notes: string | null;
    startDate: Date;
    endDate: Date;
    product: { id: string; nameAr: string; code: string; unit: string };
    createdBy: { id: string; name: string | null; email: string };
    results: Array<{
      rank: number; units: number; value: string;
      user: { id: string; name: string | null; isActive: boolean };
    }>;
  };
  leaderboard: LeaderboardEntry[];
  currentUser: SessionUser;
}

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

export function CompetitionDetail({ competition, leaderboard, currentUser }: CompetitionDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelReason, setCancelReason] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editPrize, setEditPrize]   = useState(competition.prize);
  const [editNotes, setEditNotes]   = useState(competition.notes ?? "");
  const [editEndDate, setEditEndDate] = useState(
    competition.endDate.toISOString().slice(0, 10)
  );

  const isCreator = competition.createdBy.id === currentUser.id;
  const isAdmin   = currentUser.role === "admin";
  const canManage = isAdmin || (isCreator && !["sales_rep", "team_manager"].includes(currentUser.role));
  const canCancel = canManage && competition.status !== "cancelled" && competition.status !== "ended";
  const canEdit   = canManage && competition.status !== "cancelled" && competition.status !== "ended";

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });

  function handleCancel() {
    startTransition(async () => {
      const res = await cancelCompetition(competition.id, cancelReason);
      if (res.success) {
        toast.success("تم إلغاء المسابقة");
        router.refresh();
      } else {
        toast.error(res.error ?? "تعذر إلغاء المسابقة");
      }
    });
  }

  function handleUpdate() {
    startTransition(async () => {
      const res = await updateCompetition(competition.id, {
        prize:   editPrize,
        notes:   editNotes,
        endDate: editEndDate,
      });
      if (res.success) {
        toast.success("تم تحديث المسابقة");
        setEditOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "تعذر تحديث المسابقة");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1 min-w-0">
            <h2 className="text-xl font-bold text-text-primary">{competition.name}</h2>
            <p className="text-sm text-text-secondary">
              منتج: <span className="font-medium text-text-primary">{competition.product.nameAr}</span>
              <span className="text-text-muted"> — {competition.product.code} ({competition.product.unit})</span>
            </p>
          </div>
          <Badge variant={COMPETITION_STATUS_COLORS[competition.status]} className="shrink-0 text-sm">
            {COMPETITION_STATUS_LABELS[competition.status]}
          </Badge>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-border text-sm">
          <div>
            <p className="text-text-muted text-xs mb-0.5">تاريخ البدء</p>
            <p className="font-medium num">{format(new Date(competition.startDate), "dd/MM/yyyy", { locale: ar })}</p>
          </div>
          <div>
            <p className="text-text-muted text-xs mb-0.5">تاريخ الانتهاء</p>
            <p className="font-medium num">{format(new Date(competition.endDate), "dd/MM/yyyy", { locale: ar })}</p>
          </div>
          <div>
            <p className="text-text-muted text-xs mb-0.5">الجائزة</p>
            <p className="font-medium text-text-primary">{competition.prize}</p>
          </div>
          <div>
            <p className="text-text-muted text-xs mb-0.5">المنشئ</p>
            <p className="font-medium text-text-primary">{competition.createdBy.name ?? competition.createdBy.email}</p>
          </div>
        </div>

        {competition.notes && (
          <p className="text-sm text-text-secondary border-t border-border pt-3 whitespace-pre-wrap">
            {competition.notes}
          </p>
        )}

        {/* Actions */}
        {(canEdit || canCancel) && (
          <div className="flex gap-2 pt-2 border-t border-border flex-wrap">
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setEditOpen(!editOpen)}>
                {editOpen ? "إخفاء التعديل" : "تعديل"}
              </Button>
            )}
            {canCancel && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" disabled={isPending}>
                    <XCircle size={14} />
                    إلغاء المسابقة
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>تأكيد إلغاء المسابقة</AlertDialogTitle>
                    <AlertDialogDescription>
                      سيتم إخطار جميع المندوبين المشاركين بالإلغاء. هذا الإجراء لا يمكن التراجع عنه.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="px-6 pb-2">
                    <Textarea
                      placeholder="سبب الإلغاء (اختياري)..."
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      rows={2}
                      maxLength={300}
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>رجوع</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancel}
                      className="bg-danger-600 hover:bg-danger-700 text-white"
                    >
                      {isPending && <Loader2 size={14} className="animate-spin" />}
                      إلغاء المسابقة
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}

        {/* Edit panel */}
        {editOpen && (
          <div className="border-t border-border pt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">الجائزة</Label>
              <Input value={editPrize} onChange={(e) => setEditPrize(e.target.value)} maxLength={300} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">تمديد تاريخ الانتهاء</Label>
              <Input
                type="date"
                min={todayStr}
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
                className="num max-w-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">ملاحظات</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                maxLength={2000}
              />
            </div>
            <Button size="sm" onClick={handleUpdate} disabled={isPending}>
              {isPending && <Loader2 size={14} className="animate-spin" />}
              حفظ التعديلات
            </Button>
          </div>
        )}
      </div>

      {/* Final results (if ended) */}
      {competition.status === "ended" && competition.results.length > 0 && (
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-text-primary">النتائج النهائية</h3>
          <div className="space-y-2">
            {competition.results.map((result) => (
              <div key={result.rank} className="flex items-center gap-3 p-3 rounded-card bg-surface-1">
                <span className="text-lg">{RANK_MEDALS[result.rank - 1] ?? result.rank}</span>
                <div className="flex-1">
                  <p className="font-medium text-text-primary text-sm">{result.user.name ?? "مستخدم"}</p>
                  {!result.user.isActive && (
                    <span className="text-xs text-danger-500">غير نشط</span>
                  )}
                </div>
                <div className="text-sm font-bold num">{result.units.toLocaleString("en")} وحدة</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live leaderboard */}
      {competition.status !== "cancelled" && (
        <Leaderboard entries={leaderboard} competitionId={competition.id} />
      )}
    </div>
  );
}
