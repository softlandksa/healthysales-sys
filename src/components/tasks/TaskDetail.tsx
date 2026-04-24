"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, Send, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { updateTaskStatus, deleteTask, addTaskComment } from "@/server/actions/tasks";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "@/types";
import type { TaskStatus, SessionUser } from "@/types";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useRouter } from "next/navigation";

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending:     ["in_progress", "cancelled"],
  in_progress: ["done", "blocked", "cancelled"],
  done:        [],
  blocked:     ["in_progress", "cancelled"],
  cancelled:   [],
};

const TRANSITION_LABELS: Record<TaskStatus, string> = {
  pending:     "معلّقة",
  in_progress: "بدء التنفيذ",
  done:        "تم الإنجاز",
  blocked:     "محجوبة",
  cancelled:   "إلغاء",
};

interface Comment {
  id: string;
  body: string;
  createdAt: Date;
  user: { id: string; name: string | null; role: string };
}

interface TaskDetailProps {
  task: {
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    dueDate: Date;
    completedAt: Date | null;
    assignedTo: { id: string; name: string | null; email: string; role: string };
    assignedBy: { id: string; name: string | null; email: string };
    comments: Comment[];
  };
  currentUser: SessionUser;
}

export function TaskDetail({ task, currentUser }: TaskDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [isCommenting, startCommentTransition] = useTransition();
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const isAdmin    = currentUser.role === "admin";
  const isAssignee = task.assignedTo.id === currentUser.id;
  const isAssigner = task.assignedBy.id === currentUser.id;
  const canDelete  = isAdmin || (isAssigner && !["sales_rep"].includes(currentUser.role));
  const canChangeStatus = isAdmin || isAssignee || isAssigner;

  const allowedNext: TaskStatus[] = isAdmin
    ? (Object.keys(VALID_TRANSITIONS) as TaskStatus[]).filter((s) => s !== task.status)
    : VALID_TRANSITIONS[task.status];

  function initiateTransition(s: TaskStatus) {
    setPendingStatus(s);
    setNoteOpen(true);
  }

  function confirmTransition() {
    if (!pendingStatus) return;
    startTransition(async () => {
      const res = await updateTaskStatus(task.id, pendingStatus, note.trim() || undefined);
      if (res.success) {
        toast.success(`تم تحديث الحالة إلى: ${TASK_STATUS_LABELS[pendingStatus]}`);
        setNoteOpen(false);
        setNote("");
        setPendingStatus(null);
        router.refresh();
      } else {
        toast.error(res.error ?? "تعذر تحديث الحالة");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteTask(task.id);
      if (res.success) {
        toast.success("تم حذف المهمة");
        router.push("/ar/tasks");
      } else {
        toast.error(res.error ?? "تعذر حذف المهمة");
      }
    });
  }

  function handleAddComment() {
    if (!commentBody.trim()) return;
    startCommentTransition(async () => {
      const res = await addTaskComment(task.id, commentBody.trim());
      if (res.success) {
        setCommentBody("");
        router.refresh();
      } else {
        toast.error(res.error ?? "تعذر إضافة التعليق");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-text-primary leading-snug">{task.title}</h2>
            {task.description && (
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{task.description}</p>
            )}
          </div>
          <Badge variant={TASK_STATUS_COLORS[task.status]} className="shrink-0">
            {TASK_STATUS_LABELS[task.status]}
          </Badge>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-border text-sm">
          <div>
            <p className="text-text-muted text-xs mb-0.5">المُسنَد إليه</p>
            <p className="font-medium text-text-primary">{task.assignedTo.name ?? task.assignedTo.email}</p>
          </div>
          <div>
            <p className="text-text-muted text-xs mb-0.5">المُسنِد</p>
            <p className="font-medium text-text-primary">{task.assignedBy.name ?? task.assignedBy.email}</p>
          </div>
          <div>
            <p className="text-text-muted text-xs mb-0.5">تاريخ الاستحقاق</p>
            <p className={`font-medium num ${new Date(task.dueDate) < new Date() && task.status !== "done" && task.status !== "cancelled" ? "text-danger-600" : "text-text-primary"}`}>
              {format(new Date(task.dueDate), "dd/MM/yyyy", { locale: ar })}
            </p>
          </div>
          {task.completedAt && (
            <div>
              <p className="text-text-muted text-xs mb-0.5">تاريخ الإنجاز</p>
              <p className="font-medium text-success-600 num">
                {format(new Date(task.completedAt), "dd/MM/yyyy", { locale: ar })}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        {canChangeStatus && allowedNext.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {allowedNext.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={s === "cancelled" ? "destructive" : s === "done" ? "default" : "outline"}
                onClick={() => initiateTransition(s)}
                disabled={isPending}
              >
                {TRANSITION_LABELS[s]}
              </Button>
            ))}
          </div>
        )}

        {canDelete && (
          <div className="flex justify-end pt-2 border-t border-border">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" disabled={isPending}>
                  <Trash2 size={14} />
                  حذف المهمة
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>تأكيد حذف المهمة</AlertDialogTitle>
                  <AlertDialogDescription>
                    سيتم حذف المهمة والتعليقات المرتبطة بها نهائياً. هذا الإجراء لا يمكن التراجع عنه.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-danger-600 hover:bg-danger-700 text-white focus:ring-danger-500">
                    {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                    حذف
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Note dialog (inline) */}
      {noteOpen && pendingStatus && (
        <div className="card p-5 space-y-3 border-2 border-brand-200">
          <p className="text-sm font-medium text-text-primary">
            تحديث الحالة إلى: <span className="text-brand-700">{TASK_STATUS_LABELS[pendingStatus]}</span>
          </p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ملاحظة (اختياري)..."
            rows={2}
            maxLength={500}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={confirmTransition} disabled={isPending}>
              {isPending && <Loader2 size={14} className="animate-spin" />}
              تأكيد
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setNoteOpen(false); setPendingStatus(null); setNote(""); }}>
              إلغاء
            </Button>
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-text-primary">التعليقات ({task.comments.length})</h3>

        {task.comments.length === 0 ? (
          <p className="text-sm text-text-muted">لا توجد تعليقات بعد.</p>
        ) : (
          <div className="space-y-3">
            {task.comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">
                  {(c.user.name ?? "؟")[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-text-primary">{c.user.name ?? "مستخدم"}</span>
                    <span className="text-xs text-text-muted num">
                      {format(new Date(c.createdAt), "dd/MM/yyyy HH:mm", { locale: ar })}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add comment */}
        <div className="pt-3 border-t border-border space-y-2">
          <Textarea
            ref={commentRef}
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="أضف تعليقاً..."
            rows={2}
            maxLength={2000}
          />
          <Button
            size="sm"
            onClick={handleAddComment}
            disabled={isCommenting || !commentBody.trim()}
          >
            {isCommenting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            إرسال
          </Button>
        </div>
      </div>
    </div>
  );
}
